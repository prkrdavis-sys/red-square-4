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
export const BLASTER_COURTESY_TILES = 1.2;
export const TRAP_HILL_WIDTH = 3;
export const TRAP_HILL_HEIGHT = 2;
export const FIRST_HAZARD_DELAY_MS = 1400;

export function hazardMount(kind: TerrainHazardKind): TerrainHazardMount {
  switch (kind) {
    case 'glacier-bore':
    case 'keep-burner':
      return 'hill';
    case 'bramble-vent':
    case 'needle-mortar':
    case 'sonar-well':
    case 'pitcher-snare':
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
      return true;
    case 'glacier-bore':
    case 'sonar-well':
    case 'keep-burner':
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
      return true;
    case 'bramble-vent':
    case 'needle-mortar':
    case 'pitcher-snare':
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
      return undefined;
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
    case 'needle-mortar':
      return SHOTGUN_FALLOUT_TILES;
    case 'sonar-well':
    case 'pitcher-snare':
      return 1;
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
