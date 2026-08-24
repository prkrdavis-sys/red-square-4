export interface BossHurtbox {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

export interface SpriteOpaqueBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StompBody {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
  velocity: { y: number };
  /** Body displacement this frame. Negative Y is upward. */
  deltaY?: number;
}

/** How far past the enemy crown a previous-frame foot still counts as arriving from above. */
const STOMP_FROM_ABOVE_SLACK = 24;
/** Share of the player that must hang above the enemy top to look like a stomp. */
const STOMP_OVERHANG = 0.35;

interface StompMotionSource {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
  velocity: { y: number };
  deltaY(): number;
}

/** Shrink a sprite's opaque pixels into a torso-and-head hurtbox. */
export function hurtboxFromOpaque(bounds: SpriteOpaqueBounds): BossHurtbox {
  const insetX = bounds.width * 0.12;
  const insetTop = bounds.height * 0.02;
  const insetBottom = bounds.height * 0.06;
  return {
    width: Math.max(22, bounds.width - insetX * 2),
    height: Math.max(24, bounds.height - insetTop - insetBottom),
    offsetX: bounds.x + insetX,
    offsetY: bounds.y + insetTop,
  };
}

export function estimatedOpaqueBounds(frameW: number, frameH: number): SpriteOpaqueBounds {
  if (frameW >= 96) {
    return {
      x: frameW * 0.18,
      y: frameH * 0.24,
      width: frameW * 0.64,
      height: frameH * 0.76,
    };
  }
  return {
    x: frameW * 0.08,
    y: frameH * 0.1,
    width: frameW * 0.84,
    height: frameH * 0.86,
  };
}

export function stompBox(body: StompMotionSource): StompBody {
  return {
    top: body.top,
    bottom: body.bottom,
    left: body.left,
    right: body.right,
    width: body.width,
    height: body.height,
    velocity: body.velocity,
    deltaY: body.deltaY(),
  };
}

/**
 * Favor the player when they arrive from above. Side contact — including mid-air
 * clips against the torso — still hurts.
 */
export function isFallingStomp(player: StompBody, enemy: StompBody): boolean {
  const playerPrevBottom = player.bottom - (player.deltaY ?? 0);
  const enemyPrevTop = enemy.top - (enemy.deltaY ?? 0);
  if (playerPrevBottom <= enemyPrevTop + STOMP_FROM_ABOVE_SLACK) {
    return true;
  }
  return player.top + player.height * STOMP_OVERHANG <= enemy.top;
}

export type BossRhythm = 'waiting' | 'telegraph' | 'attack' | 'recovery';

/** A stomp only lands in recovery, and never during i-frames. */
export function stompBlocked(input: {
  dying: boolean;
  invulnerable: boolean;
  rhythm: BossRhythm;
}): boolean {
  return input.dying || input.invulnerable || input.rhythm !== 'recovery';
}

/** Crown guard is the "jump will bounce" tell once the fight has started. */
export function crownGuardVisible(input: {
  dying: boolean;
  engaged: boolean;
  invulnerable: boolean;
  rhythm: BossRhythm;
}): boolean {
  return input.engaged && !input.dying && stompBlocked(input);
}

export function crownGuardLayout(
  x: number,
  bodyTop: number,
  bodyWidth: number,
  now: number,
): { x: number; y: number; scale: number; alpha: number } {
  const pulse = 0.5 + 0.5 * Math.sin(now / 90);
  return {
    x,
    y: bodyTop + 8,
    scale: Math.max(0.88, bodyWidth / 68) * (0.94 + pulse * 0.1),
    alpha: 0.74 + pulse * 0.26,
  };
}
