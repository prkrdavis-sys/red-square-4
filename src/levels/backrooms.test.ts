import { describe, expect, it } from 'vitest';
import {
  ALL_LEVEL_IDS,
  BACKROOMS_HOST_LEVEL,
  BACKROOMS_LEVEL_ID,
  GROUND_Y,
  JUMP_HEIGHT_TILES,
  MAP_ROWS,
  TILE,
  launchVelocity,
  themePhysics,
  type LevelId,
} from '../config';
import { NOCLIP_CELL } from './grid';
import { getLevel } from './worlds';

function noclipColumns(id: LevelId): number[] {
  const ground = getLevel(id).rows[GROUND_Y] ?? '';
  return [...ground].flatMap((cell, x) => (cell === NOCLIP_CELL ? [x] : []));
}

function jumpReachTiles(): number {
  const physics = themePhysics('backrooms');
  const airTime = (2 * Math.abs(launchVelocity(physics.gravity, JUMP_HEIGHT_TILES))) / physics.gravity;
  return (physics.maxSpeed * airTime) / TILE;
}

describe('Level 0 chase course', () => {
  const level = getLevel(BACKROOMS_LEVEL_ID);
  const chase = level.course.chase;

  it('is a backrooms chase with no arena, enemies, or pickups', () => {
    expect(level.theme).toBe('backrooms');
    expect(level.name).toBe('Level 0');
    expect(chase).toBeDefined();
    expect(level.rows.join('')).not.toMatch(/[mBe]/);
    expect(level.course.enemies).toHaveLength(0);
    expect(level.course.collectibles).toHaveLength(0);
    expect(level.course.shield).toBeUndefined();
  });

  it('lays out several trap pits, then the void pit, then the console', () => {
    expect(chase!.trapPits.length).toBeGreaterThanOrEqual(3);
    const lastTrap = Math.max(...chase!.trapPits.map(([x, w]) => x + w));
    const [voidX, voidW] = chase!.voidPit;
    expect(voidX).toBeGreaterThan(lastTrap);
    expect(chase!.console).toBeGreaterThan(voidX + voidW);
  });

  it('opens a real hole for every pit that a running jump clears', () => {
    const reach = jumpReachTiles();
    for (const [x, w] of [...chase!.trapPits, chase!.voidPit]) {
      expect(w, `pit@${x}`).toBeLessThan(reach - 0.4);
      for (let i = x; i < x + w; i += 1) {
        for (let y = GROUND_Y; y < MAP_ROWS; y += 1) {
          expect(level.rows[y]?.[i], `pit@${x} col ${i}`).toBe('.');
        }
      }
      expect(level.rows[GROUND_Y]?.[x - 1]).toBe('#');
      expect(level.rows[GROUND_Y]?.[x + w]).toBe('#');
    }
  });

  it('keeps a runway in front of every pit so the jump can build speed', () => {
    for (const [x] of [...chase!.trapPits, chase!.voidPit]) {
      for (let i = x - 3; i < x; i += 1) {
        expect(level.rows[GROUND_Y - 1]?.[i], `runway@${i}`).toBe('.');
      }
    }
  });

  it('puts the console on open floor and both checkpoints off the pit lips', () => {
    expect(level.rows[GROUND_Y]?.[chase!.console]).toBe('#');
    expect(level.rows[GROUND_Y - 1]?.[chase!.console]).toBe('.');
    expect(level.course.checkpoints).toHaveLength(2);
    for (const checkpoint of level.course.checkpoints) {
      for (const [x, w] of [...chase!.trapPits, chase!.voidPit]) {
        expect(checkpoint.x < x - 1 || checkpoint.x > x + w, `flag@${checkpoint.x}`).toBe(true);
      }
    }
  });
});

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
      ...(course.shield ? [course.shield.x] : []),
      ...course.checkpoints.map((checkpoint) => checkpoint.x),
      ...course.puzzles.map((puzzle) => puzzle.x),
      ...course.enemies.filter((enemy) => enemy.tilesUp === 0).map((enemy) => enemy.x),
    ];
    for (const at of features) {
      expect(Math.abs(at - x), `feature@${at}`).toBeGreaterThan(1);
    }
  });
});
