import { describe, expect, it } from 'vitest';
import { GROUND_Y } from '../config';
import { buildCourse, checkpointFractionsForStage, HANG_ROWS, LEDGE } from './grid';

describe('checkpoint fractions', () => {
  it('keeps one mid-course flag on early stages and two on late stages', () => {
    expect(checkpointFractionsForStage(1)).toEqual([0.5]);
    expect(checkpointFractionsForStage(2)).toEqual([0.5]);
    expect(checkpointFractionsForStage(3)).toEqual([0.32, 0.62]);
    expect(checkpointFractionsForStage(4)).toEqual([0.32, 0.62]);
  });
});

describe('sky ledges', () => {
  it('names cap and lid as the top two rows above the floor', () => {
    expect(LEDGE.cap).toBe(GROUND_Y - 1);
    expect(LEDGE.lid).toBe(GROUND_Y);
    expect(HANG_ROWS).toEqual([0, 1]);
  });

  it('seals rows 0–1 with hanging lids', () => {
    const rows = buildCourse({ width: 40, hangs: [[10, 4]] });
    expect(rows[0]?.slice(10, 14)).toBe('####');
    expect(rows[1]?.slice(10, 14)).toBe('####');
    expect(rows[2]?.slice(10, 14)).toBe('....');
  });
});
