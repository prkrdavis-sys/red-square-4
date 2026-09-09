import { describe, expect, it } from 'vitest';
import {
  COOP_PROTOCOL_VERSION,
  decodeWireMessage,
  encodeWireMessage,
  parseWireMessage,
  type SnapshotMessage,
} from './protocol';

const snapshot: SnapshotMessage = {
  type: 'snapshot',
  sessionId: 'room-1',
  tick: 42,
  serverTime: 1_000,
  players: [
    {
      id: 'host',
      x: 10,
      y: 20,
      velocityX: 1,
      velocityY: 2,
      alive: true,
      animation: 'run',
      acknowledgedInput: 8,
    },
    {
      id: 'guest',
      x: 30,
      y: 40,
      velocityX: -1,
      velocityY: 0,
      alive: true,
      animation: 'idle',
      acknowledgedInput: 5,
    },
  ],
};

describe('co-op wire protocol', () => {
  it('round-trips a valid host snapshot', () => {
    expect(decodeWireMessage(encodeWireMessage(snapshot), 'host-to-client')).toEqual(snapshot);
  });

  it('accepts valid client input', () => {
    const message = {
      type: 'input',
      sessionId: 'room-1',
      playerId: 'guest',
      input: {
        sequence: 9,
        clientTime: 990,
        moveX: -1,
        jump: true,
        special: false,
      },
    };
    expect(parseWireMessage(message, 'client-to-host')).toEqual(message);
  });

  it('enforces message direction and protocol version', () => {
    expect(parseWireMessage(snapshot, 'client-to-host')).toBeNull();
    expect(
      parseWireMessage(
        {
          type: 'join',
          version: COOP_PROTOCOL_VERSION + 1,
          sessionId: 'room-1',
          displayName: 'Square',
        },
        'client-to-host',
      ),
    ).toBeNull();
  });

  it('requires exactly one state for each player', () => {
    const duplicateHost = {
      ...snapshot,
      players: [snapshot.players[0], snapshot.players[0]],
    };
    expect(parseWireMessage(duplicateHost, 'host-to-client')).toBeNull();
  });

  it('rejects non-finite gameplay data and malformed JSON', () => {
    const invalid = {
      ...snapshot,
      players: [{ ...snapshot.players[0], x: Number.NaN }, snapshot.players[1]],
    };
    expect(parseWireMessage(invalid, 'host-to-client')).toBeNull();
    expect(decodeWireMessage('{bad json', 'host-to-client')).toBeNull();
  });
});
