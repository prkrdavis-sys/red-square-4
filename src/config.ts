export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const TILE = 64;
export const MAP_ROWS = 12;
export const GROUND_Y = 9;
/** Full jump peak is just over 2 tiles, so ledges must step by this much. */
export const JUMP_REACH_TILES = 2;
export const STOMP_BOUNCE_VELOCITY = -840;
export const RANGED_ATTACK_RANGE = 620;
export const TERRAIN_ATTACK_RANGE = 420;

export const START_LIVES = 3;

export type Theme = 'grass' | 'snow' | 'desert' | 'ocean' | 'castle' | 'rainforest';

export const THEMES: Theme[] = ['grass', 'snow', 'desert', 'ocean', 'castle', 'rainforest'];

export type BossKind = 'hopper' | 'slider' | 'slam' | 'swimmer' | 'charger' | 'swinger';

export type EnemyKind =
  | 'bramble-hopper'
  | 'acorn-slinger'
  | 'mossback-beetle'
  | 'skating-hare'
  | 'snowball-finch'
  | 'frost-mole'
  | 'dune-scarab'
  | 'cactus-imp'
  | 'sandwyrm'
  | 'reef-crab'
  | 'bubble-archerfish'
  | 'angler-eel'
  | 'clockwork-hound'
  | 'gargoyle-page'
  | 'wall-mimic'
  | 'howler-ape'
  | 'dart-mosquito'
  | 'coil-serpent';

export type EnemyRole = 'movement' | 'ranged' | 'terrain';

export type SpecialKind = 'grow' | 'ice-slide' | 'burrow' | 'bubble-pulse' | 'shadow-blink' | 'liana-swing';

export type PuzzleKind = 'vine-bed' | 'ice-wall' | 'sand-wall' | 'down-current' | 'shadow-wall' | 'moss-curtain';

export type MiniBossVariant = 1 | 2 | 3;

export function specialForTheme(theme: Theme): SpecialKind {
  switch (theme) {
    case 'grass':
      return 'grow';
    case 'snow':
      return 'ice-slide';
    case 'desert':
      return 'burrow';
    case 'ocean':
      return 'bubble-pulse';
    case 'castle':
      return 'shadow-blink';
    case 'rainforest':
      return 'liana-swing';
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

export function puzzleForTheme(theme: Theme): PuzzleKind {
  switch (theme) {
    case 'grass':
      return 'vine-bed';
    case 'snow':
      return 'ice-wall';
    case 'desert':
      return 'sand-wall';
    case 'ocean':
      return 'down-current';
    case 'castle':
      return 'shadow-wall';
    case 'rainforest':
      return 'moss-curtain';
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

export function enemyRole(kind: EnemyKind): EnemyRole {
  switch (kind) {
    case 'bramble-hopper':
    case 'skating-hare':
    case 'dune-scarab':
    case 'reef-crab':
    case 'clockwork-hound':
    case 'howler-ape':
      return 'movement';
    case 'acorn-slinger':
    case 'snowball-finch':
    case 'cactus-imp':
    case 'bubble-archerfish':
    case 'gargoyle-page':
    case 'dart-mosquito':
      return 'ranged';
    case 'mossback-beetle':
    case 'frost-mole':
    case 'sandwyrm':
    case 'angler-eel':
    case 'wall-mimic':
    case 'coil-serpent':
      return 'terrain';
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

export function enemyAttackRange(kind: EnemyKind): number {
  const role = enemyRole(kind);
  switch (role) {
    case 'ranged':
      return RANGED_ATTACK_RANGE;
    case 'terrain':
      return TERRAIN_ATTACK_RANGE;
    case 'movement':
      return 0;
    default: {
      const neverRole: never = role;
      return neverRole;
    }
  }
}

export function enemyThreatensTile(kind: EnemyKind, enemyTileX: number, originTileX: number): boolean {
  const range = enemyAttackRange(kind);
  return range > 0 && Math.abs(enemyTileX - originTileX) * TILE < range;
}

export function enemiesForWorld(world: number): readonly [EnemyKind, EnemyKind, EnemyKind] {
  switch (world) {
    case 1:
      return ['bramble-hopper', 'acorn-slinger', 'mossback-beetle'];
    case 2:
      return ['skating-hare', 'snowball-finch', 'frost-mole'];
    case 3:
      return ['dune-scarab', 'cactus-imp', 'sandwyrm'];
    case 4:
      return ['reef-crab', 'bubble-archerfish', 'angler-eel'];
    case 5:
      return ['clockwork-hound', 'gargoyle-page', 'wall-mimic'];
    case 6:
      return ['howler-ape', 'dart-mosquito', 'coil-serpent'];
    default:
      return ['bramble-hopper', 'acorn-slinger', 'mossback-beetle'];
  }
}

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
  | '5-4'
  | '6-1'
  | '6-2'
  | '6-3'
  | '6-4';

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
    case 'rainforest':
      return 0x1e4a3c;
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
    case 'rainforest':
      return { accel: 1700, maxSpeed: 300, groundDrag: 1400, gravity: 1700, jump: -730 };
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
    case 'rainforest':
      return 'Canopy Deep';
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
    case 6:
      return 'swinger';
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
  '6-1',
  '6-2',
  '6-3',
  '6-4',
];
