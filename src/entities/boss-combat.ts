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

/** True only when the player is falling onto the top of the boss, not grazing a side. */
export function isBossHeadStomp(player: StompBody, boss: StompBody): boolean {
  if (player.velocity.y < 0) {
    return false;
  }
  const overlapX = Math.min(player.right, boss.right) - Math.max(player.left, boss.left);
  if (overlapX < player.width * 0.25) {
    return false;
  }
  const headBand = boss.top + boss.height * 0.34;
  return player.bottom <= headBand;
}
