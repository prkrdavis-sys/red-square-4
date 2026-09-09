import type { LevelId } from '../config';

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';

export interface SocialIdentity {
  uid: string;
  friendCode: string;
  displayName: string;
  isAnonymous: boolean;
}

export interface PublicProfile {
  uid: string;
  displayName: string;
  friendCode: string;
}

export interface Friend {
  friendshipId: string;
  profile: PublicProfile;
  sinceMs: number | null;
}

export interface FriendRequest {
  id: string;
  senderUid: string;
  recipientUid: string;
  senderDisplayName: string;
  status: 'pending';
  createdAtMs: number | null;
}

export interface GameInvitation {
  id: string;
  fromUid: string;
  toUid: string;
  participantIds: readonly string[];
  status: InvitationStatus;
  sessionId: string | null;
  levelId: LevelId;
  createdAtMs: number | null;
  expiresAtMs: number | null;
}

export interface CoopSession {
  id: string;
  hostUid: string;
  guestUid: string;
  memberIds: readonly string[];
  state: 'signaling' | 'connected' | 'closed';
  levelId: LevelId;
}

export interface SessionDescriptionPayload {
  type: 'offer' | 'answer';
  sdp: string;
}

export interface IceCandidatePayload {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  usernameFragment: string | null;
}
