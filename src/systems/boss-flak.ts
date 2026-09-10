export const BOSS_FLAK_SIZE = 64;
export const BOSS_FLAK_COUNT = 7;
export const BOSS_DEATH_BLAST_MS = 1100;
/** Peak scale of the 96px blast-core. Kept small so bosses do not screen-wipe. */
export const BOSS_BLAST_CORE_PEAK = 1.65;
export const BOSS_BLAST_RING_PEAK = 2.05;

export type BossFlakIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const BOSS_FLAK_INDEXES: readonly BossFlakIndex[] = [0, 1, 2, 3, 4, 5, 6];

export interface BossFlakPoint {
  x: number;
  y: number;
}

const V = {
  nw: { x: 0, y: 0 },
  n: { x: 32, y: 0 },
  ne: { x: 64, y: 0 },
  e: { x: 64, y: 32 },
  se: { x: 64, y: 64 },
  s: { x: 32, y: 64 },
  sw: { x: 0, y: 64 },
  w: { x: 0, y: 32 },
  ia: { x: 24, y: 18 },
  ib: { x: 40, y: 18 },
  ic: { x: 50, y: 32 },
  id: { x: 40, y: 46 },
  ie: { x: 24, y: 46 },
  iff: { x: 14, y: 32 },
} as const;

/** Six outer shards plus a center piece, covering the whole 64×64 stamp. */
export const BOSS_FLAK_POLYS: readonly (readonly BossFlakPoint[])[] = [
  [V.nw, V.n, V.ia, V.iff, V.w],
  [V.n, V.ne, V.ib, V.ia],
  [V.ne, V.e, V.ic, V.ib],
  [V.e, V.se, V.s, V.id, V.ic],
  [V.s, V.sw, V.ie, V.id],
  [V.sw, V.w, V.iff, V.ie],
  [V.ia, V.ib, V.ic, V.id, V.ie, V.iff],
];

export function isBossFlakIndex(value: number): value is BossFlakIndex {
  return Number.isInteger(value) && value >= 0 && value < BOSS_FLAK_COUNT;
}

export function bossFlakPoly(index: BossFlakIndex): readonly BossFlakPoint[] {
  return BOSS_FLAK_POLYS[index] ?? BOSS_FLAK_POLYS[0] ?? [];
}

export function pointInBossFlakPoly(x: number, y: number, poly: readonly BossFlakPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; i += 1) {
    const current = poly[i];
    const previous = poly[j];
    if (!current || !previous) {
      j = i;
      continue;
    }
    const crosses =
      current.y > y !== previous.y > y &&
      x < ((previous.x - current.x) * (y - current.y)) / (previous.y - current.y) + current.x;
    if (crosses) {
      inside = !inside;
    }
    j = i;
  }
  return inside;
}

export function bossFlakAt(x: number, y: number): BossFlakIndex | undefined {
  for (const index of BOSS_FLAK_INDEXES) {
    if (pointInBossFlakPoly(x, y, bossFlakPoly(index))) {
      return index;
    }
  }
  return undefined;
}

export function scaleBossFlakPoly(
  index: BossFlakIndex,
  width: number,
  height: number,
): BossFlakPoint[] {
  const scaleX = width / BOSS_FLAK_SIZE;
  const scaleY = height / BOSS_FLAK_SIZE;
  return bossFlakPoly(index).map((point) => ({ x: point.x * scaleX, y: point.y * scaleY }));
}

export function bossFlakCentroid(index: BossFlakIndex, width: number, height: number): BossFlakPoint {
  const poly = scaleBossFlakPoly(index, width, height);
  let cx = 0;
  let cy = 0;
  let area2 = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (!a || !b) {
      continue;
    }
    const cross = a.x * b.y - b.x * a.y;
    area2 += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  const denom = area2 * 3;
  if (Math.abs(denom) < 1e-6) {
    const count = poly.length || 1;
    return {
      x: poly.reduce((sum, point) => sum + point.x, 0) / count,
      y: poly.reduce((sum, point) => sum + point.y, 0) / count,
    };
  }
  return { x: cx / denom, y: cy / denom };
}
