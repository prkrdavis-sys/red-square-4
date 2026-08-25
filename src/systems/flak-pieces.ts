/** Shatter map for the 48×48 hero texture. Shared vertices keep the five shards gapless. */
export const HERO_FLAK_SIZE = 48;
export const FLAK_PIECE_COUNT = 5;

export type FlakPieceIndex = 0 | 1 | 2 | 3 | 4;

export const FLAK_PIECE_INDEXES: readonly FlakPieceIndex[] = [0, 1, 2, 3, 4];

export interface FlakPoint {
  x: number;
  y: number;
}

export interface FlakBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

const V = {
  nw: { x: 0, y: 0 },
  n: { x: 24, y: 0 },
  ne: { x: 48, y: 0 },
  e: { x: 48, y: 28 },
  se: { x: 48, y: 48 },
  s: { x: 25, y: 48 },
  sw: { x: 0, y: 48 },
  w: { x: 0, y: 26 },
  mid: { x: 24, y: 25 },
  tl: { x: 11, y: 28 },
  tr: { x: 37, y: 27 },
  bl: { x: 14, y: 39 },
  br: { x: 34, y: 38 },
  bm: { x: 24, y: 42 },
} as const;

export const FLAK_PIECE_POLYS: readonly (readonly FlakPoint[])[] = [
  [V.nw, V.n, V.mid, V.tl, V.w],
  [V.n, V.ne, V.e, V.tr, V.mid],
  [V.tr, V.e, V.se, V.s, V.bm, V.br],
  [V.tl, V.bl, V.bm, V.s, V.sw, V.w],
  [V.mid, V.tr, V.br, V.bm, V.bl, V.tl],
];

export function isFlakPieceIndex(value: number): value is FlakPieceIndex {
  return Number.isInteger(value) && value >= 0 && value < FLAK_PIECE_COUNT;
}

export function flakHeroTextureKey(index: FlakPieceIndex): string {
  return `flak-hero-${index}`;
}

export function flakPiecePoly(index: FlakPieceIndex): readonly FlakPoint[] {
  return FLAK_PIECE_POLYS[index] ?? FLAK_PIECE_POLYS[0] ?? [];
}

export function pointInFlakPoly(x: number, y: number, poly: readonly FlakPoint[]): boolean {
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

export function flakPieceAt(x: number, y: number): FlakPieceIndex | undefined {
  for (const index of FLAK_PIECE_INDEXES) {
    if (pointInFlakPoly(x, y, flakPiecePoly(index))) {
      return index;
    }
  }
  return undefined;
}

export function flakPieceBounds(index: FlakPieceIndex): FlakBounds {
  const poly = flakPiecePoly(index);
  let minX = HERO_FLAK_SIZE;
  let minY = HERO_FLAK_SIZE;
  let maxX = 0;
  let maxY = 0;
  for (const point of poly) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function flakPieceArea(index: FlakPieceIndex): number {
  const poly = flakPiecePoly(index);
  let sum = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (!a || !b) {
      continue;
    }
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function flakPieceCentroid(index: FlakPieceIndex): FlakPoint {
  const poly = flakPiecePoly(index);
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
