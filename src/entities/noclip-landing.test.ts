import { describe, expect, it } from 'vitest';
import { GROUND_Y, TILE } from '../config';
import { landsOnNoclip, NOCLIP_LANDING_HALF_WIDTH } from './noclip-landing';

describe('noclip landing window', () => {
  const tileX = 124;
  const center = tileX * TILE + TILE / 2;
  const floor = GROUND_Y * TILE;

  it('accepts a touchdown centred on the tile', () => {
    expect(landsOnNoclip(tileX, center, floor)).toBe(true);
    expect(landsOnNoclip(tileX, center + NOCLIP_LANDING_HALF_WIDTH, floor + 3)).toBe(true);
  });

  it('ignores landings that only clip the edge or happen on a ledge above', () => {
    expect(landsOnNoclip(tileX, center + TILE / 2, floor)).toBe(false);
    expect(landsOnNoclip(tileX, center, floor - TILE * 2)).toBe(false);
  });
});
