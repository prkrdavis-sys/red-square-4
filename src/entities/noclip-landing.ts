import { GROUND_Y, TILE } from '../config';

/** Half-width, in px, of the landing window on top of the noclip tile. */
export const NOCLIP_LANDING_HALF_WIDTH = TILE / 2 - 6;

/** True when a landing at `playerX` with its feet at `feetY` counts as touching down on the tile. */
export function landsOnNoclip(tileX: number, playerX: number, feetY: number): boolean {
  const centerX = tileX * TILE + TILE / 2;
  const topY = GROUND_Y * TILE;
  return Math.abs(playerX - centerX) <= NOCLIP_LANDING_HALF_WIDTH && Math.abs(feetY - topY) <= 6;
}
