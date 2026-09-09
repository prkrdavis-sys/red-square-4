import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ALL_LEVEL_IDS, type LevelId } from '../config';
import { getFirebaseServices } from './firebase-client';
import type {
  CoopSession,
  IceCandidatePayload,
  SessionDescriptionPayload,
} from './models';

export function observeSession(
  sessionId: string,
  listener: (session: CoopSession | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const session = doc(getFirebaseServices().firestore, 'sessions', sessionId);
  return onSnapshot(session, (snapshot) => {
    if (!snapshot.exists()) {
      listener(null);
      return;
    }
    const data = snapshot.data();
    listener({
      id: snapshot.id,
      hostUid: readString(data.hostUid, 'hostUid'),
      guestUid: readString(data.guestUid, 'guestUid'),
      memberIds: readStrings(data.memberIds, 'memberIds'),
      state: readSessionState(data.state),
      levelId: readLevelId(data.levelId),
    });
  }, (error) => onError?.(error));
}

export async function publishSessionDescription(
  sessionId: string,
  description: SessionDescriptionPayload,
): Promise<void> {
  const { firestore } = getFirebaseServices();
  await setDoc(doc(firestore, 'sessions', sessionId, 'signals', description.type), {
    type: description.type,
    sdp: description.sdp,
    senderUid: requireUid(),
    createdAt: serverTimestamp(),
  });
}

export function observeSessionDescription(
  sessionId: string,
  type: SessionDescriptionPayload['type'],
  listener: (description: SessionDescriptionPayload) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const signal = doc(getFirebaseServices().firestore, 'sessions', sessionId, 'signals', type);
  return onSnapshot(signal, (snapshot) => {
    if (!snapshot.exists()) {
      return;
    }
    const data = snapshot.data();
    listener({
      type: readDescriptionType(data.type),
      sdp: readString(data.sdp, 'sdp'),
    });
  }, (error) => onError?.(error));
}

export async function publishIceCandidate(
  sessionId: string,
  candidate: IceCandidatePayload,
): Promise<void> {
  const { firestore } = getFirebaseServices();
  const uid = requireUid();
  await addDoc(collection(firestore, 'sessions', sessionId, 'candidates', uid, 'items'), {
    ...candidate,
    senderUid: uid,
    createdAt: serverTimestamp(),
  });
}

export function observeRemoteIceCandidates(
  sessionId: string,
  remoteUid: string,
  listener: (candidate: IceCandidatePayload) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const candidates = collection(
    getFirebaseServices().firestore,
    'sessions',
    sessionId,
    'candidates',
    remoteUid,
    'items',
  );
  return onSnapshot(candidates, (snapshot) => {
    for (const change of snapshot.docChanges()) {
      if (change.type === 'added') {
        listener(readCandidate(change.doc.data()));
      }
    }
  }, (error) => onError?.(error));
}

export async function setSessionConnected(sessionId: string): Promise<void> {
  const callable = httpsCallable<{ sessionId: string }, void>(
    getFirebaseServices().functions,
    'markSessionConnected',
  );
  await callable({ sessionId });
}

export async function closeSession(sessionId: string): Promise<void> {
  const callable = httpsCallable<{ sessionId: string }, void>(
    getFirebaseServices().functions,
    'closeSession',
  );
  await callable({ sessionId });
}

function requireUid(): string {
  const uid = getFirebaseServices().auth.currentUser?.uid;
  if (!uid) {
    throw new Error('Sign in before using co-op signaling.');
  }
  return uid;
}

function readCandidate(data: DocumentData): IceCandidatePayload {
  return {
    candidate: readString(data.candidate, 'candidate'),
    sdpMid: readNullableString(data.sdpMid, 'sdpMid'),
    sdpMLineIndex: readNullableNumber(data.sdpMLineIndex, 'sdpMLineIndex'),
    usernameFragment: readNullableString(data.usernameFragment, 'usernameFragment'),
  };
}

function readDescriptionType(value: unknown): SessionDescriptionPayload['type'] {
  switch (value) {
    case 'offer':
    case 'answer':
      return value;
    default:
      throw new Error('Unknown session description type.');
  }
}

function readSessionState(value: unknown): CoopSession['state'] {
  switch (value) {
    case 'signaling':
    case 'connected':
    case 'closed':
      return value;
    default:
      throw new Error('Unknown co-op session state.');
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

function readNullableString(value: unknown, field: string): string | null {
  if (value === null || typeof value === 'string') {
    return value;
  }
  throw new Error(`Expected ${field} to be a string or null.`);
}

function readNullableNumber(value: unknown, field: string): number | null {
  if (value === null || typeof value === 'number') {
    return value;
  }
  throw new Error(`Expected ${field} to be a number or null.`);
}
