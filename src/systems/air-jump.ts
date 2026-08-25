import { launchVelocity, type Theme } from '../config';

export type AirJumpMode = 'none' | 'swim-stroke' | 'carpet-glide';

/** Mid-air swim stroke height. Weaker than the 2.5-tile ground jump. */
export const SWIM_STROKE_HEIGHT_TILES = 1.1;
export const SWIM_STROKE_COOLDOWN_MS = 140;
export const CARPET_GLIDE_DAMP = 0.82;
export const CARPET_GLIDE_MAX_FALL = 150;
export const CARPET_OFFSET_Y = 24;
export const CARPET_TRAIL_OFFSET_X = 30;

export function airJumpMode(theme: Theme): AirJumpMode {
  switch (theme) {
    case 'ocean':
      return 'swim-stroke';
    case 'desert':
      return 'carpet-glide';
    case 'grass':
    case 'snow':
    case 'castle':
    case 'rainforest':
      return 'none';
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

export function airJumpHint(theme: Theme): string | null {
  const mode = airJumpMode(theme);
  switch (mode) {
    case 'swim-stroke':
      return 'Tap jump in the air to swim.';
    case 'carpet-glide':
      return 'Hold jump in the air to ride a flying carpet.';
    case 'none':
      return null;
    default: {
      const neverMode: never = mode;
      return neverMode;
    }
  }
}

export function swimStrokeVelocity(gravity: number): number {
  return launchVelocity(gravity, SWIM_STROKE_HEIGHT_TILES);
}

/** Replace vertical speed with one swim stroke. Cancels a fall and caps upward speed. */
export function applySwimStroke(strokeVelocity: number): number {
  return strokeVelocity;
}

export function canSwimStroke(args: {
  jumpLocked: boolean;
  grounded: boolean;
  jumpJust: boolean;
  now: number;
  strokeReadyAt: number;
}): boolean {
  return !args.jumpLocked && !args.grounded && args.jumpJust && args.now >= args.strokeReadyAt;
}

export function canCarpetGlide(args: { jumpHeld: boolean; grounded: boolean; velocityY: number }): boolean {
  return args.jumpHeld && !args.grounded && args.velocityY > 40;
}

export function carpetGlideVelocity(velocityY: number): number {
  if (velocityY <= 0) {
    return velocityY;
  }
  return Math.min(velocityY * CARPET_GLIDE_DAMP, CARPET_GLIDE_MAX_FALL);
}

export function flyingCarpetPosition(x: number, y: number, now: number): { x: number; y: number } {
  return { x, y: y + CARPET_OFFSET_Y + Math.sin(now / 140) * 2.2 };
}

export function carpetTrailPosition(x: number, y: number, flipX: boolean): { x: number; y: number } {
  const facing = flipX ? -1 : 1;
  return { x: x - facing * CARPET_TRAIL_OFFSET_X, y };
}
