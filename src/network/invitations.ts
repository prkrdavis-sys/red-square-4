import {
  collection,
  onSnapshot,
  query,
  Timestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ALL_LEVEL_IDS, type LevelId } from '../config';
import { getFirebaseServices } from './firebase-client';
import type { CoopSession, GameInvitation, InvitationStatus } from './models';

export function observeInvitations(
  ownUid: string,
  listener: (invitations: readonly GameInvitation[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const { firestore } = getFirebaseServices();
  const invitations = query(
    collection(firestore, 'invitations'),
    where('participantIds', 'array-contains', ownUid),
  );
  return onSnapshot(invitations, (snapshot) => {
    const values = snapshot.docs.map((invitation) => {
      const data = invitation.data();
      return {
        id: invitation.id,
        fromUid: readString(data.fromUid, 'fromUid'),
        toUid: readString(data.toUid, 'toUid'),
        participantIds: readStrings(data.participantIds, 'participantIds'),
        status: readStatus(data.status),
        sessionId: typeof data.sessionId === 'string' ? data.sessionId : null,
        levelId: readLevelId(data.levelId),
        createdAtMs: timestampMs(data.createdAt),
        expiresAtMs: timestampMs(data.expiresAt),
      };
    });
    values.sort((left, right) => (right.createdAtMs ?? 0) - (left.createdAtMs ?? 0));
    listener(values);
  }, (error) => onError?.(error));
}

export async function inviteFriend(friendUid: string, levelId: LevelId): Promise<{ invitationId: string }> {
  const callable = httpsCallable<{ friendUid: string; levelId: LevelId }, { invitationId: string }>(
    getFirebaseServices().functions,
    'sendGameInvitation',
  );
  return (await callable({ friendUid, levelId })).data;
}

export async function respondToInvitation(
  invitationId: string,
  response: 'accept' | 'decline',
): Promise<CoopSession | null> {
  const callable = httpsCallable<
    { invitationId: string; response: 'accept' | 'decline' },
    { session: CoopSession | null }
  >(getFirebaseServices().functions, 'respondToGameInvitation');
  return (await callable({ invitationId, response })).data.session;
}

export async function cancelInvitation(invitationId: string): Promise<void> {
  const callable = httpsCallable<{ invitationId: string }, void>(
    getFirebaseServices().functions,
    'cancelGameInvitation',
  );
  await callable({ invitationId });
}

function readStatus(value: unknown): InvitationStatus {
  switch (value) {
    case 'pending':
    case 'accepted':
    case 'declined':
    case 'cancelled':
    case 'expired':
      return value;
    default:
      throw new Error('Unknown invitation status.');
  }
}

function readLevelId(value: unknown): LevelId {
  if (typeof value === 'string' && (ALL_LEVEL_IDS as readonly string[]).includes(value)) {
    return value as LevelId;
  }
  throw new Error('Unknown level id.');
}

function readString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Expected ${field} to be a string.`);
  }
  return value;
}

function readStrings(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Expected ${field} to be a string array.`);
  }
  return value;
}

function timestampMs(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null;
}
