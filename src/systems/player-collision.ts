import type { PlayerId } from '../network/protocol';

export interface PlayerCollisionBody {
  id: PlayerId;
  x: number;
  y: number;
  width: number;
  height: number;
  velocityX: number;
  velocityY: number;
}

export interface PlayerCollisionRules {
  minimumStompSpeed: number;
  maximumStompOverlap: number;
  minimumBumpSpeed: number;
  stompCooldownMs: number;
  bumpCooldownMs: number;
  separationCooldownMs: number;
}

export type PlayerCollisionKind =
  | 'none'
  | 'host-stomps-guest'
  | 'guest-stomps-host'
  | 'side-bump'
  | 'separate';

export interface PlayerCollisionResult {
  kind: PlayerCollisionKind;
  overlapX: number;
  overlapY: number;
}

export type CollisionCooldowns = Readonly<Record<string, number>>;

export const DEFAULT_PLAYER_COLLISION_RULES: PlayerCollisionRules = {
  minimumStompSpeed: 80,
  maximumStompOverlap: 20,
  minimumBumpSpeed: 60,
  stompCooldownMs: 180,
  bumpCooldownMs: 120,
  separationCooldownMs: 40,
};

function collisionPairKey(first: PlayerId, second: PlayerId): string {
  return first < second ? `${first}:${second}` : `${second}:${first}`;
}

export function classifyPlayerCollision(
  first: PlayerCollisionBody,
  second: PlayerCollisionBody,
  rules: PlayerCollisionRules = DEFAULT_PLAYER_COLLISION_RULES,
): PlayerCollisionResult {
  const overlapX = (first.width + second.width) / 2 - Math.abs(first.x - second.x);
  const overlapY = (first.height + second.height) / 2 - Math.abs(first.y - second.y);
  if (overlapX <= 0 || overlapY <= 0) {
    return { kind: 'none', overlapX: Math.max(0, overlapX), overlapY: Math.max(0, overlapY) };
  }

  const relativeVelocityY = first.velocityY - second.velocityY;
  if (
    first.y < second.y &&
    relativeVelocityY >= rules.minimumStompSpeed &&
    overlapY <= rules.maximumStompOverlap
  ) {
    return {
      kind: first.id === 'host' ? 'host-stomps-guest' : 'guest-stomps-host',
      overlapX,
      overlapY,
    };
  }
  if (
    second.y < first.y &&
    -relativeVelocityY >= rules.minimumStompSpeed &&
    overlapY <= rules.maximumStompOverlap
  ) {
    return {
      kind: second.id === 'host' ? 'host-stomps-guest' : 'guest-stomps-host',
      overlapX,
      overlapY,
    };
  }

  const relativeVelocityX = Math.abs(first.velocityX - second.velocityX);
  return {
    kind: relativeVelocityX >= rules.minimumBumpSpeed ? 'side-bump' : 'separate',
    overlapX,
    overlapY,
  };
}

export function playerCollisionCooldownMs(
  kind: PlayerCollisionKind,
  rules: PlayerCollisionRules = DEFAULT_PLAYER_COLLISION_RULES,
): number {
  switch (kind) {
    case 'none':
      return 0;
    case 'host-stomps-guest':
    case 'guest-stomps-host':
      return rules.stompCooldownMs;
    case 'side-bump':
      return rules.bumpCooldownMs;
    case 'separate':
      return rules.separationCooldownMs;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

export function isPlayerCollisionReady(
  cooldowns: CollisionCooldowns,
  first: PlayerId,
  second: PlayerId,
  now: number,
): boolean {
  return now >= (cooldowns[collisionPairKey(first, second)] ?? Number.NEGATIVE_INFINITY);
}

export function startPlayerCollisionCooldown(
  cooldowns: CollisionCooldowns,
  first: PlayerId,
  second: PlayerId,
  now: number,
  durationMs: number,
): CollisionCooldowns {
  return {
    ...cooldowns,
    [collisionPairKey(first, second)]: now + Math.max(0, durationMs),
  };
}

export function prunePlayerCollisionCooldowns(
  cooldowns: CollisionCooldowns,
  now: number,
): CollisionCooldowns {
  return Object.fromEntries(Object.entries(cooldowns).filter(([, expiresAt]) => expiresAt > now));
}
