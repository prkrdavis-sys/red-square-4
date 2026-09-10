import { describe, expect, it } from 'vitest';
import { JUMP_HEIGHT_TILES, TILE, THEMES, launchVelocity, themePhysics, type Theme } from '../config';
import { LEDGE } from './grid';
import {
  brickCeilingRun,
  floatingIslandChain,
  fromNsmbTilesX,
  fromNsmbTilesY,
  GAP,
  gapForReach,
  merge,
  moverCrossing,
  pitLedgeRhythm,
  SHAFT_INTERIOR_TILES,
  staircaseGap,
  stepTower,
  wallJumpShaft,
  type Motif,
} from './motifs';

function reachTiles(theme: Theme): number {
  const physics = themePhysics(theme);
  const airTime = (2 * Math.abs(launchVelocity(physics.gravity, JUMP_HEIGHT_TILES))) / physics.gravity;
  return (physics.maxSpeed * airTime) / TILE;
}

const AT = 40;

const ALL: Motif[] = [
  staircaseGap(AT, 2, GAP.standard),
  floatingIslandChain(AT, 3, GAP.standard),
  wallJumpShaft(AT),
  moverCrossing(AT, 'x'),
  moverCrossing(AT, 'y'),
  brickCeilingRun(AT, 4),
  pitLedgeRhythm(AT, 2, GAP.standard),
  stepTower(AT, 3),
];

describe('NSMB conversion', () => {
  it('scales NSMB spans into this game’s tile grid', () => {
    // Mario's 5-tile running jump becomes a 4-tile leap here, inside the 3.8-tile reach
    // once the landing tile is counted.
    expect(fromNsmbTilesX(5)).toBe(4);
    expect(fromNsmbTilesX(8)).toBe(6);
    // Mario's 4-tile climb becomes 2 tiles, exactly one full jump.
    expect(fromNsmbTilesY(4)).toBe(2);
  });

  it('never asks a theme for a gap it cannot clear', () => {
    for (const theme of THEMES) {
      const reach = reachTiles(theme);
      expect(gapForReach(reach, GAP.expert), theme).toBeLessThanOrEqual(reach);
    }
    // Ocean floats far enough to use the widest gap; grass tops out one tile shorter.
    expect(gapForReach(reachTiles('ocean'), GAP.expert)).toBe(GAP.expert);
    expect(gapForReach(reachTiles('grass'), GAP.expert)).toBe(GAP.standard);
  });
});

describe('motif geometry', () => {
  it('reports a width that actually covers everything it stamps', () => {
    for (const motif of ALL) {
      const ends = [
        ...motif.pits.map(([x, w]) => x + w),
        ...motif.plats.map(([x, , w]) => x + w),
        ...motif.solids.map(([x, , w]) => x + w),
        ...motif.bricks.map(([x, , w]) => x + w),
        ...motif.walls.map(([x]) => x + 1),
        ...motif.stairs.map(([x, steps, dir]) => x + steps * (dir ?? 1)),
        ...motif.movers.map((mover) => mover.x + mover.w + mover.span),
      ];
      expect(Math.max(...ends), JSON.stringify(motif)).toBeLessThanOrEqual(AT + motif.width);
      expect(Math.min(AT, ...ends)).toBeGreaterThanOrEqual(AT - motif.width);
    }
  });

  it('keeps every pit under the 8-tile span that would need a sky seal', () => {
    for (const motif of ALL) {
      for (const [, width] of motif.pits) {
        expect(width).toBeLessThan(8);
      }
    }
  });

  it('never climbs more than one full jump between neighbouring ledges', () => {
    const tower = stepTower(AT, 3);
    const heights = tower.plats.map(([, tilesUp]) => tilesUp);
    for (let i = 1; i < heights.length; i += 1) {
      expect(heights[i]! - heights[i - 1]!).toBeLessThanOrEqual(LEDGE.low);
    }
  });

  it('builds chimneys exactly two tiles wide so a kick can cross them', () => {
    const shaft = wallJumpShaft(AT);
    const [left, right] = shaft.walls.map(([x]) => x);
    expect(right! - left! - 1).toBe(SHAFT_INTERIOR_TILES);
    // The climb pays out with a ledge at the top of the shaft.
    expect(shaft.plats.length).toBe(1);
  });

  it('spans every mover crossing pit with a plate', () => {
    for (const axis of ['x', 'y'] as const) {
      const crossing = moverCrossing(AT, axis);
      expect(crossing.movers).toHaveLength(1);
      expect(crossing.pits).toHaveLength(1);
    }
  });

  it('merges fragments without losing any of them', () => {
    const band = merge(staircaseGap(10, 2), brickCeilingRun(40, 4), wallJumpShaft(70));
    expect(band.stairs).toHaveLength(2);
    expect(band.bricks).toHaveLength(1);
    expect(band.walls).toHaveLength(2);
  });
});
