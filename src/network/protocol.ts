import { ALL_LEVEL_IDS, type LevelId } from '../config';
import type { PlayerInput } from '../entities/player-input';
import { isPlayerId, type PlayerId } from './role';

const PLAYER_INPUT_KEYS: readonly (keyof PlayerInput)[] = [
  'left',
  'right',
  'jump',
  'jumpJust',
  'down',
  'downJust',
  'special',
  'specialJust',
];

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
  | { type: 'checkpoint'; x: number; y: number }
  | { type: 'player-impact'; kind: 'side' | 'head'; upperPlayerId?: PlayerId }
  | { type: 'player-died'; playerId: PlayerId }
  | { type: 'special'; playerId: PlayerId; direction: -1 | 1 }
  | { type: 'reward'; eventId: string; reward: 'coin' | 'star'; index?: number }
  | { type: 'team-restart'; levelId: LevelId }
  | { type: 'level-complete'; levelId: LevelId; completionId: string }
  | { type: 'leave'; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isLevelId(value: unknown): value is LevelId {
  return typeof value === 'string' && (ALL_LEVEL_IDS as readonly string[]).includes(value);
}

function parsePlayerInput(value: unknown): PlayerInput | null {
  if (!isRecord(value)) {
    return null;
  }
  if (!PLAYER_INPUT_KEYS.every((key) => typeof value[key] === 'boolean')) {
    return null;
  }
  return {
    left: value.left as boolean,
    right: value.right as boolean,
    jump: value.jump as boolean,
    jumpJust: value.jumpJust as boolean,
    down: value.down as boolean,
    downJust: value.downJust as boolean,
    special: value.special as boolean,
    specialJust: value.specialJust as boolean,
  };
}

function parsePlayerPose(value: unknown): PlayerPose | null {
  if (
    !isRecord(value) ||
    !isFiniteNumber(value.x) ||
    !isFiniteNumber(value.y) ||
    !isFiniteNumber(value.velocityX) ||
    !isFiniteNumber(value.velocityY) ||
    typeof value.flipX !== 'boolean' ||
    typeof value.alive !== 'boolean'
  ) {
    return null;
  }
  return {
    x: value.x,
    y: value.y,
    velocityX: value.velocityX,
    velocityY: value.velocityY,
    flipX: value.flipX,
    alive: value.alive,
  };
}

function parseBossPose(value: unknown): BossPose | null {
  if (
    !isRecord(value) ||
    !isFiniteNumber(value.x) ||
    !isFiniteNumber(value.y) ||
    !isFiniteNumber(value.velocityX) ||
    !isFiniteNumber(value.velocityY) ||
    !isFiniteNumber(value.hp) ||
    typeof value.engaged !== 'boolean' ||
    typeof value.active !== 'boolean'
  ) {
    return null;
  }
  return {
    x: value.x,
    y: value.y,
    velocityX: value.velocityX,
    velocityY: value.velocityY,
    hp: value.hp,
    engaged: value.engaged,
    active: value.active,
  };
}

export function parseRuntimeMessage(value: unknown): RuntimeMessage | null {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return null;
  }
  switch (value.type) {
    case 'input': {
      const input = parsePlayerInput(value.input);
      return isFiniteNumber(value.sequence) && input
        ? { type: 'input', sequence: value.sequence, input }
        : null;
    }
    case 'snapshot': {
      const host = parsePlayerPose(value.host);
      const guest = parsePlayerPose(value.guest);
      const boss = value.boss === undefined ? undefined : parseBossPose(value.boss);
      if (
        !isFiniteNumber(value.sequence) ||
        !host ||
        !guest ||
        !isFiniteNumber(value.lives) ||
        boss === null
      ) {
        return null;
      }
      return { type: 'snapshot', sequence: value.sequence, host, guest, lives: value.lives, boss };
    }
    case 'checkpoint':
      return isFiniteNumber(value.x) && isFiniteNumber(value.y)
        ? { type: 'checkpoint', x: value.x, y: value.y }
        : null;
    case 'player-impact':
      return value.kind === 'side' || value.kind === 'head'
        ? {
            type: 'player-impact',
            kind: value.kind,
            upperPlayerId: isPlayerId(value.upperPlayerId) ? value.upperPlayerId : undefined,
          }
        : null;
    case 'player-died':
      return isPlayerId(value.playerId) ? { type: 'player-died', playerId: value.playerId } : null;
    case 'special':
      return (
        isPlayerId(value.playerId) &&
        (value.direction === -1 || value.direction === 1)
      )
        ? { type: 'special', playerId: value.playerId, direction: value.direction }
        : null;
    case 'reward':
      return (
        typeof value.eventId === 'string' &&
        (value.reward === 'coin' || value.reward === 'star') &&
        (value.index === undefined || isFiniteNumber(value.index))
      )
        ? {
            type: 'reward',
            eventId: value.eventId,
            reward: value.reward,
            index: value.index,
          }
        : null;
    case 'team-restart':
      return isLevelId(value.levelId) ? { type: 'team-restart', levelId: value.levelId } : null;
    case 'level-complete':
      return isLevelId(value.levelId) && typeof value.completionId === 'string'
        ? { type: 'level-complete', levelId: value.levelId, completionId: value.completionId }
        : null;
    case 'leave':
      return typeof value.reason === 'string' ? { type: 'leave', reason: value.reason } : null;
    default:
      return null;
  }
}
