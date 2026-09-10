export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const TILE = 64;
export const MAP_ROWS = 12;
export const GROUND_Y = 9;
/** Held-jump peak height. A 2-tile ledge is reachable from the floor. */
export const JUMP_HEIGHT_TILES = 2.5;
/** Integer ledge step used by course layout. */
export const JUMP_REACH_TILES = 2;
/** Peak after stomping an enemy. */
export const STOMP_BOUNCE_HEIGHT_TILES = 4;

/** Riding platforms are a thin plate so the player reads their top edge clearly. */
export const MOVER_HEIGHT = 26;

/** Downward speed cap while pressing into a wall in mid-air. */
export const WALL_SLIDE_MAX_VY = 190;
/** Peak of a wall kick. Slightly under a ground jump so shafts still take several kicks. */
export const WALL_JUMP_HEIGHT_TILES = 2.2;
/** Horizontal kick away from the wall, as a fraction of the theme's max run speed. */
export const WALL_JUMP_KICK = 0.92;
/** Steering is ignored for this long after a kick so the player actually clears the wall. */
export const WALL_JUMP_LOCK_MS = 150;

/** Upward velocity that peaks at `heightTiles` under `gravity`. */
export function launchVelocity(gravity: number, heightTiles: number): number {
  return -Math.sqrt(2 * gravity * heightTiles * TILE);
}

export const STOMP_BOUNCE_VELOCITY = launchVelocity(1800, STOMP_BOUNCE_HEIGHT_TILES);
export const RANGED_ATTACK_RANGE = 620;

export const START_LIVES = 3;
export const MINI_BOSS_HP = 3;
export const WORLD_BOSS_HP = 5;

export type Theme = 'grass' | 'snow' | 'desert' | 'ocean' | 'castle' | 'rainforest' | 'beach' | 'rainy-city';

export const THEMES: Theme[] = ['grass', 'snow', 'desert', 'ocean', 'castle', 'rainforest', 'beach', 'rainy-city'];

export type BossKind = 'piranha' | 'walrus' | 'scorpion' | 'fish' | 'gargoyle' | 'howler' | 'crab' | 'sewer-croc';

export const BOSS_KINDS: BossKind[] = ['piranha', 'walrus', 'scorpion', 'fish', 'gargoyle', 'howler', 'crab', 'sewer-croc'];

export type EnemyKind =
  | 'bramble-hopper'
  | 'acorn-slinger'
  | 'skating-hare'
  | 'snowball-finch'
  | 'dune-scarab'
  | 'cactus-imp'
  | 'reef-crab'
  | 'bubble-archerfish'
  | 'clockwork-hound'
  | 'gargoyle-page'
  | 'howler-ape'
  | 'dart-mosquito'
  | 'hermit-crab'
  | 'starfish-slinger'
  | 'alley-cat'
  | 'umbrella-pigeon';

export type EnemyRole = 'movement' | 'ranged';

export type TerrainHazardKind =
  | 'bramble-vent'
  | 'glacier-bore'
  | 'needle-mortar'
  | 'sonar-well'
  | 'keep-burner'
  | 'pitcher-snare'
  | 'urchin-ball'
  | 'power-box';

export const TERRAIN_HAZARD_KINDS: TerrainHazardKind[] = [
  'bramble-vent',
  'glacier-bore',
  'needle-mortar',
  'sonar-well',
  'keep-burner',
  'pitcher-snare',
  'urchin-ball',
  'power-box',
];

export type SpecialKind =
  | 'grow'
  | 'frost-path'
  | 'sand-surge'
  | 'bubble-pulse'
  | 'shadow-blink'
  | 'liana-swing'
  | 'tide-wall'
  | 'lightning-pulse';

export type PuzzleKind =
  | 'vine-bed'
  | 'ice-wall'
  | 'sand-wall'
  | 'down-current'
  | 'shadow-wall'
  | 'moss-curtain'
  | 'driftwood-wall'
  | 'blackout-gate';

export type MiniBossVariant = 1 | 2 | 3;

export function specialForTheme(theme: Theme): SpecialKind {
  switch (theme) {
    case 'grass':
      return 'grow';
    case 'snow':
      return 'frost-path';
    case 'desert':
      return 'sand-surge';
    case 'ocean':
      return 'bubble-pulse';
    case 'castle':
      return 'shadow-blink';
    case 'rainforest':
      return 'liana-swing';
    case 'beach':
      return 'tide-wall';
    case 'rainy-city':
      return 'lightning-pulse';
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
    case 'beach':
      return 'driftwood-wall';
    case 'rainy-city':
      return 'blackout-gate';
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
    case 'hermit-crab':
    case 'alley-cat':
      return 'movement';
    case 'acorn-slinger':
    case 'snowball-finch':
    case 'cactus-imp':
    case 'bubble-archerfish':
    case 'gargoyle-page':
    case 'dart-mosquito':
    case 'starfish-slinger':
    case 'umbrella-pigeon':
      return 'ranged';
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

export function enemiesForWorld(world: number): readonly [EnemyKind, EnemyKind] {
  switch (world) {
    case 1:
      return ['bramble-hopper', 'acorn-slinger'];
    case 2:
      return ['skating-hare', 'snowball-finch'];
    case 3:
      return ['dune-scarab', 'cactus-imp'];
    case 4:
      return ['reef-crab', 'bubble-archerfish'];
    case 5:
      return ['clockwork-hound', 'gargoyle-page'];
    case 6:
      return ['howler-ape', 'dart-mosquito'];
    case 7:
      return ['hermit-crab', 'starfish-slinger'];
    case 8:
      return ['alley-cat', 'umbrella-pigeon'];
    default:
      return ['bramble-hopper', 'acorn-slinger'];
  }
}

export const ENEMY_KINDS: EnemyKind[] = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((world) => [...enemiesForWorld(world)]);

export function hazardForTheme(theme: Theme): TerrainHazardKind {
  switch (theme) {
    case 'grass':
      return 'bramble-vent';
    case 'snow':
      return 'glacier-bore';
    case 'desert':
      return 'needle-mortar';
    case 'ocean':
      return 'sonar-well';
    case 'castle':
      return 'keep-burner';
    case 'rainforest':
      return 'pitcher-snare';
    case 'beach':
      return 'urchin-ball';
    case 'rainy-city':
      return 'power-box';
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

export type CampaignLevelId =
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
  | '6-4'
  | '7-1'
  | '7-2'
  | '7-3'
  | '7-4'
  | '8-1'
  | '8-2'
  | '8-3'
  | '8-4';

export type SecretLevelId = '1-?' | '2-?' | '3-?' | '4-?' | '5-?' | '6-?';

export type LevelId = CampaignLevelId | SecretLevelId;

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
    case 'beach':
      return 0x5eb8fc;
    case 'rainy-city':
      return 0x111a32;
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

export function themePhysics(theme: Theme): ThemePhysics {
  switch (theme) {
    case 'grass': {
      const gravity = 1800;
      return { accel: 1800, maxSpeed: 290, groundDrag: 1800, gravity, jump: launchVelocity(gravity, JUMP_HEIGHT_TILES) };
    }
    case 'snow': {
      const gravity = 1800;
      return { accel: 700, maxSpeed: 320, groundDrag: 80, gravity, jump: launchVelocity(gravity, JUMP_HEIGHT_TILES) };
    }
    case 'desert': {
      const gravity = 1750;
      return { accel: 1700, maxSpeed: 300, groundDrag: 1600, gravity, jump: launchVelocity(gravity, JUMP_HEIGHT_TILES) };
    }
    case 'ocean': {
      const gravity = 980;
      return { accel: 1200, maxSpeed: 240, groundDrag: 900, gravity, jump: launchVelocity(gravity, JUMP_HEIGHT_TILES) };
    }
    case 'castle': {
      const gravity = 1950;
      return { accel: 1800, maxSpeed: 300, groundDrag: 1800, gravity, jump: launchVelocity(gravity, JUMP_HEIGHT_TILES) };
    }
    case 'rainforest': {
      const gravity = 1700;
      return { accel: 1700, maxSpeed: 300, groundDrag: 1400, gravity, jump: launchVelocity(gravity, JUMP_HEIGHT_TILES) };
    }
    case 'beach': {
      const gravity = 1800;
      return { accel: 1700, maxSpeed: 300, groundDrag: 1400, gravity, jump: launchVelocity(gravity, JUMP_HEIGHT_TILES) };
    }
    case 'rainy-city': {
      const gravity = 1850;
      return { accel: 1800, maxSpeed: 310, groundDrag: 1250, gravity, jump: launchVelocity(gravity, JUMP_HEIGHT_TILES) };
    }
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
    case 'beach':
      return 'Sunny Shore';
    case 'rainy-city':
      return 'Neon Downpour';
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

export function worldBossKind(world: number): BossKind {
  switch (world) {
    case 1:
      return 'piranha';
    case 2:
      return 'walrus';
    case 3:
      return 'scorpion';
    case 4:
      return 'fish';
    case 5:
      return 'gargoyle';
    case 6:
      return 'howler';
    case 7:
      return 'crab';
    case 8:
      return 'sewer-croc';
    default:
      return 'piranha';
  }
}

export function parseLevelId(id: LevelId): { world: number; stage: number; secret: boolean } {
  const [worldRaw, stageRaw] = id.split('-');
  const world = Number(worldRaw);
  if (stageRaw === '?') {
    return { world, stage: 0, secret: true };
  }
  return { world, stage: Number(stageRaw), secret: false };
}

export const CAMPAIGN_LEVEL_IDS: CampaignLevelId[] = [
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
  '7-1',
  '7-2',
  '7-3',
  '7-4',
  '8-1',
  '8-2',
  '8-3',
  '8-4',
];

export const SECRET_LEVEL_IDS: SecretLevelId[] = ['1-?', '2-?', '3-?', '4-?', '5-?', '6-?'];

export const ALL_LEVEL_IDS: LevelId[] = [...CAMPAIGN_LEVEL_IDS, ...SECRET_LEVEL_IDS];

export function isSecretLevel(id: LevelId): id is SecretLevelId {
  return (SECRET_LEVEL_IDS as readonly string[]).includes(id);
}

export function secretLevelId(world: number): SecretLevelId {
  const id = `${world}-?`;
  if ((SECRET_LEVEL_IDS as readonly string[]).includes(id)) {
    return id as SecretLevelId;
  }
  return '1-?';
}

export function stageThreeId(world: number): CampaignLevelId {
  return `${world}-3` as CampaignLevelId;
}

const SECRET_BOSS_NAMES: Record<number, string> = {
  1: 'Bramble Sovereign',
  2: 'Rime Colossus',
  3: 'Mirage Caliph',
  4: 'Tide Leviathan',
  5: 'Shade Seneschal',
  6: 'Moss Titan',
};

export function secretBossName(world: number): string {
  return SECRET_BOSS_NAMES[world] ?? 'Bramble Sovereign';
}
