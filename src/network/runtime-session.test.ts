import { describe, expect, it, vi } from 'vitest';
import { parseRuntimeMessage } from './protocol';
import {
  clearActiveCoopSession,
  getActiveCoopSession,
  otherRole,
  setActiveCoopSession,
  type CoopRuntimeSession,
  type RuntimeMessage,
  type RuntimeTransport,
} from './runtime-session';

function transport(): {
  peer: RuntimeTransport;
  close: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
} {
  const close = vi.fn();
  const send = vi.fn<(message: RuntimeMessage) => void>();
  return {
    close,
    send,
    peer: {
      connected: true,
      close,
      send,
      subscribe: vi.fn(() => () => undefined),
    },
  };
}

function session(peer: RuntimeTransport, role: 'host' | 'guest' = 'host'): CoopRuntimeSession {
  return {
    role,
    levelId: '1-1',
    localPlayerId: role,
    remotePlayerId: otherRole(role),
    localName: 'Local',
    remoteName: 'Friend',
    transport: peer,
  };
}

describe('runtime co-op session', () => {
  it('replaces and closes an existing session', () => {
    const first = transport();
    const second = transport();
    setActiveCoopSession(session(first.peer));
    setActiveCoopSession(session(second.peer, 'guest'));
    expect(first.close).toHaveBeenCalledOnce();
    expect(getActiveCoopSession()?.role).toBe('guest');
    clearActiveCoopSession();
  });

  it('notifies the peer before closing', () => {
    const peer = transport();
    setActiveCoopSession(session(peer.peer));
    clearActiveCoopSession('back-to-lobby');
    expect(peer.send).toHaveBeenCalledWith({ type: 'leave', reason: 'back-to-lobby' });
    expect(peer.close).toHaveBeenCalledOnce();
    expect(getActiveCoopSession()).toBeUndefined();
  });

  it('maps both roles exhaustively', () => {
    expect(otherRole('host')).toBe('guest');
    expect(otherRole('guest')).toBe('host');
  });

  it('rejects malformed peer messages', () => {
    expect(parseRuntimeMessage({ type: 'snapshot', sequence: 1 })).toBeNull();
    expect(parseRuntimeMessage({ type: 'team-restart', levelId: '99-99' })).toBeNull();
    expect(parseRuntimeMessage('{bad json')).toBeNull();
  });
});
