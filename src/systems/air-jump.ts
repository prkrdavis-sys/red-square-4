import { JUMP_HEIGHT_TILES, launchVelocity, type Theme } from '../config';

export type AirJumpMode =
  | 'flower-spring'
  | 'triple-jump'
  | 'carpet-glide'
  | 'swim-stroke'
  | 'ghost-hover'
  | 'feather-flutter';

export type TripleJumpStep = 1 | 2 | 3;
export type TripleJumpChain = 0 | TripleJumpStep;

/** Mid-air swim stroke height. Weaker than the 2.5-tile ground jump. */
export const SWIM_STROKE_HEIGHT_TILES = 1.1;
export const SWIM_STROKE_COOLDOWN_MS = 140;
export const CARPET_GLIDE_DAMP = 0.82;
export const CARPET_GLIDE_MAX_FALL = 150;
export const CARPET_OFFSET_Y = 24;
export const CARPET_TRAIL_OFFSET_X = 30;

/** Mid-air flower hop. Weaker than the 2.5-tile ground jump. */
export const FLOWER_SPRING_HEIGHT_TILES = 2;
export const FLOWER_SPRING_OFFSET_Y = 26;
export const FLOWER_SPRING_LIFE_MS = 420;

export const TRIPLE_JUMP_WINDOW_MS = 450;
export const TRIPLE_JUMP_MIN_SPEED = 80;
export const TRIPLE_JUMP_HEIGHT_2_TILES = 3.2;
export const TRIPLE_JUMP_HEIGHT_3_TILES = 4.5;
export const ICE_SKATE_OFFSET_Y = 26;
export const ICE_FLASH_OFFSET_Y = 24;
export const ICE_FLASH_LIFE_MS = 420;

export const GHOST_HOVER_DAMP = 0.72;
export const GHOST_HOVER_MAX_FALL = 80;
export const GHOST_SHROUD_OFFSET_Y = 6;

export const FEATHER_FLUTTER_BASE_FALL = 100;
export const FEATHER_FLUTTER_AMP = 50;
export const FEATHER_FLUTTER_PERIOD_MS = 200;
export const FEATHER_LEAF_OFFSET_Y = 26;

export function airJumpMode(theme: Theme): AirJumpMode {
  switch (theme) {
    case 'grass':
      return 'flower-spring';
    case 'snow':
      return 'triple-jump';
    case 'desert':
      return 'carpet-glide';
    case 'ocean':
      return 'swim-stroke';
    case 'castle':
      return 'ghost-hover';
    case 'rainforest':
      return 'feather-flutter';
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

export function airJumpHint(theme: Theme): string {
  const mode = airJumpMode(theme);
  switch (mode) {
    case 'flower-spring':
      return 'Tap jump in the air to bounce on a flower spring.';
    case 'triple-jump':
      return 'Chain running jumps for a triple jump.';
    case 'swim-stroke':
      return 'Tap jump in the air to swim.';
    case 'carpet-glide':
      return 'Hold jump in the air to ride a flying carpet.';
    case 'ghost-hover':
      return 'Hold jump in the air to hover like a ghost.';
    case 'feather-flutter':
      return 'Hold jump in the air to flutter down.';
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

export function flowerSpringVelocity(gravity: number): number {
  return launchVelocity(gravity, FLOWER_SPRING_HEIGHT_TILES);
}

export function applyFlowerSpring(springVelocity: number): number {
  return springVelocity;
}

export function canFlowerSpring(args: {
  jumpLocked: boolean;
  grounded: boolean;
  jumpJust: boolean;
  used: boolean;
}): boolean {
  return !args.jumpLocked && !args.grounded && args.jumpJust && !args.used;
}

export function flowerSpringSpawn(x: number, y: number): { x: number; y: number } {
  return { x, y: y + FLOWER_SPRING_OFFSET_Y };
}

export function nextTripleJumpStep(args: {
  previousStep: TripleJumpChain;
  now: number;
  chainUntil: number;
  velocityX: number;
}): TripleJumpStep {
  const moving = Math.abs(args.velocityX) > TRIPLE_JUMP_MIN_SPEED;
  const inWindow = args.now <= args.chainUntil;
  if (!moving || !inWindow) {
    return 1;
  }
  switch (args.previousStep) {
    case 1:
      return 2;
    case 2:
      return 3;
    case 0:
    case 3:
      return 1;
    default: {
      const neverStep: never = args.previousStep;
      return neverStep;
    }
  }
}

export function tripleJumpHeightTiles(step: TripleJumpStep): number {
  switch (step) {
    case 1:
      return JUMP_HEIGHT_TILES;
    case 2:
      return TRIPLE_JUMP_HEIGHT_2_TILES;
    case 3:
      return TRIPLE_JUMP_HEIGHT_3_TILES;
    default: {
      const neverStep: never = step;
      return neverStep;
    }
  }
}

export function tripleJumpVelocity(gravity: number, step: TripleJumpStep): number {
  return launchVelocity(gravity, tripleJumpHeightTiles(step));
}

export function tripleChainLive(args: {
  chainStep: TripleJumpChain;
  now: number;
  chainUntil: number;
  grounded: boolean;
  velocityX: number;
}): boolean {
  if (args.chainStep === 0) {
    return false;
  }
  if (!args.grounded) {
    return true;
  }
  return args.now <= args.chainUntil && Math.abs(args.velocityX) > TRIPLE_JUMP_MIN_SPEED;
}

export function iceSkatePosition(x: number, y: number, now: number): { x: number; y: number } {
  return { x, y: y + ICE_SKATE_OFFSET_Y + Math.sin(now / 150) * 1.4 };
}

export function iceFlashSpawn(x: number, y: number): { x: number; y: number } {
  return { x, y: y + ICE_FLASH_OFFSET_Y };
}

export function canGhostHover(args: { jumpHeld: boolean; grounded: boolean; velocityY: number }): boolean {
  return args.jumpHeld && !args.grounded && args.velocityY > 40;
}

export function ghostHoverVelocity(velocityY: number): number {
  if (velocityY <= 0) {
    return velocityY;
  }
  return Math.min(velocityY * GHOST_HOVER_DAMP, GHOST_HOVER_MAX_FALL);
}

export function ghostShroudPosition(x: number, y: number, now: number): { x: number; y: number } {
  return { x, y: y + GHOST_SHROUD_OFFSET_Y + Math.sin(now / 160) * 2.4 };
}

export function canFeatherFlutter(args: { jumpHeld: boolean; grounded: boolean; velocityY: number }): boolean {
  return args.jumpHeld && !args.grounded && args.velocityY > 20;
}

export function featherFlutterVelocity(velocityY: number, now: number): number {
  if (velocityY <= 0) {
    return velocityY;
  }
  const phase = (now / FEATHER_FLUTTER_PERIOD_MS) * Math.PI * 2;
  const target = FEATHER_FLUTTER_BASE_FALL + Math.sin(phase) * FEATHER_FLUTTER_AMP;
  return Math.min(velocityY, Math.max(36, target));
}

export function featherLeafPosition(x: number, y: number, now: number): { x: number; y: number } {
  const beat = Math.sin((now / FEATHER_FLUTTER_PERIOD_MS) * Math.PI * 2);
  return { x, y: y + FEATHER_LEAF_OFFSET_Y + beat * 3.6 };
}
