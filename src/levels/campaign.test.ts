import { describe, expect, it } from 'vitest';
import {
  ALL_LEVEL_IDS,
  GROUND_Y,
  MAP_ROWS,
  STOMP_BOUNCE_VELOCITY,
  TILE,
  enemyRole,
  enemiesForWorld,
  parseLevelId,
} from '../config';
import { getLevel } from './worlds';
import { bossSafeLandingX, type ArenaKeep } from './arena';

describe('biome campaign compilation', () => {
  it('compiles every course with complete progression features', () => {
    for (const id of ALL_LEVEL_IDS) {
      const level = getLevel(id);
      const width = level.rows[0]?.length ?? 0;

      expect(level.rows).toHaveLength(MAP_ROWS);
      expect(width).toBeGreaterThan(100);
      expect(level.rows.every((row) => row.length === width)).toBe(true);
      expect(level.course.collectibles).toHaveLength(3);
      expect(level.course.specialAnchors.length).toBeGreaterThanOrEqual(2);
      expect(level.course.puzzles.length).toBe(level.stage === 4 ? 1 : level.stage);
      expect(level.rows[GROUND_Y]?.[level.course.checkpoint.x]).toMatch(/[#@]/);
      expect(level.course.miniVariant).toBe(level.stage < 4 ? level.stage : undefined);
      expect(level.rows.join('')).toContain(level.stage < 4 ? 'm' : 'B');
    }
  });

  it('introduces movement, ranged, and terrain enemies by stage', () => {
    for (const id of ALL_LEVEL_IDS) {
      const level = getLevel(id);
      const roles = new Set(level.course.enemies.map((enemy) => enemyRole(enemy.kind)));
      if (level.stage === 1) {
        expect([...roles]).toEqual(['movement']);
      } else if (level.stage === 2) {
        expect(roles).toEqual(new Set(['movement', 'ranged']));
      } else {
        expect(roles).toEqual(new Set(['movement', 'ranged', 'terrain']));
      }
    }
  });

  it('keeps each enemy roster exclusive to its biome', () => {
    for (const id of ALL_LEVEL_IDS) {
      const { world } = parseLevelId(id);
      const allowed = new Set(enemiesForWorld(world));
      expect(getLevel(id).course.enemies.every((enemy) => allowed.has(enemy.kind))).toBe(true);
    }
  });
});

describe('stomp recovery tuning', () => {
  it('reaches at least three tiles under baseline gravity', () => {
    const baselineGravity = 1800;
    const apexPixels = (STOMP_BOUNCE_VELOCITY ** 2) / (2 * baselineGravity);
    expect(apexPixels).toBeGreaterThanOrEqual(TILE * 3);
  });

  it('sends boss stomps toward the opposite safe edge', () => {
    const arena: ArenaKeep = { left: 100, right: 900, top: 100, bottom: 600, enterX: 120 };
    expect(bossSafeLandingX(arena, 300)).toBe(824);
    expect(bossSafeLandingX(arena, 700)).toBe(176);
  });
});
