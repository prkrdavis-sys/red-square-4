import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  Timestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseServices } from './firebase-client';
import type { Friend, FriendRequest, PublicProfile } from './models';
import { otherMemberId, parseFriendCode } from './validation';

export function observeFriends(
  ownUid: string,
  listener: (friends: readonly Friend[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const { firestore } = getFirebaseServices();
  const friendships = query(
    collection(firestore, 'friendships'),
    where('memberIds', 'array-contains', ownUid),
  );
  return onSnapshot(friendships, (snapshot) => {
    void Promise.all(snapshot.docs.map(async (friendship) => {
      const otherUid = otherMemberId(readStringArray(friendship.data().memberIds), ownUid);
      const profileSnapshot = await getDoc(doc(firestore, 'profiles', otherUid));
      if (!profileSnapshot.exists()) {
        throw new Error(`Friend profile ${otherUid} is unavailable.`);
      }
      const data = profileSnapshot.data();
      const profile: PublicProfile = {
        uid: otherUid,
        displayName: readString(data.displayName, 'displayName'),
        friendCode: readString(data.friendCode, 'friendCode'),
      };
      return {
        friendshipId: friendship.id,
        profile,
        sinceMs: timestampMs(friendship.data().createdAt),
      };
    })).then(listener).catch((error: unknown) => onError?.(toError(error)));
  }, (error) => onError?.(error));
}

export function observeIncomingFriendRequests(
  ownUid: string,
  listener: (requests: readonly FriendRequest[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const { firestore } = getFirebaseServices();
  const requests = query(
    collection(firestore, 'friendRequests'),
    where('recipientUid', '==', ownUid),
    where('status', '==', 'pending'),
  );
  return onSnapshot(requests, (snapshot) => {
    listener(snapshot.docs.map((request) => {
      const data = request.data();
      return {
        id: request.id,
        senderUid: readString(data.senderUid, 'senderUid'),
        recipientUid: ownUid,
        senderDisplayName: readString(data.senderDisplayName, 'senderDisplayName'),
        status: 'pending',
        createdAtMs: timestampMs(data.createdAt),
      };
    }));
  }, (error) => onError?.(error));
}

export async function sendFriendRequest(friendCode: string): Promise<{ requestId: string }> {
  const callable = httpsCallable<{ friendCode: string }, { requestId: string }>(
    getFirebaseServices().functions,
    'sendFriendRequest',
  );
  return (await callable({ friendCode: parseFriendCode(friendCode) })).data;
}

export async function respondToFriendRequest(
  requestId: string,
  response: 'accept' | 'decline',
): Promise<void> {
  const callable = httpsCallable<{ requestId: string; response: 'accept' | 'decline' }, void>(
    getFirebaseServices().functions,
    'respondToFriendRequest',
  );
  await callable({ requestId, response });
}

export async function removeFriend(friendUid: string): Promise<void> {
  const callable = httpsCallable<{ friendUid: string }, void>(
    getFirebaseServices().functions,
    'removeFriend',
  );
  await callable({ friendUid });
}

function readString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Expected ${field} to be a string.`);
  }
  return value;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error('Expected memberIds to be a string array.');
  }
  return value;
}

function timestampMs(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null;
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
