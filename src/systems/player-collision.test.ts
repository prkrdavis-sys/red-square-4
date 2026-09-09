import { describe, expect, it } from 'vitest';
import {
  classifyPlayerCollision,
  isPlayerCollisionReady,
  playerCollisionCooldownMs,
  prunePlayerCollisionCooldowns,
  startPlayerCollisionCooldown,
  type PlayerCollisionBody,
} from './player-collision';

function body(
  id: PlayerCollisionBody['id'],
  overrides: Partial<PlayerCollisionBody> = {},
): PlayerCollisionBody {
  return {
    id,
    x: 0,
    y: 0,
    width: 64,
    height: 64,
    velocityX: 0,
    velocityY: 0,
    ...overrides,
  };
}

describe('player collision classification', () => {
  it('classifies a descending player as the stomper', () => {
    const result = classifyPlayerCollision(
      body('host', { y: 0, velocityY: 120 }),
      body('guest', { y: 50 }),
    );
    expect(result.kind).toBe('host-stomps-guest');
  });

  it('classifies fast horizontal contact as a side bump', () => {
    const result = classifyPlayerCollision(
      body('host', { x: -30, velocityX: 50 }),
      body('guest', { x: 30, velocityX: -50 }),
    );
    expect(result.kind).toBe('side-bump');
  });

  it('separates resting overlaps and ignores disjoint bodies', () => {
    expect(classifyPlayerCollision(body('host'), body('guest', { x: 10 })).kind).toBe(
      'separate',
    );
    expect(classifyPlayerCollision(body('host'), body('guest', { x: 100 })).kind).toBe('none');
  });
});

describe('player collision cooldowns', () => {
  it('stores pair cooldowns independent of player order', () => {
    const cooldowns = startPlayerCollisionCooldown({}, 'host', 'guest', 1_000, 120);
    expect(isPlayerCollisionReady(cooldowns, 'guest', 'host', 1_119)).toBe(false);
    expect(isPlayerCollisionReady(cooldowns, 'host', 'guest', 1_120)).toBe(true);
  });

  it('chooses cooldown duration by collision class and prunes expired pairs', () => {
    expect(playerCollisionCooldownMs('host-stomps-guest')).toBe(180);
    expect(playerCollisionCooldownMs('side-bump')).toBe(120);
    expect(playerCollisionCooldownMs('none')).toBe(0);
    const cooldowns = startPlayerCollisionCooldown({}, 'host', 'guest', 100, 40);
    expect(prunePlayerCollisionCooldowns(cooldowns, 139)).not.toEqual({});
    expect(prunePlayerCollisionCooldowns(cooldowns, 140)).toEqual({});
  });
});
