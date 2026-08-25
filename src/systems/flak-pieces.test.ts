import { describe, expect, it } from 'vitest';
import {
  FLAK_PIECE_COUNT,
  FLAK_PIECE_INDEXES,
  HERO_FLAK_SIZE,
  flakHeroTextureKey,
  flakPieceArea,
  flakPieceAt,
  flakPieceBounds,
  flakPieceCentroid,
} from './flak-pieces';

const FEATURES = {
  gloss: { x: 12, y: 8, piece: 0 },
  leftEye: { x: 16, y: 19, piece: 0 },
  rightEye: { x: 32, y: 19, piece: 1 },
  held: { x: 40, y: 22, piece: 1 },
  rightBoot: { x: 34, y: 43, piece: 2 },
  leftBoot: { x: 13, y: 43, piece: 3 },
  mouth: { x: 24, y: 32, piece: 4 },
} as const;

describe('hero flak shatter', () => {
  it('splits the hero into five named shards', () => {
    expect(FLAK_PIECE_INDEXES).toHaveLength(FLAK_PIECE_COUNT);
    expect(FLAK_PIECE_COUNT).toBe(5);
    for (const index of FLAK_PIECE_INDEXES) {
      expect(flakHeroTextureKey(index)).toBe(`flak-hero-${index}`);
      expect(flakPieceArea(index)).toBeGreaterThan(180);
      const box = flakPieceBounds(index);
      expect(box.w).toBeGreaterThan(10);
      expect(box.h).toBeGreaterThan(10);
      const center = flakPieceCentroid(index);
      expect(center.x).toBeGreaterThan(0);
      expect(center.x).toBeLessThan(HERO_FLAK_SIZE);
      expect(center.y).toBeGreaterThan(0);
      expect(center.y).toBeLessThan(HERO_FLAK_SIZE);
    }
  });

  it('keeps face, boots, and kit on separate readable pieces', () => {
    for (const feature of Object.values(FEATURES)) {
      expect(flakPieceAt(feature.x, feature.y)).toBe(feature.piece);
    }
  });

  it('covers the whole hero texture without holes', () => {
    let missing = 0;
    for (let y = 0.5; y < HERO_FLAK_SIZE; y += 1) {
      for (let x = 0.5; x < HERO_FLAK_SIZE; x += 1) {
        if (flakPieceAt(x, y) === undefined) {
          missing += 1;
        }
      }
    }
    expect(missing).toBe(0);
  });
});
