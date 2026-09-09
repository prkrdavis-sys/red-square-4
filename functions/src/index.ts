import { createHash, randomBytes } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import {
  FieldValue,
  getFirestore,
  Timestamp,
  type DocumentData,
  type Transaction,
} from 'firebase-admin/firestore';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';

initializeApp();

const db = getFirestore();
const FRIEND_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const FRIEND_CODE_LENGTH = 8;
const DISPLAY_NAME_MAX_LENGTH = 24;
const INVITATION_TTL_MS = 2 * 60 * 1000;

interface EnsureProfileInput {
  displayName?: string;
}

interface FriendCodeInput {
  friendCode: string;
}

interface FriendRequestResponseInput {
  requestId: string;
  response: 'accept' | 'decline';
}

interface FriendInput {
  friendUid: string;
}

interface GameInvitationInput extends FriendInput {
  levelId: string;
}

interface InvitationResponseInput {
  invitationId: string;
  response: 'accept' | 'decline';
}

interface InvitationInput {
  invitationId: string;
}

interface SessionInput {
  sessionId: string;
}

interface ProfileResult {
  friendCode: string;
  displayName: string;
}

export const ensureProfile = onCall<EnsureProfileInput>(async (
  request: CallableRequest<EnsureProfileInput>,
) => {
  const uid = requireUid(request);
  const requestedName = request.data.displayName === undefined
    ? undefined
    : parseDisplayName(request.data.displayName);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const friendCode = generateFriendCode();
    const result = await db.runTransaction(async (
      transaction: Transaction,
    ): Promise<ProfileResult | null> => {
      const userRef = db.doc(`users/${uid}`);
      const userSnapshot = await transaction.get(userRef);
      if (userSnapshot.exists) {
        const currentCode = readString(userSnapshot.data(), 'friendCode');
        const currentName = readString(userSnapshot.data(), 'displayName');
        const displayName = requestedName ?? currentName;
        if (displayName !== currentName) {
          transaction.update(userRef, { displayName, updatedAt: FieldValue.serverTimestamp() });
          transaction.set(db.doc(`profiles/${uid}`), {
            uid,
            friendCode: currentCode,
            displayName,
          }, { merge: true });
        }
        return { friendCode: currentCode, displayName };
      }

      const codeRef = db.doc(`friendCodes/${friendCode}`);
      if ((await transaction.get(codeRef)).exists) {
        return null;
      }
      const displayName = requestedName ?? `Player ${friendCode.slice(-4)}`;
      const now = FieldValue.serverTimestamp();
      transaction.create(codeRef, { uid, createdAt: now });
      transaction.create(userRef, { uid, friendCode, displayName, createdAt: now, updatedAt: now });
      transaction.create(db.doc(`profiles/${uid}`), { uid, friendCode, displayName });
      return { friendCode, displayName };
    });
    if (result) {
      return result;
    }
  }
  throw new HttpsError('resource-exhausted', 'Could not allocate a friend code. Try again.');
});

export const sendFriendRequest = onCall<FriendCodeInput>(async (
  request: CallableRequest<FriendCodeInput>,
) => {
  const senderUid = requireUid(request);
  const friendCode = parseFriendCode(request.data.friendCode);
  const result = await db.runTransaction(async (transaction: Transaction) => {
    const codeSnapshot = await transaction.get(db.doc(`friendCodes/${friendCode}`));
    if (!codeSnapshot.exists) {
      throw new HttpsError('not-found', 'No player has that friend code.');
    }
    const recipientUid = readString(codeSnapshot.data(), 'uid');
    if (recipientUid === senderUid) {
      throw new HttpsError('invalid-argument', 'You cannot add yourself.');
    }

    const friendshipId = pairId(senderUid, recipientUid);
    const friendshipRef = db.doc(`friendships/${friendshipId}`);
    if ((await transaction.get(friendshipRef)).exists) {
      throw new HttpsError('already-exists', 'That player is already your friend.');
    }
    const senderProfile = await transaction.get(db.doc(`profiles/${senderUid}`));
    if (!senderProfile.exists) {
      throw new HttpsError('failed-precondition', 'Create your player profile first.');
    }
    const requestRef = db.doc(`friendRequests/${friendshipId}`);
    const existingRequest = await transaction.get(requestRef);
    if (existingRequest.exists && readString(existingRequest.data(), 'status') === 'pending') {
      throw new HttpsError('already-exists', 'A friend request is already pending.');
    }
    transaction.set(requestRef, {
      senderUid,
      recipientUid,
      senderDisplayName: readString(senderProfile.data(), 'displayName'),
      participantIds: [senderUid, recipientUid],
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { requestId: requestRef.id };
  });
  return result;
});

export const respondToFriendRequest = onCall<FriendRequestResponseInput>(async (
  request: CallableRequest<FriendRequestResponseInput>,
) => {
  const uid = requireUid(request);
  const requestId = parseDocumentId(request.data.requestId, 'requestId');
  const response = parseFriendResponse(request.data.response);
  await db.runTransaction(async (transaction: Transaction) => {
    const requestRef = db.doc(`friendRequests/${requestId}`);
    const snapshot = await transaction.get(requestRef);
    const data = requirePendingDocument(snapshot.data(), snapshot.exists, 'Friend request');
    if (readString(data, 'recipientUid') !== uid) {
      throw new HttpsError('permission-denied', 'Only the recipient can respond.');
    }
    const senderUid = readString(data, 'senderUid');
    transaction.update(requestRef, {
      status: response === 'accept' ? 'accepted' : 'declined',
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (response === 'accept') {
      const memberIds = sortedPair(uid, senderUid);
      transaction.set(db.doc(`friendships/${pairId(uid, senderUid)}`), {
        memberIds,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  });
});

export const removeFriend = onCall<FriendInput>(async (request: CallableRequest<FriendInput>) => {
  const uid = requireUid(request);
  const friendUid = parseDocumentId(request.data.friendUid, 'friendUid');
  if (uid === friendUid) {
    throw new HttpsError('invalid-argument', 'Invalid friend.');
  }
  await db.doc(`friendships/${pairId(uid, friendUid)}`).delete();
});

export const sendGameInvitation = onCall<GameInvitationInput>(async (
  request: CallableRequest<GameInvitationInput>,
) => {
  const fromUid = requireUid(request);
  const toUid = parseDocumentId(request.data.friendUid, 'friendUid');
  const levelId = parseLevelId(request.data.levelId);
  if (fromUid === toUid) {
    throw new HttpsError('invalid-argument', 'You cannot invite yourself.');
  }
  const invitationRef = db.collection('invitations').doc();
  await db.runTransaction(async (transaction: Transaction) => {
    const friendship = await transaction.get(db.doc(`friendships/${pairId(fromUid, toUid)}`));
    if (!friendship.exists) {
      throw new HttpsError('failed-precondition', 'Only friends can invite each other.');
    }
    transaction.create(invitationRef, {
      fromUid,
      toUid,
      participantIds: sortedPair(fromUid, toUid),
      levelId,
      status: 'pending',
      sessionId: null,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + INVITATION_TTL_MS),
    });
  });
  return { invitationId: invitationRef.id };
});

export const respondToGameInvitation = onCall<InvitationResponseInput>(async (
  request: CallableRequest<InvitationResponseInput>,
) => {
  const uid = requireUid(request);
  const invitationId = parseDocumentId(request.data.invitationId, 'invitationId');
  const response = parseInvitationResponse(request.data.response);
  const sessionRef = db.collection('sessions').doc();
  return db.runTransaction(async (transaction: Transaction) => {
    const invitationRef = db.doc(`invitations/${invitationId}`);
    const snapshot = await transaction.get(invitationRef);
    const data = requirePendingDocument(snapshot.data(), snapshot.exists, 'Invitation');
    if (readString(data, 'toUid') !== uid) {
      throw new HttpsError('permission-denied', 'Only the invited player can respond.');
    }
    const expiresAt = readTimestamp(data, 'expiresAt');
    if (expiresAt.toMillis() <= Date.now()) {
      transaction.update(invitationRef, { status: 'expired' });
      return { session: null };
    }
    if (response === 'decline') {
      transaction.update(invitationRef, {
        status: 'declined',
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { session: null };
    }

    const hostUid = readString(data, 'fromUid');
    const levelId = parseLevelId(data.levelId);
    const memberIds = sortedPair(hostUid, uid);
    transaction.create(sessionRef, {
      hostUid,
      guestUid: uid,
      memberIds,
      levelId,
      state: 'signaling',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + 30 * 60 * 1000),
    });
    transaction.update(invitationRef, {
      status: 'accepted',
      sessionId: sessionRef.id,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return {
      session: {
        id: sessionRef.id,
        hostUid,
        guestUid: uid,
        memberIds,
        state: 'signaling' as const,
        levelId,
      },
    };
  });
});

export const cancelGameInvitation = onCall<InvitationInput>(async (
  request: CallableRequest<InvitationInput>,
) => {
  const uid = requireUid(request);
  const invitationId = parseDocumentId(request.data.invitationId, 'invitationId');
  await db.runTransaction(async (transaction: Transaction) => {
    const invitationRef = db.doc(`invitations/${invitationId}`);
    const snapshot = await transaction.get(invitationRef);
    const data = requirePendingDocument(snapshot.data(), snapshot.exists, 'Invitation');
    if (readString(data, 'fromUid') !== uid) {
      throw new HttpsError('permission-denied', 'Only the sender can cancel.');
    }
    transaction.update(invitationRef, {
      status: 'cancelled',
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
});

export const markSessionConnected = onCall<SessionInput>(async (
  request: CallableRequest<SessionInput>,
) => {
  await transitionSession(request, 'connected');
});

export const closeSession = onCall<SessionInput>(async (request: CallableRequest<SessionInput>) => {
  await transitionSession(request, 'closed');
});

async function transitionSession(
  request: CallableRequest<SessionInput>,
  nextState: 'connected' | 'closed',
): Promise<void> {
  const uid = requireUid(request);
  const sessionId = parseDocumentId(request.data.sessionId, 'sessionId');
  await db.runTransaction(async (transaction: Transaction) => {
    const sessionRef = db.doc(`sessions/${sessionId}`);
    const snapshot = await transaction.get(sessionRef);
    if (!snapshot.exists) {
      throw new HttpsError('not-found', 'Co-op session not found.');
    }
    const members = readStrings(snapshot.data(), 'memberIds');
    if (!members.includes(uid)) {
      throw new HttpsError('permission-denied', 'You are not in this session.');
    }
    const current = readString(snapshot.data(), 'state');
    if (current === 'closed' || (nextState === 'connected' && current !== 'signaling')) {
      throw new HttpsError('failed-precondition', 'Invalid session state transition.');
    }
    transaction.update(sessionRef, {
      state: nextState,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

function requireUid<T>(request: CallableRequest<T>): string {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Anonymous sign-in is required.');
  }
  return request.auth.uid;
}

function requirePendingDocument(
  data: DocumentData | undefined,
  exists: boolean,
  label: string,
): DocumentData {
  if (!exists || !data) {
    throw new HttpsError('not-found', `${label} not found.`);
  }
  if (readString(data, 'status') !== 'pending') {
    throw new HttpsError('failed-precondition', `${label} is no longer pending.`);
  }
  return data;
}

function parseDisplayName(value: unknown): string {
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', 'Display name must be a string.');
  }
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length < 1 || normalized.length > DISPLAY_NAME_MAX_LENGTH) {
    throw new HttpsError('invalid-argument', 'Display name must be 1-24 characters.');
  }
  return normalized;
}

function parseFriendCode(value: unknown): string {
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', 'Friend code is required.');
  }
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const allowed = new RegExp(`^[${FRIEND_CODE_ALPHABET}]{${FRIEND_CODE_LENGTH}}$`);
  if (!allowed.test(normalized)) {
    throw new HttpsError('invalid-argument', 'Invalid friend code.');
  }
  return normalized;
}

function parseDocumentId(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new HttpsError('invalid-argument', `Invalid ${field}.`);
  }
  return value;
}

function parseLevelId(value: unknown): string {
  if (typeof value !== 'string' || !/^[1-8]-(?:[1-4]|\?)$/.test(value)) {
    throw new HttpsError('invalid-argument', 'Invalid level id.');
  }
  return value;
}

function parseFriendResponse(value: unknown): FriendRequestResponseInput['response'] {
  switch (value) {
    case 'accept':
    case 'decline':
      return value;
    default:
      throw new HttpsError('invalid-argument', 'Response must be accept or decline.');
  }
}

function parseInvitationResponse(value: unknown): InvitationResponseInput['response'] {
  switch (value) {
    case 'accept':
    case 'decline':
      return value;
    default:
      throw new HttpsError('invalid-argument', 'Response must be accept or decline.');
  }
}

function generateFriendCode(): string {
  const bytes = randomBytes(FRIEND_CODE_LENGTH);
  let result = '';
  for (const byte of bytes) {
    result += FRIEND_CODE_ALPHABET[byte % FRIEND_CODE_ALPHABET.length];
  }
  return result;
}

function pairId(left: string, right: string): string {
  return createHash('sha256').update(sortedPair(left, right).join('\0')).digest('hex');
}

function sortedPair(left: string, right: string): [string, string] {
  return left < right ? [left, right] : [right, left];
}

function readString(data: DocumentData | undefined, field: string): string {
  const value: unknown = data?.[field];
  if (typeof value !== 'string') {
    throw new HttpsError('internal', `Stored ${field} is invalid.`);
  }
  return value;
}

function readStrings(data: DocumentData | undefined, field: string): string[] {
  const value: unknown = data?.[field];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new HttpsError('internal', `Stored ${field} is invalid.`);
  }
  return value;
}

function readTimestamp(data: DocumentData | undefined, field: string): Timestamp {
  const value: unknown = data?.[field];
  if (!(value instanceof Timestamp)) {
    throw new HttpsError('internal', `Stored ${field} is invalid.`);
  }
  return value;
}
