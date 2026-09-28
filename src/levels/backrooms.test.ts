import { describe, expect, it } from 'vitest';
import { ALL_LEVEL_IDS, BACKROOMS_HOST_LEVEL, GROUND_Y, type LevelId } from '../config';
import { NOCLIP_CELL } from './grid';
import { getLevel } from './worlds';

function noclipColumns(id: LevelId): number[] {
  const ground = getLevel(id).rows[GROUND_Y] ?? '';
  return [...ground].flatMap((cell, x) => (cell === NOCLIP_CELL ? [x] : []));
}

describe('noclip entrance', () => {
  it('hides exactly one noclip tile, in the host course', () => {
    for (const id of ALL_LEVEL_IDS) {
      expect(noclipColumns(id), id).toEqual(id === BACKROOMS_HOST_LEVEL ? [getLevel(id).course.noclipTile] : []);
    }
  });

  it('sits on open floor with room to land on it', () => {
    const level = getLevel(BACKROOMS_HOST_LEVEL);
    const x = level.course.noclipTile ?? -1;
    expect(level.rows[GROUND_Y - 1]?.[x]).toBe('.');
    expect(level.rows[GROUND_Y - 2]?.[x]).toBe('.');
    expect(level.rows[GROUND_Y + 1]?.[x]).toBe('#');
  });

  it('keeps pickups, flags, and puzzles off the tile', () => {
    const { course } = getLevel(BACKROOMS_HOST_LEVEL);
    const x = course.noclipTile ?? -1;
    const features = [
      ...course.collectibles.map((pickup) => pickup.x),
      course.shield.x,
      ...course.checkpoints.map((checkpoint) => checkpoint.x),
      ...course.puzzles.map((puzzle) => puzzle.x),
      ...course.enemies.filter((enemy) => enemy.tilesUp === 0).map((enemy) => enemy.x),
    ];
    for (const at of features) {
      expect(Math.abs(at - x), `feature@${at}`).toBeGreaterThan(1);
    }
  });
});
