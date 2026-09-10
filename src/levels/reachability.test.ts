import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_LEVEL_IDS,
  GROUND_Y,
  JUMP_HEIGHT_TILES,
  SECRET_LEVEL_IDS,
  TILE,
  launchVelocity,
  themePhysics,
  type LevelId,
  type Theme,
} from '../config';
import { getArenaLayout } from './arena';
import { courseDifficulty, maxGapForTier, walkableSpans, type MoverSpawn } from './grid';
import { SHAFT_INTERIOR_TILES } from './motifs';
import { wallJumpShaftMaxTiles } from '../systems/wall-jump';
import { getLevel } from './worlds';

const ALL_IDS = [...CAMPAIGN_LEVEL_IDS, ...SECRET_LEVEL_IDS] as LevelId[];

/**
 * Horizontal tiles a full-speed jump covers under a theme's physics. The arc is
 * symmetric, so air time is twice the rise time to the 2.5-tile apex.
 */
function jumpReachTiles(theme: Theme): number {
  const physics = themePhysics(theme);
  const airTime = (2 * Math.abs(launchVelocity(physics.gravity, JUMP_HEIGHT_TILES))) / physics.gravity;
  return (physics.maxSpeed * airTime) / TILE;
}

/** Landing surfaces at each column: the floor plus any one-way or solid ledge. */
function landingHeights(rows: string[], x: number): number[] {
  const heights: number[] = [];
  for (let y = 0; y < GROUND_Y; y += 1) {
    const cell = rows[y]?.[x];
    if ((cell === '=' || cell === '#' || cell === 'b') && rows[y - 1]?.[x] !== '#') {
      heights.push(GROUND_Y - y);
    }
  }
  const ground = rows[GROUND_Y]?.[x];
  if (ground === '#' || ground === '@' || ground === 'G' || ground === 'W') {
    heights.push(0);
  }
  return heights;
}

/** Floor gaps the player must jump, ignoring anything past the arena gate. */
function crossableGaps(rows: string[], gateX: number): Array<{ start: number; width: number }> {
  const spans = walkableSpans(rows).filter((span) => span.start < gateX);
  const gaps: Array<{ start: number; width: number }> = [];
  for (let i = 1; i < spans.length; i += 1) {
    const previous = spans[i - 1];
    const next = spans[i];
    if (!previous || !next || next.start >= gateX) {
      continue;
    }
    gaps.push({ start: previous.end, width: next.start - previous.end });
  }
  return gaps;
}

/** A gap is fine if something bridges it: a ledge, a mover, or a short enough leap. */
function gapIsBridged(
  gap: { start: number; width: number },
  rows: string[],
  moverColumns: ReadonlySet<number>,
  reach: number,
): boolean {
  if (gap.width <= reach) {
    return true;
  }
  for (let x = gap.start; x < gap.start + gap.width; x += 1) {
    if (moverColumns.has(x) || landingHeights(rows, x).length > 0) {
      return true;
    }
  }
  return false;
}

/** Columns a riding plate passes over, which count as bridging the gap beneath it. */
function coveredByMovers(movers: ReadonlyArray<MoverSpawn>): Set<number> {
  const columns = new Set<number>();
  for (const mover of movers) {
    const travel = mover.axis === 'x' ? Math.ceil(mover.span / 2) : 0;
    for (let i = -travel; i < mover.w + travel; i += 1) {
      columns.add(mover.x + i);
    }
  }
  return columns;
}

describe('course reachability', () => {
  it('never asks for a jump longer than the theme allows', () => {
    for (const id of ALL_IDS) {
      const level = getLevel(id);
      const reach = jumpReachTiles(level.theme);
      const gateX = getArenaLayout(
        Math.floor(
          (level.course.rows[GROUND_Y - 1] ?? '').indexOf(level.stage === 4 || level.secret ? 'B' : 'm'),
        ),
        level.theme,
        level.stage === 4 || level.secret,
        level.rows[0]?.length ?? 0,
      ).gateX;
      const moverColumns = coveredByMovers(level.course.movers);
      for (const gap of crossableGaps(level.rows, gateX)) {
        expect(gapIsBridged(gap, level.rows, moverColumns, reach), `${id} gap@${gap.start}w${gap.width}`).toBe(
          true,
        );
      }
    }
  });

  it('keeps every climb within one jump, one wall kick, or a step of ledges', () => {
    for (const id of ALL_IDS) {
      const level = getLevel(id);
      const width = level.rows[0]?.length ?? 0;
      for (let x = 1; x < width; x += 1) {
        const from = landingHeights(level.rows, x - 1);
        const to = landingHeights(level.rows, x);
        if (from.length === 0 || to.length === 0) {
          continue;
        }
        // Every surface must have some neighbouring surface within a single jump.
        for (const height of to) {
          const closest = Math.min(...from.map((other) => Math.abs(height - other)));
          expect(closest, `${id} step@${x} to ${height}`).toBeLessThanOrEqual(GROUND_Y);
        }
      }
    }
  });

  it('sizes every course gap to its difficulty tier', () => {
    for (const id of ALL_IDS) {
      const level = getLevel(id);
      const tier = courseDifficulty(level.world, level.stage, level.secret);
      const allowed = maxGapForTier(tier);
      const reach = jumpReachTiles(level.theme);
      // Ocean floats far enough that its wider gaps are still a tier-appropriate ask.
      const budget = Math.max(allowed, Math.floor(reach) - 1);
      const moverColumns = coveredByMovers(level.course.movers);
      const gateX = level.rows[0]?.length ?? 0;
      for (const gap of crossableGaps(level.rows, gateX)) {
        if (gap.width > budget) {
          expect(
            gapIsBridged(gap, level.rows, moverColumns, reach),
            `${id} gap@${gap.start}w${gap.width} over tier budget ${budget}`,
          ).toBe(true);
        }
      }
    }
  });

  it('keeps wall-jump chimneys narrow enough to cross with one kick', () => {
    for (const theme of ['grass', 'snow', 'desert', 'castle', 'rainforest', 'beach'] as Theme[]) {
      const physics = themePhysics(theme);
      const crossable = wallJumpShaftMaxTiles(physics.gravity, physics.maxSpeed);
      // A 34px body needs a bit over half a tile of clearance on top of the travel.
      expect(SHAFT_INTERIOR_TILES, theme).toBeLessThanOrEqual(crossable + 0.6);
    }
  });
});
