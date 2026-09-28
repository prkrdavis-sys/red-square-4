import { GROUND_Y, TILE } from '../config';
import { isSolidCell } from '../levels/colliders';

export type EntityState = 'stalk' | 'chase' | 'leap' | 'falling' | 'climbing' | 'gone';

/** What the stalker sees one tile ahead of its feet. */
export type TileAhead = 'floor' | 'wall' | 'pit';

export type PitOutcome = 'climb' | 'gone' | 'none';

/** Cruise speed as a share of the player's top speed: a clean run slowly pulls ahead. */
export const ENTITY_BASE_RATIO = 0.92;
/** Speed share once it has fallen far behind, so it is never out of the picture for long. */
export const ENTITY_BOOST_RATIO = 1.32;
export const ENTITY_NEAR_PX = TILE * 4;
export const ENTITY_FAR_PX = TILE * 12;

export const ENTITY_INTRO_MS = 1500;
/** Time spent out of sight at the bottom of a trap pit before the climb starts. */
export const ENTITY_PIT_WAIT_MS = 2200;
export const ENTITY_CLIMB_MS = 820;
/** Pause on the lip after climbing out, before the chase resumes. */
export const ENTITY_RECOVER_MS = 400;
/** How far behind the respawn point the stalker reappears after a checkpoint restart. */
export const ENTITY_RESPAWN_BEHIND_TILES = 11;
/** Leap apex in tiles; enough to clear a 3-high pillar from the floor. */
export const ENTITY_LEAP_TILES = 3.4;

/** Horizontal speed toward the target for a given gap in px. */
export function chaseSpeed(gapPx: number, playerMax: number): number {
  const gap = Math.abs(gapPx);
  const t = Math.min(1, Math.max(0, (gap - ENTITY_NEAR_PX) / (ENTITY_FAR_PX - ENTITY_NEAR_PX)));
  const ratio = ENTITY_BASE_RATIO + (ENTITY_BOOST_RATIO - ENTITY_BASE_RATIO) * t;
  return playerMax * ratio;
}

/** It vaults walls and ledges without breaking stride, but never jumps a gap. */
export function shouldLeap(tileAhead: TileAhead): boolean {
  switch (tileAhead) {
    case 'wall':
      return true;
    case 'floor':
    case 'pit':
      return false;
    default: {
      const neverTile: never = tileAhead;
      return neverTile;
    }
  }
}

/**
 * Classify the column one step ahead at the stalker's feet. `feetRow` is the row it
 * stands on (GROUND_Y on the floor, lower on a raised office block).
 */
export function tileAheadOf(rows: readonly string[], tileX: number, direction: number, feetRow: number): TileAhead {
  const x = tileX + (direction >= 0 ? 1 : -1);
  for (let y = feetRow - 3; y < feetRow; y += 1) {
    if (isSolidCell(rows[y]?.[x])) {
      return 'wall';
    }
  }
  return isSolidCell(rows[GROUND_Y]?.[x]) ? 'floor' : 'pit';
}

function inPit(tileX: number, [x, w]: [number, number]): boolean {
  return tileX >= x && tileX < x + w;
}

export function pitOutcome(
  tileX: number,
  trapPits: ReadonlyArray<[number, number]>,
  voidPit: [number, number],
): PitOutcome {
  if (inPit(tileX, voidPit)) {
    return 'gone';
  }
  return trapPits.some((pit) => inPit(tileX, pit)) ? 'climb' : 'none';
}

/** The pit wall it claws up: the lip on the side of the target. Returns the lip edge in px. */
export function climbLipX([x, w]: [number, number], direction: number): number {
  return direction >= 0 ? (x + w) * TILE : x * TILE;
}

/** Footstep volume from distance; the thumps swell as it closes in. */
export function footstepLoudness(gapPx: number): number {
  const reach = TILE * 18;
  return Math.min(1, Math.max(0.06, 1 - Math.abs(gapPx) / reach));
}

/**
 * Floor column `behind` tiles left of `fromTileX` for a respawned stalker, stepping
 * further back until it stands on open floor rather than over a pit or in a pillar.
 */
export function respawnColumn(rows: readonly string[], fromTileX: number, behind = ENTITY_RESPAWN_BEHIND_TILES): number {
  for (let x = fromTileX - behind; x >= 1; x -= 1) {
    if (isSolidCell(rows[GROUND_Y]?.[x]) && !isSolidCell(rows[GROUND_Y - 1]?.[x])) {
      return x;
    }
  }
  return 1;
}
