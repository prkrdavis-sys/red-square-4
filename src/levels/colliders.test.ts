import { describe, expect, it } from 'vitest';
import { GROUND_Y } from '../config';
import { colliderRuns, isBrickCell, isExposedTileTop, isSolidCell } from './colliders';
import { buildCourse, LEDGE } from './grid';

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

describe('breakable blocks', () => {
  it('blocks movement like a solid but is tracked separately', () => {
    expect(isSolidCell('b')).toBe(true);
    expect(isBrickCell('b')).toBe(true);
    expect(isBrickCell('#')).toBe(false);
  });

  it('stamps one tile per block at the requested height', () => {
    const rows = buildCourse({ width: 40, bricks: [[10, LEDGE.mid, 3]] });
    const row = rows[GROUND_Y - LEDGE.mid] ?? '';
    expect(row.slice(10, 13)).toBe('bbb');
    expect(row[9]).toBe('.');
    expect(row[13]).toBe('.');
  });

  it('never merges blocks into a shared collider, so one can be destroyed alone', () => {
    const rows = buildCourse({ width: 40, bricks: [[10, LEDGE.mid, 3]] });
    const brickRow = GROUND_Y - LEDGE.mid;
    expect(colliderRuns(rows).some((run) => run.tileY === brickRow)).toBe(false);
  });
});
