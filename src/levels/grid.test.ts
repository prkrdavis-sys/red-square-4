import { describe, expect, it } from 'vitest';
import { checkpointFractionsForStage } from './grid';

describe('checkpoint fractions', () => {
  it('keeps one mid-course flag on early stages and two on late stages', () => {
    expect(checkpointFractionsForStage(1)).toEqual([0.5]);
    expect(checkpointFractionsForStage(2)).toEqual([0.5]);
    expect(checkpointFractionsForStage(3)).toEqual([0.32, 0.62]);
    expect(checkpointFractionsForStage(4)).toEqual([0.32, 0.62]);
  });
});
