import { describe, expect, it } from 'vitest';
import {
  canTransitionInvitation,
  isValidFriendCode,
  normalizeFriendCode,
  otherMemberId,
  parseFriendCode,
  sanitizeDisplayName,
} from './validation';

describe('friend codes', () => {
  it('normalizes display formatting', () => {
    expect(normalizeFriendCode('ab3d-ef7h')).toBe('AB3DEF7H');
    expect(parseFriendCode('ab3d-ef7h')).toBe('AB3DEF7H');
  });

  it('rejects ambiguous and malformed codes', () => {
    expect(isValidFriendCode('ABCDOI01')).toBe(false);
    expect(() => parseFriendCode('short')).toThrow();
  });
});

describe('social validation', () => {
  it('sanitizes display names', () => {
    expect(sanitizeDisplayName('  Red   Square  ')).toBe('Red Square');
    expect(() => sanitizeDisplayName('   ')).toThrow();
  });

  it('only permits invitation transitions from pending', () => {
    expect(canTransitionInvitation('pending', 'accepted')).toBe(true);
    expect(canTransitionInvitation('pending', 'cancelled')).toBe(true);
    expect(canTransitionInvitation('accepted', 'cancelled')).toBe(false);
  });

  it('finds the other co-op member', () => {
    expect(otherMemberId(['one', 'two'], 'one')).toBe('two');
    expect(() => otherMemberId(['one'], 'one')).toThrow();
    expect(() => otherMemberId(['one', 'one'], 'one')).toThrow();
  });
});
