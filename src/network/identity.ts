import { onAuthStateChanged, signInAnonymously, type Unsubscribe, type User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseServices } from './firebase-client';
import type { SocialIdentity } from './models';
import { sanitizeDisplayName } from './validation';

interface EnsureProfileRequest {
  displayName?: string;
}

interface EnsureProfileResponse {
  friendCode: string;
  displayName: string;
}

export async function ensureAnonymousIdentity(displayName?: string): Promise<SocialIdentity> {
  const { auth, functions } = getFirebaseServices();
  const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
  const ensureProfile = httpsCallable<EnsureProfileRequest, EnsureProfileResponse>(
    functions,
    'ensureProfile',
  );
  const request = displayName === undefined
    ? {}
    : { displayName: sanitizeDisplayName(displayName) };
  const profile = (await ensureProfile(request)).data;
  return toIdentity(user, profile);
}

export function observeAuthenticatedUser(
  listener: (user: User | null) => void,
): Unsubscribe {
  return onAuthStateChanged(getFirebaseServices().auth, listener);
}

function toIdentity(user: User, profile: EnsureProfileResponse): SocialIdentity {
  return {
    uid: user.uid,
    friendCode: profile.friendCode,
    displayName: profile.displayName,
    isAnonymous: user.isAnonymous,
  };
}
