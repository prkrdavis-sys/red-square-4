import type { LevelId } from '../config';
import type { RuntimeMessage } from './protocol';
import type { CoopRole } from './role';

export type { CoopRole, PlayerId } from './role';
export { otherRole } from './role';
export type { BossPose, PlayerPose, RuntimeMessage } from './protocol';
export { parseRuntimeMessage } from './protocol';

export interface RuntimeTransport {
  readonly connected: boolean;
  send(message: RuntimeMessage): void;
  subscribe(listener: (message: RuntimeMessage) => void): () => void;
  close(): void;
}

export interface CoopRuntimeSession {
  role: CoopRole;
  levelId: LevelId;
  localPlayerId: string;
  remotePlayerId: string;
  localName: string;
  remoteName: string;
  transport: RuntimeTransport;
}

let activeSession: CoopRuntimeSession | undefined;

export function setActiveCoopSession(session: CoopRuntimeSession): void {
  activeSession?.transport.close();
  activeSession = session;
}

export function getActiveCoopSession(): CoopRuntimeSession | undefined {
  return activeSession;
}

export function clearActiveCoopSession(reason = 'session-ended'): void {
  const session = activeSession;
  activeSession = undefined;
  if (!session) {
    return;
  }
  if (session.transport.connected) {
    session.transport.send({ type: 'leave', reason });
  }
  session.transport.close();
}
