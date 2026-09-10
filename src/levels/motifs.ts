import { JUMP_REACH_TILES } from '../config';
import { LEDGE, type CourseSpec, type MoverSpec } from './grid';

/**
 * Layout vocabulary ported from New Super Mario Bros. DS.
 *
 * NSMB uses 16px tiles and a running Mario clears roughly 5 tiles across and 4 tiles
 * up. This game uses 64px tiles and a slower runner: a full jump peaks at 2.5 tiles
 * and carries about 3.8 tiles horizontally on the grass-family themes. Porting a
 * layout therefore means scaling NSMB spans by `NSMB_SCALE_X` / `NSMB_SCALE_Y` and
 * rounding to whole tiles, which preserves the shape and rhythm of the original
 * while keeping every jump inside this game's arc.
 */
export const NSMB_SCALE_X = 0.75;
export const NSMB_SCALE_Y = 0.6;

export function fromNsmbTilesX(nsmbTiles: number): number {
  return Math.round(nsmbTiles * NSMB_SCALE_X);
}

export function fromNsmbTilesY(nsmbTiles: number): number {
  return Math.round(nsmbTiles * NSMB_SCALE_Y);
}

/**
 * Gap widths in tiles, measured as missing floor between two landing surfaces.
 * `EXPERT` is the widest the grass-family themes can clear; `FLOAT` only works in
 * the low-gravity ocean world.
 */
export const GAP = {
  trivial: 2,
  standard: 3,
  expert: 4,
  float: 5,
} as const;

export type GapWidth = (typeof GAP)[keyof typeof GAP];

/** Interior width of a wall-jump chimney. Wider than this and a kick cannot cross it. */
export const SHAFT_INTERIOR_TILES = 2;

/**
 * Widest gap a theme can actually clear, allowing a tile of margin on the landing.
 * Ocean's low gravity buys a wider leap than the grass-family themes.
 */
export function gapForReach(reachTiles: number, tierGap: number): GapWidth {
  const safe = Math.max(GAP.trivial, Math.floor(reachTiles));
  return Math.min(tierGap, safe) as GapWidth;
}

/** The spec arrays a motif is allowed to contribute. */
export type Motif = Required<
  Pick<CourseSpec, 'pits' | 'plats' | 'solids' | 'hills' | 'walls' | 'hangs' | 'stairs' | 'bricks' | 'movers'>
> & {
  /** Tiles of course consumed, so callers can lay motifs out end to end. */
  width: number;
};

function motif(parts: Partial<Motif> & { width: number }): Motif {
  return {
    pits: [],
    plats: [],
    solids: [],
    hills: [],
    walls: [],
    hangs: [],
    stairs: [],
    bricks: [],
    movers: [],
    ...parts,
  };
}

/** Concatenate motifs into one fragment ready to spread into a `CourseSpec`. */
export function merge(...motifs: Motif[]): Omit<Motif, 'width'> {
  return {
    pits: motifs.flatMap((m) => m.pits),
    plats: motifs.flatMap((m) => m.plats),
    solids: motifs.flatMap((m) => m.solids),
    hills: motifs.flatMap((m) => m.hills),
    walls: motifs.flatMap((m) => m.walls),
    hangs: motifs.flatMap((m) => m.hangs),
    stairs: motifs.flatMap((m) => m.stairs),
    bricks: motifs.flatMap((m) => m.bricks),
    movers: motifs.flatMap((m) => m.movers),
  };
}

/**
 * NSMB 1-1's opening: a block staircase that climbs into a pit, so the player has to
 * carry speed off the top step rather than walking off it.
 */
export function staircaseGap(x: number, steps: number, gap: GapWidth = GAP.standard): Motif {
  const climb = Math.min(steps, JUMP_REACH_TILES + 2);
  return motif({
    width: climb + gap + climb + 1,
    stairs: [
      [x, climb, 1],
      [x + climb + gap + climb, climb, -1],
    ],
    pits: [[x + climb, gap]],
  });
}

/**
 * NSMB's airborne ledge runs: a line of one-way islands at jump height with even
 * gaps, over a pit that punishes a missed beat.
 */
export function floatingIslandChain(
  x: number,
  count: number,
  gap: GapWidth = GAP.standard,
  tilesUp: number = LEDGE.low,
  overPit = true,
): Motif {
  const island = 3;
  const stride = island + gap;
  const span = count * stride - gap;
  const plats: [number, number, number][] = [];
  for (let i = 0; i < count; i += 1) {
    plats.push([x + i * stride, tilesUp, island]);
  }
  return motif({
    width: span + 2,
    plats,
    // Kept under the 8-tile sky-seal threshold so the motif never needs a ceiling.
    pits: overPit ? [[x + 1, Math.min(7, span - 2)]] : [],
  });
}

/**
 * A wall-jump chimney. Two pillars two tiles apart, with a ledge at the top so the
 * climb pays out. The interior is deliberately narrow: a single kick only carries
 * the player about 1.6 tiles before the arc peaks.
 */
export function wallJumpShaft(x: number, tilesHigh: number = LEDGE.mid): Motif {
  const height = Math.min(tilesHigh, LEDGE.high);
  const right = x + SHAFT_INTERIOR_TILES + 1;
  return motif({
    width: SHAFT_INTERIOR_TILES + 6,
    walls: [
      [x, height],
      [right, height],
    ],
    plats: [[right + 1, height, 3]],
  });
}

/**
 * An athletic-level crossing: a pit that can only be cleared by riding a plate.
 * The horizontal variant is a ferry; the vertical one is an elevator up to a ledge.
 */
export function moverCrossing(x: number, axis: 'x' | 'y', phase = 0): Motif {
  const pitWidth = 6;
  const mover: MoverSpec =
    axis === 'x'
      ? { x: x + 1, tilesUp: LEDGE.hop, w: 2, axis, span: pitWidth - 2, periodMs: 3200, phase }
      : { x: x + 2, tilesUp: LEDGE.low, w: 2, axis, span: LEDGE.mid - LEDGE.hop, periodMs: 2600, phase };
  return motif({
    width: pitWidth + 4,
    pits: [[x + 1, pitWidth]],
    movers: [mover],
    plats: axis === 'y' ? [[x + pitWidth + 1, LEDGE.mid, 3]] : [],
  });
}

/**
 * NSMB's brick ceilings: a run of breakable blocks overhead that seals a shortcut
 * until the player bumps through it from below.
 */
export function brickCeilingRun(x: number, w: number, tilesUp: number = LEDGE.mid): Motif {
  return motif({
    width: w + 2,
    bricks: [[x, tilesUp, w]],
    plats: [[x + Math.floor(w / 2) - 1, LEDGE.low, 3]],
  });
}

/**
 * NSMB 1-2's descending rhythm: alternating pits and ledges that step down, so the
 * player falls through the sequence at a steady beat instead of jumping up it.
 */
export function pitLedgeRhythm(x: number, beats: number, gap: GapWidth = GAP.standard): Motif {
  const stride = gap + 3;
  const pits: [number, number][] = [];
  const plats: [number, number, number][] = [];
  for (let i = 0; i < beats; i += 1) {
    const at = x + i * stride;
    pits.push([at, gap]);
    plats.push([at + gap, i % 2 === 0 ? LEDGE.low : LEDGE.hop, 3]);
  }
  return motif({ width: beats * stride + 2, pits, plats });
}

/**
 * A stepped tower. Each landing is one full jump above the last, which is how NSMB
 * gates its higher routes without asking for a single impossible leap.
 */
export function stepTower(x: number, landings: number): Motif {
  const plats: [number, number, number][] = [];
  for (let i = 0; i < landings; i += 1) {
    const tilesUp = Math.min(LEDGE.high, LEDGE.low + i * JUMP_REACH_TILES);
    plats.push([x + i * 4, tilesUp, 3]);
  }
  return motif({ width: landings * 4 + 2, plats });
}
