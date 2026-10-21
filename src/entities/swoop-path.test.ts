import { describe, expect, it } from 'vitest';
import { sampleSwoop, swoopParameter, swoopPath, swoopPointAt, SWOOP_DURATION_MS } from './swoop-path';

describe('swoop path', () => {
  it('ends on the locked target and dips below the straight line', () => {
    const path = swoopPath({ x: 100, y: 80 }, { x: 420, y: 200 });
    expect(sampleSwoop(path, 0)).toEqual({ x: 100, y: 80 });
    expect(sampleSwoop(path, 1)).toEqual({ x: 420, y: 200 });
    const mid = sampleSwoop(path, swoopParameter(path, 0.5));
    expect(mid.y).toBeGreaterThan((80 + 200) / 2);
    expect(path.control.y).toBeGreaterThan(path.start.y);
    expect(path.control.y).toBeGreaterThan(path.end.y);
  });

  it('keeps the committed curve when the player has moved', () => {
    const locked = swoopPath({ x: 0, y: 40 }, { x: 200, y: 160 });
    const later = swoopPath({ x: 0, y: 40 }, { x: 30, y: 20 });
    expect(swoopPointAt(locked, SWOOP_DURATION_MS)).toEqual({ x: 200, y: 160 });
    expect(swoopPointAt(later, SWOOP_DURATION_MS).x).not.toBe(200);
  });

  it('travels about a quarter of the arc in a quarter of the time', () => {
    const path = swoopPath({ x: 40, y: 60 }, { x: 360, y: 220 });
    const early = swoopPointAt(path, SWOOP_DURATION_MS * 0.25);
    const half = swoopPointAt(path, SWOOP_DURATION_MS * 0.5);
    const earlySpan = Math.hypot(early.x - path.start.x, early.y - path.start.y);
    const halfSpan = Math.hypot(half.x - path.start.x, half.y - path.start.y);
    expect(halfSpan).toBeGreaterThan(earlySpan * 1.6);
    expect(halfSpan).toBeLessThan(earlySpan * 2.4);
  });
});
