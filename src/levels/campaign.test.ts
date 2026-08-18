import { describe, expect, it } from 'vitest';
import {
  ALL_LEVEL_IDS,
  GROUND_Y,
  MAP_ROWS,
  STOMP_BOUNCE_VELOCITY,
  TILE,
  enemyRole,
  enemyThreatensTile,
  enemiesForWorld,
  parseLevelId,
} from '../config';
import { getLevel } from './worlds';
import { bossSafeLandingX, getArenaLayout, type ArenaKeep } from './arena';
import { hurtboxFromOpaque, isBossHeadStomp } from '../entities/boss-combat';

describe('biome campaign compilation', () => {
  it('compiles every course with complete progression features', () => {
    for (const id of ALL_LEVEL_IDS) {
      const level = getLevel(id);
      const width = level.rows[0]?.length ?? 0;

      expect(level.rows).toHaveLength(MAP_ROWS);
      expect(width).toBeGreaterThan(100);
      expect(level.rows.every((row) => row.length === width)).toBe(true);
      expect(level.course.collectibles).toHaveLength(3);
      expect(level.course.puzzles.length).toBe(level.stage === 4 ? 1 : level.stage);
      expect(level.rows[GROUND_Y]?.[level.course.checkpoint.x]).toMatch(/[#@]/);
      expect(level.course.miniVariant).toBe(level.stage < 4 ? level.stage : undefined);
      expect(level.rows.join('')).toContain(level.stage < 4 ? 'm' : 'B');
      expect(level.rows.join('')).toContain('W');
    }
  });

  it('uses solid jump-blocks for the hop hills at the arena entrance', () => {
    for (const id of ALL_LEVEL_IDS) {
      const level = getLevel(id);
      const bossCh = level.stage < 4 ? 'm' : 'B';
      const bossX = level.rows[GROUND_Y - 1]?.indexOf(bossCh) ?? -1;
      const layout = getArenaLayout(bossX, level.theme, level.stage === 4, level.rows[0]?.length ?? 0);
      expect(level.rows[GROUND_Y - 1]?.[layout.floorStart + 2], id).toBe('#');
      expect(level.rows[GROUND_Y - 1]?.[layout.floorStart + 3], id).toBe('#');
      expect(level.rows[GROUND_Y - 1]?.[layout.floorStart + 4], id).toBe('#');
    }
  });

  it('leaves the arena gate as open air the player can walk through', () => {
    for (const id of ALL_LEVEL_IDS) {
      const level = getLevel(id);
      const bossCh = level.stage < 4 ? 'm' : 'B';
      const bossX = level.rows[GROUND_Y - 1]?.indexOf(bossCh) ?? -1;
      const layout = getArenaLayout(bossX, level.theme, level.stage === 4, level.rows[0]?.length ?? 0);
      for (let x = layout.gateX; x < layout.floorStart; x += 1) {
        for (let y = 0; y < GROUND_Y; y += 1) {
          expect(level.rows[y]?.[x]).toBe('.');
        }
      }
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

  it('keeps spawn, checkpoint, and solid puzzles off ground enemies', () => {
    for (const id of ALL_LEVEL_IDS) {
      const level = getLevel(id);
      const spawnX = level.rows[GROUND_Y - 1]?.indexOf('P') ?? 3;
      const groundEnemies = level.course.enemies.filter((enemy) => enemy.tilesUp === 0);
      expect(groundEnemies.some((enemy) => enemy.x === spawnX), id).toBe(false);
      expect(
        groundEnemies.some((enemy) => Math.abs(enemy.x - level.course.checkpoint.x) <= 1),
        id,
      ).toBe(false);
      for (const puzzle of level.course.puzzles) {
        if (
          puzzle.kind !== 'ice-wall' &&
          puzzle.kind !== 'sand-wall' &&
          puzzle.kind !== 'shadow-wall' &&
          puzzle.kind !== 'moss-curtain'
        ) {
          continue;
        }
        expect(groundEnemies.some((enemy) => enemy.x === puzzle.x), id).toBe(false);
        expect(puzzle.x, id).not.toBe(level.course.checkpoint.x);
        expect(puzzle.x, id).not.toBe(spawnX);
      }
    }
    const keep = getLevel('5-3');
    expect(keep.course.checkpoint.x).toBe(108);
    expect(keep.course.enemies.some((enemy) => enemy.x === 108 && enemy.tilesUp === 0)).toBe(false);
    expect(keep.course.puzzles.some((puzzle) => puzzle.x === 108)).toBe(false);
  });

  it('keeps spawn and checkpoint outside projectile attack range', () => {
    for (const id of ALL_LEVEL_IDS) {
      const level = getLevel(id);
      const spawnX = level.rows[GROUND_Y - 1]?.indexOf('P') ?? 3;
      for (const origin of [spawnX, level.course.checkpoint.x]) {
        for (const enemy of level.course.enemies) {
          expect(
            enemyThreatensTile(enemy.kind, enemy.x, origin),
            `${id} ${enemy.kind}@${enemy.x} vs ${origin}`,
          ).toBe(false);
        }
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

describe('boss head stomp', () => {
  const boss = {
    top: 200,
    bottom: 320,
    left: 400,
    right: 520,
    width: 120,
    height: 120,
    velocity: { y: 0 },
  };

  it('accepts a falling landing on the head', () => {
    expect(
      isBossHeadStomp(
        { top: 160, bottom: 220, left: 430, right: 464, width: 34, height: 36, velocity: { y: 200 } },
        boss,
      ),
    ).toBe(true);
  });

  it('rejects side bumps and rising jumps', () => {
    expect(
      isBossHeadStomp(
        { top: 240, bottom: 276, left: 500, right: 534, width: 34, height: 36, velocity: { y: 120 } },
        boss,
      ),
    ).toBe(false);
    expect(
      isBossHeadStomp(
        { top: 160, bottom: 220, left: 430, right: 464, width: 34, height: 36, velocity: { y: -200 } },
        boss,
      ),
    ).toBe(false);
  });

  it('keeps the hurtbox on the visible sprite instead of empty frame padding', () => {
    const box = hurtboxFromOpaque({ x: 25, y: 31, width: 78, height: 97 });
    expect(box.width).toBeLessThan(78);
    expect(box.height).toBeGreaterThan(80);
    expect(box.offsetY).toBeLessThan(40);
    expect(box.offsetX).toBeGreaterThan(25);
  });
});
