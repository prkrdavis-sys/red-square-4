export { getFirebaseServices, type FirebaseServices } from './firebase-client';
export {
  observeFriends,
  observeIncomingFriendRequests,
  removeFriend,
  respondToFriendRequest,
  sendFriendRequest,
} from './friends';
export { ensureAnonymousIdentity, observeAuthenticatedUser } from './identity';
export {
  cancelInvitation,
  inviteFriend,
  observeInvitations,
  respondToInvitation,
} from './invitations';
export type {
  CoopSession,
  Friend,
  FriendRequest,
  GameInvitation,
  IceCandidatePayload,
  InvitationStatus,
  PublicProfile,
  SessionDescriptionPayload,
  SocialIdentity,
} from './models';
export {
  observePresence,
  startPresence,
  type PresenceHandle,
  type PresenceState,
} from './presence';
export {
  closeSession,
  observeRemoteIceCandidates,
  observeSession,
  observeSessionDescription,
  publishIceCandidate,
  publishSessionDescription,
  setSessionConnected,
} from './signaling';
export {
  canTransitionInvitation,
  isValidFriendCode,
  normalizeFriendCode,
  otherMemberId,
  parseFriendCode,
  sanitizeDisplayName,
} from './validation';
