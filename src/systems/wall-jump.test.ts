import { describe, expect, it } from 'vitest';
import {
  JUMP_HEIGHT_TILES,
  THEMES,
  WALL_JUMP_HEIGHT_TILES,
  WALL_SLIDE_MAX_VY,
  launchVelocity,
  themePhysics,
} from '../config';
import {
  canWallJump,
  wallContactSide,
  wallJumpClimbTiles,
  wallJumpShaftMaxTiles,
  wallJumpVelocity,
  wallSlideVelocity,
} from './wall-jump';

describe('wall contact', () => {
  it('only grabs a wall the player is actively pressing into', () => {
    const base = { grounded: false, touchingLeft: true, touchingRight: false, holdLeft: false, holdRight: false };
    expect(wallContactSide(base)).toBe(0);
    expect(wallContactSide({ ...base, holdLeft: true })).toBe(-1);
    expect(wallContactSide({ ...base, holdRight: true })).toBe(0);
  });

  it('lets go of the wall the moment the player lands', () => {
    expect(
      wallContactSide({
        grounded: true,
        touchingLeft: true,
        touchingRight: false,
        holdLeft: true,
        holdRight: false,
      }),
    ).toBe(0);
  });
});

describe('wall slide', () => {
  it('caps a fall without slowing a rise', () => {
    expect(wallSlideVelocity(900)).toBe(WALL_SLIDE_MAX_VY);
    expect(wallSlideVelocity(40)).toBe(40);
    expect(wallSlideVelocity(-600)).toBe(-600);
  });
});

describe('wall jump', () => {
  it('refuses a second kick off the same wall', () => {
    const args = { jumpLocked: false, jumpJust: true, side: -1 as const };
    expect(canWallJump({ ...args, lastSide: 0 })).toBe(true);
    expect(canWallJump({ ...args, lastSide: -1 })).toBe(false);
    expect(canWallJump({ ...args, lastSide: 1 })).toBe(true);
  });

  it('needs a fresh press and an unlocked jump', () => {
    expect(canWallJump({ jumpLocked: true, jumpJust: true, side: 1, lastSide: 0 })).toBe(false);
    expect(canWallJump({ jumpLocked: false, jumpJust: false, side: 1, lastSide: 0 })).toBe(false);
    expect(canWallJump({ jumpLocked: false, jumpJust: true, side: 0, lastSide: 0 })).toBe(false);
  });

  it('throws the player up and away from the wall', () => {
    const physics = themePhysics('grass');
    const left = wallJumpVelocity(physics.gravity, physics.maxSpeed, -1);
    const right = wallJumpVelocity(physics.gravity, physics.maxSpeed, 1);
    expect(left.x).toBeGreaterThan(0);
    expect(right.x).toBeLessThan(0);
    expect(left.y).toBeLessThan(0);
    expect(left.y).toBe(right.y);
  });

  it('kicks lower than a ground jump so a shaft takes several climbs', () => {
    expect(wallJumpClimbTiles()).toBeLessThan(JUMP_HEIGHT_TILES);
    for (const theme of THEMES) {
      const physics = themePhysics(theme);
      const kick = wallJumpVelocity(physics.gravity, physics.maxSpeed, 1);
      expect(Math.abs(kick.y), theme).toBeLessThan(Math.abs(physics.jump));
      expect(kick.y, theme).toBe(launchVelocity(physics.gravity, WALL_JUMP_HEIGHT_TILES));
    }
  });

  it('crosses at least a tile of shaft on every theme', () => {
    for (const theme of THEMES) {
      const physics = themePhysics(theme);
      expect(wallJumpShaftMaxTiles(physics.gravity, physics.maxSpeed), theme).toBeGreaterThan(1);
    }
  });
});
