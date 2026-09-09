import { ALL_LEVEL_IDS, type LevelId } from '../config';
import type { PlayerInput } from '../entities/Player';

export type CoopRole = 'host' | 'guest';

export interface PlayerPose {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  flipX: boolean;
  alive: boolean;
}

export interface BossPose {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  hp: number;
  engaged: boolean;
  active: boolean;
}

export type RuntimeMessage =
  | { type: 'input'; sequence: number; input: PlayerInput }
  | {
      type: 'snapshot';
      sequence: number;
      host: PlayerPose;
      guest: PlayerPose;
      lives: number;
      boss?: BossPose;
    }
  | { type: 'checkpoint'; x: number; y: number; revivedPlayerId?: string }
  | { type: 'player-impact'; kind: 'side' | 'head'; upperPlayerId?: string }
  | { type: 'player-died'; playerId: string }
  | { type: 'special'; playerId: string; direction: -1 | 1 }
  | { type: 'reward'; eventId: string; reward: 'coin' | 'star'; index?: number }
  | { type: 'team-restart'; levelId: LevelId }
  | { type: 'level-complete'; levelId: LevelId; completionId: string }
  | { type: 'leave'; reason: string };

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPlayerInput(value: unknown): value is PlayerInput {
  return isRecord(value) && [
    'left',
    'right',
    'jump',
    'jumpJust',
    'down',
    'downJust',
    'special',
    'specialJust',
  ].every((key) => typeof value[key] === 'boolean');
}

function isPlayerPose(value: unknown): value is PlayerPose {
  return (
    isRecord(value) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.velocityX) &&
    isFiniteNumber(value.velocityY) &&
    typeof value.flipX === 'boolean' &&
    typeof value.alive === 'boolean'
  );
}

function isBossPose(value: unknown): value is BossPose {
  return (
    isRecord(value) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.velocityX) &&
    isFiniteNumber(value.velocityY) &&
    isFiniteNumber(value.hp) &&
    typeof value.engaged === 'boolean' &&
    typeof value.active === 'boolean'
  );
}

function isLevelId(value: unknown): value is LevelId {
  return typeof value === 'string' && (ALL_LEVEL_IDS as readonly string[]).includes(value);
}

export function parseRuntimeMessage(value: unknown): RuntimeMessage | null {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return null;
  }
  switch (value.type) {
    case 'input':
      return isFiniteNumber(value.sequence) && isPlayerInput(value.input)
        ? value as unknown as RuntimeMessage
        : null;
    case 'snapshot':
      return (
        isFiniteNumber(value.sequence) &&
        isPlayerPose(value.host) &&
        isPlayerPose(value.guest) &&
        isFiniteNumber(value.lives) &&
        (value.boss === undefined || isBossPose(value.boss))
      ) ? value as unknown as RuntimeMessage : null;
    case 'checkpoint':
      return isFiniteNumber(value.x) && isFiniteNumber(value.y)
        ? value as unknown as RuntimeMessage
        : null;
    case 'player-impact':
      return value.kind === 'side' || value.kind === 'head'
        ? value as unknown as RuntimeMessage
        : null;
    case 'player-died':
      return typeof value.playerId === 'string' ? value as unknown as RuntimeMessage : null;
    case 'special':
      return (
        typeof value.playerId === 'string' &&
        (value.direction === -1 || value.direction === 1)
      ) ? value as unknown as RuntimeMessage : null;
    case 'reward':
      return (
        typeof value.eventId === 'string' &&
        (value.reward === 'coin' || value.reward === 'star') &&
        (value.index === undefined || isFiniteNumber(value.index))
      ) ? value as unknown as RuntimeMessage : null;
    case 'team-restart':
      return isLevelId(value.levelId) ? value as unknown as RuntimeMessage : null;
    case 'level-complete':
      return isLevelId(value.levelId) && typeof value.completionId === 'string'
        ? value as unknown as RuntimeMessage
        : null;
    case 'leave':
      return typeof value.reason === 'string' ? value as unknown as RuntimeMessage : null;
    default:
      return null;
  }
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

export function otherRole(role: CoopRole): CoopRole {
  switch (role) {
    case 'host':
      return 'guest';
    case 'guest':
      return 'host';
    default: {
      const neverRole: never = role;
      return neverRole;
    }
  }
}
