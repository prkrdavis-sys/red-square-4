import { describe, expect, it } from 'vitest';
import { BACKROOMS_LEVEL_ID, GROUND_Y, TILE, themePhysics } from '../config';
import { getLevel } from '../levels/worlds';
import {
  chaseSpeed,
  climbLipX,
  dreadLevel,
  ENTITY_BASE_RATIO,
  ENTITY_BOOST_RATIO,
  ENTITY_FAR_PX,
  ENTITY_NEAR_PX,
  footstepLoudness,
  pitOutcome,
  respawnColumn,
  shouldLeap,
  tileAheadOf,
} from './backrooms-chase';

const playerMax = themePhysics('backrooms').maxSpeed;

describe('stalker speed', () => {
  it('cruises a little slower than the player when close', () => {
    expect(chaseSpeed(TILE, playerMax)).toBeCloseTo(playerMax * ENTITY_BASE_RATIO);
    expect(chaseSpeed(-ENTITY_NEAR_PX, playerMax)).toBeLessThan(playerMax);
  });

  it('boosts past player speed once it falls far behind', () => {
    expect(chaseSpeed(ENTITY_FAR_PX * 2, playerMax)).toBeCloseTo(playerMax * ENTITY_BOOST_RATIO);
    expect(chaseSpeed(ENTITY_FAR_PX, playerMax)).toBeGreaterThan(playerMax);
  });

  it('ramps smoothly between the two', () => {
    const mid = chaseSpeed((ENTITY_NEAR_PX + ENTITY_FAR_PX) / 2, playerMax);
    expect(mid).toBeGreaterThan(chaseSpeed(ENTITY_NEAR_PX, playerMax));
    expect(mid).toBeLessThan(chaseSpeed(ENTITY_FAR_PX, playerMax));
  });
});

describe('stalker leaps and pits', () => {
  const rows = getLevel(BACKROOMS_LEVEL_ID).rows;
  const chase = getLevel(BACKROOMS_LEVEL_ID).course.chase!;

  it('leaps walls but never a pit', () => {
    expect(shouldLeap('wall')).toBe(true);
    expect(shouldLeap('floor')).toBe(false);
    expect(shouldLeap('pit')).toBe(false);
  });

  it('reads pillars, pits, and floor from the compiled rows', () => {
    const [pitX] = chase.trapPits[0]!;
    expect(tileAheadOf(rows, pitX - 1, 1, GROUND_Y)).toBe('pit');
    expect(tileAheadOf(rows, 27, 1, GROUND_Y)).toBe('wall');
    expect(tileAheadOf(rows, 20, 1, GROUND_Y)).toBe('floor');
  });

  it('climbs out of trap pits and is gone for good in the void pit', () => {
    const [trapX, trapW] = chase.trapPits[1]!;
    expect(pitOutcome(trapX, chase.trapPits, chase.voidPit)).toBe('climb');
    expect(pitOutcome(trapX + trapW - 1, chase.trapPits, chase.voidPit)).toBe('climb');
    expect(pitOutcome(chase.voidPit[0] + 1, chase.trapPits, chase.voidPit)).toBe('gone');
    expect(pitOutcome(20, chase.trapPits, chase.voidPit)).toBe('none');
  });

  it('claws up the lip facing its target', () => {
    expect(climbLipX([38, 3], 1)).toBe(41 * TILE);
    expect(climbLipX([38, 3], -1)).toBe(38 * TILE);
  });

  it('respawns on floor well behind a checkpoint, never over a pit', () => {
    for (const checkpoint of getLevel(BACKROOMS_LEVEL_ID).course.checkpoints) {
      const x = respawnColumn(rows, checkpoint.x);
      expect(x).toBeLessThanOrEqual(checkpoint.x - 11);
      expect(rows[GROUND_Y]?.[x]).toBe('#');
      expect(rows[GROUND_Y - 1]?.[x]).toBe('.');
    }
  });

  it('gets louder as it closes in', () => {
    expect(footstepLoudness(TILE)).toBeGreaterThan(footstepLoudness(TILE * 10));
    expect(footstepLoudness(TILE * 100)).toBeGreaterThan(0);
    expect(footstepLoudness(0)).toBe(1);
  });

  it('builds dread as the gap closes and lets go once it is gone', () => {
    expect(dreadLevel(undefined)).toBe(0);
    expect(dreadLevel(TILE * 30)).toBe(0);
    expect(dreadLevel(-TILE)).toBe(1);
    expect(dreadLevel(TILE * 6)).toBeGreaterThan(dreadLevel(TILE * 10));
  });
});
