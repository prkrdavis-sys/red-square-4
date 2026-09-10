import { describe, expect, it, vi } from 'vitest';
import { EMPTY_PLAYER_INPUT, type PlayerInput } from '../entities/player-input';
import type { RuntimeMessage, RuntimeTransport } from '../network/runtime-session';
import { CoopRuntime, type CoopRuntimeEvent } from './coop-runtime';

function transport(): {
  peer: RuntimeTransport;
  send: ReturnType<typeof vi.fn>;
  emit: (message: RuntimeMessage) => void;
} {
  const listeners = new Set<(message: RuntimeMessage) => void>();
  const send = vi.fn<(message: RuntimeMessage) => void>();
  return {
    send,
    emit: (message) => listeners.forEach((listener) => listener(message)),
    peer: {
      connected: true,
      send,
      close: vi.fn(),
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
  };
}

function runtime(role: 'host' | 'guest', peer: RuntimeTransport): CoopRuntime {
  return new CoopRuntime(
    {
      role,
      levelId: '1-1',
      localPlayerId: 'local-uid',
      remotePlayerId: 'remote-uid',
      localName: 'Local',
      remoteName: 'Friend',
      transport: peer,
    },
    { lives: 3, x: 64, y: 512 },
  );
}

const moving: PlayerInput = { ...EMPTY_PLAYER_INPUT, right: true };

describe('co-op runtime', () => {
  it('lets only the host ingest guest input', () => {
    const hostPeer = transport();
    const guestPeer = transport();
    const host = runtime('host', hostPeer.peer);
    const guest = runtime('guest', guestPeer.peer);
    host.subscribe(() => undefined);
    guest.subscribe(() => undefined);
    hostPeer.emit({ type: 'input', sequence: 1, input: moving });
    guestPeer.emit({ type: 'input', sequence: 1, input: moving });
    expect(host.takeRemoteInput().right).toBe(true);
    expect(guest.takeRemoteInput().right).toBe(false);
  });

  it('lets only the guest apply snapshots', () => {
    const events: CoopRuntimeEvent[] = [];
    const peer = transport();
    const host = runtime('host', peer.peer);
    host.subscribe((event) => events.push(event));
    const pose = { x: 8, y: 16, velocityX: 0, velocityY: 0, flipX: false, alive: true };
    peer.emit({ type: 'snapshot', sequence: 2, host: pose, guest: pose, lives: 2 });
    expect(events).toEqual([]);
  });

  it('deduplicates rewards through the team reducer', () => {
    const events: CoopRuntimeEvent[] = [];
    const peer = transport();
    const guest = runtime('guest', peer.peer);
    guest.subscribe((event) => events.push(event));
    const reward = { type: 'reward', eventId: '1-1:star:0', reward: 'star', index: 0 } as const;
    peer.emit(reward);
    peer.emit(reward);
    expect(events).toEqual([{ type: 'reward-star', index: 0 }]);
  });

  it('treats the second player-down as a team wipe', () => {
    const hostPeer = transport();
    const host = runtime('host', hostPeer.peer);
    expect(host.markPlayerDown('guest')).toBe('spectating');
    expect(host.markPlayerDown('host')).toBe('team-wipe');
    expect(host.spendTeamLife('host')).toBe('restart');
    expect(host.lives).toBe(2);
  });
});
