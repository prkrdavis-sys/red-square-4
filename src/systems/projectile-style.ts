import type { EnemyKind, Theme } from '../config';

export type ProjectileStyle = 'thorn' | 'icicle' | 'cactus' | 'bubble' | 'fireball' | 'boomerang';

export const BUBBLE_SHOT_SPEED = 130;
export const FIREBALL_SHOT_SPEED = 100;
export const FIREBALL_MAX_TURN_RAD_PER_SEC = (105 * Math.PI) / 180;
export const FIREBALL_SEEK_FOLLOW_PER_SEC = 8;
export const BOOMERANG_SHOT_SPEED = 180;
export const BOOMERANG_OUTBOUND_MS = 820;
export const BOOMERANG_RETURN_RANGE = 280;
export const BOOMERANG_CATCH_RADIUS = 28;
export const BOOMERANG_LIFETIME_MS = 6500;
export const DEFAULT_PROJECTILE_LIFETIME_MS = 5200;

const BUBBLE_SPREAD_RAD = (16 * Math.PI) / 180;

export function projectileStyleForTheme(theme: Theme): ProjectileStyle {
  switch (theme) {
    case 'grass':
      return 'thorn';
    case 'snow':
      return 'icicle';
    case 'desert':
      return 'cactus';
    case 'ocean':
      return 'bubble';
    case 'castle':
      return 'fireball';
    case 'rainforest':
      return 'boomerang';
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

export function projectileStyleForKind(kind: EnemyKind): ProjectileStyle {
  switch (kind) {
    case 'bramble-hopper':
    case 'acorn-slinger':
      return 'thorn';
    case 'skating-hare':
    case 'snowball-finch':
      return 'icicle';
    case 'dune-scarab':
    case 'cactus-imp':
      return 'cactus';
    case 'reef-crab':
    case 'bubble-archerfish':
      return 'bubble';
    case 'clockwork-hound':
    case 'gargoyle-page':
      return 'fireball';
    case 'howler-ape':
    case 'dart-mosquito':
      return 'boomerang';
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

export function usesTerrainArc(style: ProjectileStyle): boolean {
  switch (style) {
    case 'thorn':
    case 'icicle':
    case 'cactus':
      return true;
    case 'bubble':
    case 'fireball':
    case 'boomerang':
      return false;
    default: {
      const neverStyle: never = style;
      return neverStyle;
    }
  }
}

export function projectileFlightSpeed(style: ProjectileStyle, terrainShot: boolean): number {
  switch (style) {
    case 'bubble':
      return BUBBLE_SHOT_SPEED;
    case 'fireball':
      return FIREBALL_SHOT_SPEED;
    case 'boomerang':
      return BOOMERANG_SHOT_SPEED;
    case 'thorn':
    case 'icicle':
    case 'cactus':
      return terrainShot ? 145 : 165;
    default: {
      const neverStyle: never = style;
      return neverStyle;
    }
  }
}

export function projectileLifetimeMs(style: ProjectileStyle): number {
  switch (style) {
    case 'boomerang':
      return BOOMERANG_LIFETIME_MS;
    case 'thorn':
    case 'icicle':
    case 'cactus':
    case 'bubble':
    case 'fireball':
      return DEFAULT_PROJECTILE_LIFETIME_MS;
    default: {
      const neverStyle: never = style;
      return neverStyle;
    }
  }
}

export function bubbleSpreadOffsets(): readonly [number, number, number] {
  return [-BUBBLE_SPREAD_RAD, 0, BUBBLE_SPREAD_RAD];
}

export function steerToward(
  vx: number,
  vy: number,
  toX: number,
  toY: number,
  maxTurnRad: number,
  speed: number,
): { vx: number; vy: number } {
  const current = Math.atan2(vy, vx);
  const desired = Math.atan2(toY, toX);
  let delta = desired - current;
  while (delta > Math.PI) {
    delta -= Math.PI * 2;
  }
  while (delta < -Math.PI) {
    delta += Math.PI * 2;
  }
  const turned = current + Math.max(-maxTurnRad, Math.min(maxTurnRad, delta));
  return {
    vx: Math.cos(turned) * speed,
    vy: Math.sin(turned) * speed,
  };
}

export function boomerangHomeVelocity(
  x: number,
  y: number,
  ownerX: number,
  ownerY: number,
  speed: number,
): { vx: number; vy: number } {
  const dx = ownerX - x;
  const dy = ownerY - y;
  const magnitude = Math.max(1, Math.hypot(dx, dy));
  return {
    vx: (dx / magnitude) * speed,
    vy: (dy / magnitude) * speed,
  };
}
