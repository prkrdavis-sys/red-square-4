import type { InvitationStatus } from './models';

export const DISPLAY_NAME_MAX_LENGTH = 24;
export const FRIEND_CODE_LENGTH = 8;
const FRIEND_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const FRIEND_CODE_PATTERN = new RegExp(`^[${FRIEND_CODE_ALPHABET}]{${FRIEND_CODE_LENGTH}}$`);

export function normalizeFriendCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidFriendCode(value: string): boolean {
  return FRIEND_CODE_PATTERN.test(normalizeFriendCode(value));
}

export function parseFriendCode(value: string): string {
  const normalized = normalizeFriendCode(value);
  if (!FRIEND_CODE_PATTERN.test(normalized)) {
    throw new Error('Friend codes contain 8 letters or numbers and omit I, O, 0, and 1.');
  }
  return normalized;
}

export function sanitizeDisplayName(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length < 1 || normalized.length > DISPLAY_NAME_MAX_LENGTH) {
    throw new Error(`Display names must be 1-${DISPLAY_NAME_MAX_LENGTH} characters.`);
  }
  return normalized;
}

export function canTransitionInvitation(
  current: InvitationStatus,
  next: InvitationStatus,
): boolean {
  switch (current) {
    case 'pending':
      return next === 'accepted' || next === 'declined' || next === 'cancelled' || next === 'expired';
    case 'accepted':
    case 'declined':
    case 'cancelled':
    case 'expired':
      return false;
    default: {
      const exhaustive: never = current;
      return exhaustive;
    }
  }
}

export function otherMemberId(memberIds: readonly string[], ownUid: string): string {
  if (memberIds.length !== 2 || !memberIds.includes(ownUid)) {
    throw new Error('Expected a two-player membership containing the current user.');
  }
  const otherUid = memberIds.find((uid) => uid !== ownUid);
  if (!otherUid) {
    throw new Error('A player cannot form a co-op membership with themselves.');
  }
  return otherUid;
}
