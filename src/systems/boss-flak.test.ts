import { describe, expect, it } from 'vitest';
import {
  BOSS_BLAST_CORE_PEAK,
  BOSS_BLAST_RING_PEAK,
  BOSS_FLAK_COUNT,
  BOSS_FLAK_INDEXES,
  BOSS_FLAK_SIZE,
  bossFlakAt,
  bossFlakCentroid,
  scaleBossFlakPoly,
} from './boss-flak';

describe('boss flak shatter', () => {
  it('splits the stamp into seven shards', () => {
    expect(BOSS_FLAK_INDEXES).toHaveLength(BOSS_FLAK_COUNT);
    expect(BOSS_FLAK_COUNT).toBe(7);
    for (const index of BOSS_FLAK_INDEXES) {
      const poly = scaleBossFlakPoly(index, BOSS_FLAK_SIZE, BOSS_FLAK_SIZE);
      expect(poly.length).toBeGreaterThanOrEqual(4);
      const center = bossFlakCentroid(index, BOSS_FLAK_SIZE, BOSS_FLAK_SIZE);
      expect(center.x).toBeGreaterThan(0);
      expect(center.x).toBeLessThan(BOSS_FLAK_SIZE);
      expect(center.y).toBeGreaterThan(0);
      expect(center.y).toBeLessThan(BOSS_FLAK_SIZE);
    }
  });

  it('covers the whole stamp without holes', () => {
    let missing = 0;
    for (let y = 0.5; y < BOSS_FLAK_SIZE; y += 1) {
      for (let x = 0.5; x < BOSS_FLAK_SIZE; x += 1) {
        if (bossFlakAt(x, y) === undefined) {
          missing += 1;
        }
      }
    }
    expect(missing).toBe(0);
  });

  it('keeps a distinct center shard', () => {
    expect(bossFlakAt(32, 32)).toBe(6);
    expect(bossFlakAt(8, 8)).toBe(0);
    expect(bossFlakAt(56, 8)).toBe(2);
    expect(bossFlakAt(56, 56)).toBe(3);
    expect(bossFlakAt(8, 56)).toBe(5);
  });

  it('keeps the mushroom cloud smaller than the player screen-wipe blast', () => {
    expect(BOSS_BLAST_CORE_PEAK).toBeLessThan(3);
    expect(BOSS_BLAST_RING_PEAK).toBeLessThan(3);
    expect(BOSS_BLAST_CORE_PEAK).toBeGreaterThan(0.8);
  });
});
