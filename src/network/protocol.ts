export const COOP_PROTOCOL_VERSION = 1 as const;

export type PlayerId = 'host' | 'guest';

export interface InputFrame {
  sequence: number;
  clientTime: number;
  moveX: -1 | 0 | 1;
  jump: boolean;
  special: boolean;
}

export interface WirePlayerState {
  id: PlayerId;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  alive: boolean;
  animation: string;
  acknowledgedInput: number;
}

export interface JoinMessage {
  type: 'join';
  version: typeof COOP_PROTOCOL_VERSION;
  sessionId: string;
  displayName: string;
}

export interface InputMessage {
  type: 'input';
  sessionId: string;
  playerId: PlayerId;
  input: InputFrame;
}

export interface ClientReadyMessage {
  type: 'client-ready';
  sessionId: string;
  playerId: PlayerId;
}

export interface PingMessage {
  type: 'ping';
  sessionId: string;
  nonce: number;
  sentAt: number;
}

export type ClientToHostMessage = JoinMessage | InputMessage | ClientReadyMessage | PingMessage;

export interface WelcomeMessage {
  type: 'welcome';
  version: typeof COOP_PROTOCOL_VERSION;
  sessionId: string;
  assignedPlayerId: PlayerId;
  hostAuthoritative: true;
  serverTime: number;
}

export interface SnapshotMessage {
  type: 'snapshot';
  sessionId: string;
  tick: number;
  serverTime: number;
  players: readonly [WirePlayerState, WirePlayerState];
}

export interface TeamEventMessage {
  type: 'team-event';
  sessionId: string;
  eventId: string;
  event: 'checkpoint' | 'team-death' | 'reward';
  tick: number;
}

export interface PongMessage {
  type: 'pong';
  sessionId: string;
  nonce: number;
  sentAt: number;
  serverTime: number;
}

export interface RejectMessage {
  type: 'reject';
  code: 'full' | 'invalid-session' | 'version-mismatch' | 'unauthorized';
  message: string;
}

export type HostToClientMessage =
  | WelcomeMessage
  | SnapshotMessage
  | TeamEventMessage
  | PongMessage
  | RejectMessage;

export type WireMessage = ClientToHostMessage | HostToClientMessage;
export type WireDirection = 'client-to-host' | 'host-to-client';

const PLAYER_IDS: readonly PlayerId[] = ['host', 'guest'];
const TEAM_EVENTS: readonly TeamEventMessage['event'][] = ['checkpoint', 'team-death', 'reward'];
const REJECT_CODES: readonly RejectMessage['code'][] = [
  'full',
  'invalid-session',
  'version-mismatch',
  'unauthorized',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && isFiniteNumber(value) && value >= 0;
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function isPlayerId(value: unknown): value is PlayerId {
  return typeof value === 'string' && PLAYER_IDS.includes(value as PlayerId);
}

function isInputFrame(value: unknown): value is InputFrame {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isNonNegativeInteger(value.sequence) &&
    isFiniteNumber(value.clientTime) &&
    (value.moveX === -1 || value.moveX === 0 || value.moveX === 1) &&
    typeof value.jump === 'boolean' &&
    typeof value.special === 'boolean'
  );
}

function isWirePlayerState(value: unknown): value is WirePlayerState {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isPlayerId(value.id) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.velocityX) &&
    isFiniteNumber(value.velocityY) &&
    typeof value.alive === 'boolean' &&
    typeof value.animation === 'string' &&
    value.animation.length <= 64 &&
    isNonNegativeInteger(value.acknowledgedInput)
  );
}

function hasSessionId(value: Record<string, unknown>): boolean {
  return isBoundedString(value.sessionId, 128);
}

function isClientMessage(value: Record<string, unknown>): value is Record<string, unknown> & ClientToHostMessage {
  switch (value.type) {
    case 'join':
      return (
        value.version === COOP_PROTOCOL_VERSION &&
        hasSessionId(value) &&
        isBoundedString(value.displayName, 32)
      );
    case 'input':
      return hasSessionId(value) && isPlayerId(value.playerId) && isInputFrame(value.input);
    case 'client-ready':
      return hasSessionId(value) && isPlayerId(value.playerId);
    case 'ping':
      return (
        hasSessionId(value) &&
        isNonNegativeInteger(value.nonce) &&
        isFiniteNumber(value.sentAt)
      );
    default:
      return false;
  }
}

function isHostMessage(value: Record<string, unknown>): value is Record<string, unknown> & HostToClientMessage {
  switch (value.type) {
    case 'welcome':
      return (
        value.version === COOP_PROTOCOL_VERSION &&
        hasSessionId(value) &&
        isPlayerId(value.assignedPlayerId) &&
        value.hostAuthoritative === true &&
        isFiniteNumber(value.serverTime)
      );
    case 'snapshot': {
      if (
        !hasSessionId(value) ||
        !isNonNegativeInteger(value.tick) ||
        !isFiniteNumber(value.serverTime) ||
        !Array.isArray(value.players) ||
        value.players.length !== 2 ||
        !value.players.every(isWirePlayerState)
      ) {
        return false;
      }
      const ids = value.players.map((player) => player.id);
      return ids.includes('host') && ids.includes('guest');
    }
    case 'team-event':
      return (
        hasSessionId(value) &&
        isBoundedString(value.eventId, 128) &&
        typeof value.event === 'string' &&
        TEAM_EVENTS.includes(value.event as TeamEventMessage['event']) &&
        isNonNegativeInteger(value.tick)
      );
    case 'pong':
      return (
        hasSessionId(value) &&
        isNonNegativeInteger(value.nonce) &&
        isFiniteNumber(value.sentAt) &&
        isFiniteNumber(value.serverTime)
      );
    case 'reject':
      return (
        typeof value.code === 'string' &&
        REJECT_CODES.includes(value.code as RejectMessage['code']) &&
        isBoundedString(value.message, 256)
      );
    default:
      return false;
  }
}

export function parseWireMessage(value: unknown, direction: WireDirection): WireMessage | null {
  if (!isRecord(value)) {
    return null;
  }
  switch (direction) {
    case 'client-to-host':
      return isClientMessage(value) ? value : null;
    case 'host-to-client':
      return isHostMessage(value) ? value : null;
    default: {
      const exhaustive: never = direction;
      return exhaustive;
    }
  }
}

export function decodeWireMessage(raw: string, direction: WireDirection): WireMessage | null {
  try {
    return parseWireMessage(JSON.parse(raw) as unknown, direction);
  } catch {
    return null;
  }
}

export function encodeWireMessage(message: WireMessage): string {
  return JSON.stringify(message);
}
