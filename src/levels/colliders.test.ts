import { describe, expect, it } from 'vitest';
import { isExposedTileTop, isSolidCell } from './colliders';

describe('exposed tile tops', () => {
  it('treats full solids as cover and platforms as open air', () => {
    expect(isSolidCell('#')).toBe(true);
    expect(isSolidCell('@')).toBe(true);
    expect(isSolidCell('=')).toBe(false);
    expect(isSolidCell('.')).toBe(false);
  });

  it('caps only the air-facing tile in a stacked column', () => {
    const rows = ['....', '.##.', '.##.', '####'];
    expect(isExposedTileTop(rows, 1, 0)).toBe(true);
    expect(isExposedTileTop(rows, 1, 1)).toBe(true);
    expect(isExposedTileTop(rows, 1, 2)).toBe(false);
    expect(isExposedTileTop(rows, 1, 3)).toBe(false);
    expect(isExposedTileTop(rows, 0, 3)).toBe(true);
  });
});
