import {
  launchVelocity,
  TILE,
  WALL_JUMP_HEIGHT_TILES,
  WALL_JUMP_KICK,
  WALL_SLIDE_MAX_VY,
} from '../config';

/** Which wall the player is pressed against: -1 for a wall on the left, 1 on the right. */
export type WallSide = -1 | 0 | 1;

export function wallContactSide(args: {
  grounded: boolean;
  touchingLeft: boolean;
  touchingRight: boolean;
  holdLeft: boolean;
  holdRight: boolean;
}): WallSide {
  if (args.grounded) {
    return 0;
  }
  if (args.touchingLeft && args.holdLeft) {
    return -1;
  }
  if (args.touchingRight && args.holdRight) {
    return 1;
  }
  return 0;
}

/** Sliding only damps a fall; a rising player keeps their upward speed. */
export function wallSlideVelocity(velocityY: number): number {
  if (velocityY <= 0) {
    return velocityY;
  }
  return Math.min(velocityY, WALL_SLIDE_MAX_VY);
}

export function canWallJump(args: {
  jumpLocked: boolean;
  jumpJust: boolean;
  side: WallSide;
  lastSide: WallSide;
}): boolean {
  return !args.jumpLocked && args.jumpJust && args.side !== 0 && args.side !== args.lastSide;
}

/** Kicks up and away from `side`. A wall on the left throws the player right. */
export function wallJumpVelocity(
  gravity: number,
  maxSpeed: number,
  side: -1 | 1,
): { x: number; y: number } {
  return {
    x: -side * maxSpeed * WALL_JUMP_KICK,
    y: launchVelocity(gravity, WALL_JUMP_HEIGHT_TILES),
  };
}

/** Height in tiles gained by one kick. Motifs use this to size shaft climbs. */
export function wallJumpClimbTiles(): number {
  return WALL_JUMP_HEIGHT_TILES;
}

/**
 * Widest shaft the player can zig-zag up, in tiles. A kick must carry them to the
 * opposite wall before the arc peaks, otherwise they fall out of the shaft.
 */
export function wallJumpShaftMaxTiles(gravity: number, maxSpeed: number): number {
  const kick = maxSpeed * WALL_JUMP_KICK;
  const timeToApex = Math.abs(launchVelocity(gravity, WALL_JUMP_HEIGHT_TILES)) / gravity;
  return (kick * timeToApex) / TILE;
}
