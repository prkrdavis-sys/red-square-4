import { describe, expect, it } from 'vitest';
import { EMPTY_PLAYER_INPUT } from '../entities/player-input';
import { parseRuntimeMessage } from './protocol';

describe('co-op runtime protocol', () => {
  it('accepts a constructed snapshot and rejects partial ones', () => {
    const snapshot = {
      type: 'snapshot',
      sequence: 4,
      host: { x: 10, y: 20, velocityX: 1, velocityY: 2, flipX: false, alive: true },
      guest: { x: 30, y: 40, velocityX: -1, velocityY: 0, flipX: true, alive: true },
      lives: 3,
    };
    expect(parseRuntimeMessage(snapshot)).toEqual(snapshot);
    expect(parseRuntimeMessage({ type: 'snapshot', sequence: 1 })).toBeNull();
  });

  it('accepts a full input frame', () => {
    const message = { type: 'input', sequence: 9, input: { ...EMPTY_PLAYER_INPUT, left: true } };
    expect(parseRuntimeMessage(message)).toEqual(message);
  });

  it('requires a host/guest role on player-facing events', () => {
    expect(parseRuntimeMessage({ type: 'player-died', playerId: 'guest' })).toEqual({
      type: 'player-died',
      playerId: 'guest',
    });
    expect(parseRuntimeMessage({ type: 'player-died', playerId: 'firebase-uid' })).toBeNull();
    expect(parseRuntimeMessage({ type: 'special', playerId: 'host', direction: 1 })).toEqual({
      type: 'special',
      playerId: 'host',
      direction: 1,
    });
  });

  it('rejects unknown levels and leftover wire-protocol shapes', () => {
    expect(parseRuntimeMessage({ type: 'team-restart', levelId: '99-99' })).toBeNull();
    expect(parseRuntimeMessage({ type: 'join', version: 1, sessionId: 'room-1', displayName: 'Square' })).toBeNull();
    expect(parseRuntimeMessage('{bad json')).toBeNull();
  });
});
