import {
  TILE,
  hazardForTheme,
  type TerrainHazardKind,
  type Theme,
} from '../config';

export type TerrainHazardMount = 'ground' | 'hill';

export interface TerrainHazardSpawn {
  x: number;
  kind: TerrainHazardKind;
  mount: TerrainHazardMount;
  facing: -1 | 1;
  tilesHigh: number;
}

export const SHOTGUN_OFFSETS_DEG = [-60, -30, 0, 30, 60] as const;
export const ICE_BEAM_TILES = 7;
export const FLAME_JET_TILES = 3;
export const SONAR_COLUMN_TILES = 6;
export const SHOTGUN_FALLOUT_TILES = 3;
export const MORTAR_SHOTS = [
  { rangeTiles: 5, apexTiles: 7 },
  { rangeTiles: 11, apexTiles: 5.5 },
] as const;
export const MORTAR_FALLOUT_TILES = 11;
export const MORTAR_MUZZLE_LIFT_PX = 56;
export const MORTAR_MUZZLE_DROP_PX = 34;
export const BLASTER_COURTESY_TILES = 1.2;
export const TRAP_HILL_WIDTH = 3;
export const TRAP_HILL_HEIGHT = 2;
export const FIRST_HAZARD_DELAY_MS = 1400;
export const URCHIN_SPIKE_COUNT = 8;
export const URCHIN_RANGE_TILES = 5;
export const ELECTRIC_PUDDLE_TILES = 4;

export function hazardMount(kind: TerrainHazardKind): TerrainHazardMount {
  switch (kind) {
    case 'glacier-bore':
    case 'keep-burner':
      return 'hill';
    case 'bramble-vent':
    case 'needle-mortar':
    case 'sonar-well':
    case 'pitcher-snare':
    case 'urchin-ball':
    case 'power-box':
      return 'ground';
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

export function hazardFacing(kind: TerrainHazardKind): -1 | 1 {
  return hazardMount(kind) === 'hill' ? -1 : 1;
}

export function hazardTelegraphMs(kind: TerrainHazardKind): number {
  switch (kind) {
    case 'bramble-vent':
      return 600;
    case 'glacier-bore':
      return 800;
    case 'needle-mortar':
      return 700;
    case 'sonar-well':
      return 700;
    case 'keep-burner':
      return 600;
    case 'pitcher-snare':
      return 400;
    case 'urchin-ball':
      return 500;
    case 'power-box':
      return 760;
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

export function hazardCooldownMs(kind: TerrainHazardKind): number {
  switch (kind) {
    case 'bramble-vent':
      return 2800;
    case 'glacier-bore':
      return 2600;
    case 'needle-mortar':
      return 3200;
    case 'sonar-well':
      return 2800;
    case 'keep-burner':
      return 2400;
    case 'pitcher-snare':
      return 2200;
    case 'urchin-ball':
      return 2600;
    case 'power-box':
      return 3000;
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

export function hazardAttackMs(kind: TerrainHazardKind): number {
  switch (kind) {
    case 'bramble-vent':
    case 'needle-mortar':
      return 180;
    case 'glacier-bore':
      return 320;
    case 'sonar-well':
      return 400;
    case 'keep-burner':
      return 780;
    case 'pitcher-snare':
      return 1400;
    case 'urchin-ball':
      return 220;
    case 'power-box':
      return 640;
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

export function hazardUsesGravity(kind: TerrainHazardKind): boolean {
  return kind === 'needle-mortar';
}

export function hazardFiresProjectiles(kind: TerrainHazardKind): boolean {
  switch (kind) {
    case 'bramble-vent':
    case 'needle-mortar':
    case 'pitcher-snare':
    case 'urchin-ball':
      return true;
    case 'glacier-bore':
    case 'sonar-well':
    case 'keep-burner':
    case 'power-box':
      return false;
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

export function hazardHasBeam(kind: TerrainHazardKind): boolean {
  switch (kind) {
    case 'glacier-bore':
    case 'sonar-well':
    case 'keep-burner':
    case 'power-box':
      return true;
    case 'bramble-vent':
    case 'needle-mortar':
    case 'pitcher-snare':
    case 'urchin-ball':
      return false;
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

export function hazardTextureKey(kind: TerrainHazardKind): string {
  return `hazard-${kind}`;
}

export function beamTextureKey(kind: TerrainHazardKind): string | undefined {
  switch (kind) {
    case 'glacier-bore':
      return 'beam-ice';
    case 'sonar-well':
      return 'beam-sonar';
    case 'keep-burner':
      return 'beam-flame';
    case 'bramble-vent':
    case 'needle-mortar':
    case 'pitcher-snare':
    case 'urchin-ball':
      return undefined;
    case 'power-box':
      return 'beam-electric';
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

export function shotgunVelocities(speed: number): Array<{ vx: number; vy: number }> {
  return SHOTGUN_OFFSETS_DEG.map((deg) => {
    const angle = -Math.PI / 2 + (deg * Math.PI) / 180;
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    };
  });
}

export function urchinVelocities(speed: number): Array<{ vx: number; vy: number }> {
  return Array.from({ length: URCHIN_SPIKE_COUNT }, (_, i) => {
    const angle = (Math.PI * 2 * i) / URCHIN_SPIKE_COUNT;
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    };
  });
}

export function urchinIdleTextureKey(elapsedInIdle: number, cooldownMs: number): string {
  const growEnd = cooldownMs * 0.55;
  if (elapsedInIdle < growEnd * 0.35) {
    return 'hazard-urchin-ball-bald';
  }
  if (elapsedInIdle < growEnd * 0.75) {
    return 'hazard-urchin-ball-half';
  }
  return 'hazard-urchin-ball';
}

/** Launch velocity that peaks `apexPx` above the muzzle and lands `rangePx` away after falling `dropPx`. */
export function mortarLaunchVelocity(
  rangePx: number,
  apexPx: number,
  gravity: number,
  dropPx = MORTAR_MUZZLE_DROP_PX,
): { vx: number; vy: number } {
  const g = Math.max(1, gravity);
  const lift = Math.sqrt(2 * g * Math.max(1, apexPx));
  const flight = (lift + Math.sqrt(lift * lift + 2 * g * Math.max(0, dropPx))) / g;
  return {
    vx: rangePx / Math.max(flight, 0.001),
    vy: -lift,
  };
}

export function mortarVelocities(
  gravity: number,
  dropPx = MORTAR_MUZZLE_DROP_PX,
): Array<{ vx: number; vy: number }> {
  return MORTAR_SHOTS.flatMap((shot) => {
    const { vx, vy } = mortarLaunchVelocity(shot.rangeTiles * TILE, shot.apexTiles * TILE, gravity, dropPx);
    return [
      { vx: -vx, vy },
      { vx, vy },
    ];
  });
}

export function flameJetOn(elapsedInAttack: number): boolean {
  return (
    (elapsedInAttack >= 0 && elapsedInAttack < 180) ||
    (elapsedInAttack >= 300 && elapsedInAttack < 480) ||
    (elapsedInAttack >= 600 && elapsedInAttack < 780)
  );
}

export function beamLethal(kind: TerrainHazardKind, elapsedInAttack: number): boolean {
  if (elapsedInAttack < 0 || elapsedInAttack >= hazardAttackMs(kind)) {
    return false;
  }
  if (kind === 'keep-burner') {
    return flameJetOn(elapsedInAttack);
  }
  return hazardHasBeam(kind);
}

export function pitcherBlockedByStand(standingOnSocket: boolean): boolean {
  return standingOnSocket;
}

export function blasterCourtesy(distancePx: number): boolean {
  return distancePx < TILE * BLASTER_COURTESY_TILES;
}

export function hazardThreatRangeTiles(kind: TerrainHazardKind): number {
  switch (kind) {
    case 'glacier-bore':
      return ICE_BEAM_TILES;
    case 'keep-burner':
      return FLAME_JET_TILES;
    case 'bramble-vent':
      return SHOTGUN_FALLOUT_TILES;
    case 'needle-mortar':
      return MORTAR_FALLOUT_TILES;
    case 'sonar-well':
    case 'pitcher-snare':
      return 1;
    case 'urchin-ball':
      return URCHIN_RANGE_TILES;
    case 'power-box':
      return ELECTRIC_PUDDLE_TILES;
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

export function hazardThreatensTile(
  kind: TerrainHazardKind,
  trapTileX: number,
  originTileX: number,
  facing: -1 | 1 = hazardFacing(kind),
): boolean {
  const range = hazardThreatRangeTiles(kind);
  if (hazardHasBeam(kind) && hazardMount(kind) === 'hill') {
    const min = facing < 0 ? trapTileX - range : trapTileX;
    const max = facing < 0 ? trapTileX : trapTileX + range;
    return originTileX >= min && originTileX <= max;
  }
  return Math.abs(trapTileX - originTileX) <= range;
}

export function hillCoversTile(hills: ReadonlyArray<readonly [number, number, number]>, x: number): boolean {
  return hills.some(([start, width]) => x >= start && x < start + width);
}

export function hillHeightAt(hills: ReadonlyArray<readonly [number, number, number]>, x: number): number {
  const hill = hills.find(([start, width]) => x >= start && x < start + width);
  return hill?.[2] ?? 0;
}

export function trapHillSpec(x: number): [number, number, number] {
  return [x - (TRAP_HILL_WIDTH - 1), TRAP_HILL_WIDTH, TRAP_HILL_HEIGHT];
}

export function extraHillsForTraps(
  theme: Theme,
  traps: readonly number[],
  hills: ReadonlyArray<readonly [number, number, number]> = [],
): Array<[number, number, number]> {
  const kind = hazardForTheme(theme);
  if (hazardMount(kind) !== 'hill') {
    return [];
  }
  return traps.filter((x) => !hillCoversTile(hills, x)).map((x) => trapHillSpec(x));
}
