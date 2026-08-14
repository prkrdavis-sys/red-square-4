export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const TILE = 64;
export const MAP_ROWS = 12;
export const GROUND_Y = 9;
/** Full jump peak is just over 2 tiles, so ledges must step by this much. */
export const JUMP_REACH_TILES = 2;

export const START_LIVES = 3;

export type Theme = 'grass' | 'snow' | 'desert' | 'ocean' | 'castle';

export type BossKind = 'hopper' | 'slider' | 'slam' | 'swimmer' | 'charger';

export type LevelId =
  | '1-1'
  | '1-2'
  | '1-3'
  | '1-4'
  | '2-1'
  | '2-2'
  | '2-3'
  | '2-4'
  | '3-1'
  | '3-2'
  | '3-3'
  | '3-4'
  | '4-1'
  | '4-2'
  | '4-3'
  | '4-4'
  | '5-1'
  | '5-2'
  | '5-3'
  | '5-4';

export interface ThemePhysics {
  accel: number;
  maxSpeed: number;
  groundDrag: number;
  gravity: number;
  jump: number;
}

export function themeSky(theme: Theme): number {
  switch (theme) {
    case 'grass':
      return 0x5c94fc;
    case 'snow':
      return 0xc5dcf0;
    case 'desert':
      return 0xf0c27b;
    case 'ocean':
      return 0x145a78;
    case 'castle':
      return 0x140e1c;
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

export function themePhysics(theme: Theme): ThemePhysics {
  switch (theme) {
    case 'grass':
      return { accel: 1800, maxSpeed: 290, groundDrag: 1800, gravity: 1800, jump: -720 };
    case 'snow':
      return { accel: 700, maxSpeed: 320, groundDrag: 80, gravity: 1800, jump: -720 };
    case 'desert':
      return { accel: 1700, maxSpeed: 300, groundDrag: 1600, gravity: 1750, jump: -740 };
    case 'ocean':
      return { accel: 1200, maxSpeed: 240, groundDrag: 900, gravity: 980, jump: -560 };
    case 'castle':
      return { accel: 1800, maxSpeed: 300, groundDrag: 1800, gravity: 1950, jump: -740 };
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

export function themeName(theme: Theme): string {
  switch (theme) {
    case 'grass':
      return 'Meadow Hills';
    case 'snow':
      return 'Frosted Peaks';
    case 'desert':
      return 'Sunken Dunes';
    case 'ocean':
      return 'Deep Current';
    case 'castle':
      return 'Dread Keep';
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

export function worldBossKind(world: number): BossKind {
  switch (world) {
    case 1:
      return 'hopper';
    case 2:
      return 'slider';
    case 3:
      return 'slam';
    case 4:
      return 'swimmer';
    case 5:
      return 'charger';
    default:
      return 'hopper';
  }
}

export function parseLevelId(id: LevelId): { world: number; stage: number } {
  const [worldRaw, stageRaw] = id.split('-');
  return { world: Number(worldRaw), stage: Number(stageRaw) };
}

export const ALL_LEVEL_IDS: LevelId[] = [
  '1-1',
  '1-2',
  '1-3',
  '1-4',
  '2-1',
  '2-2',
  '2-3',
  '2-4',
  '3-1',
  '3-2',
  '3-3',
  '3-4',
  '4-1',
  '4-2',
  '4-3',
  '4-4',
  '5-1',
  '5-2',
  '5-3',
  '5-4',
];
