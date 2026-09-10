import { describe, expect, it } from 'vitest';
import { smoothPredictionCorrection } from './snapshot';

describe('prediction correction', () => {
  it('smooths small corrections and snaps large divergence', () => {
    const predicted = { x: 0, y: 0, velocityX: 2, velocityY: 0 };
    const nearby = { x: 4, y: 0, velocityX: 4, velocityY: 0 };
    expect(smoothPredictionCorrection(predicted, nearby, 0.25, 10)).toEqual({
      x: 1,
      y: 0,
      velocityX: 2.5,
      velocityY: 0,
    });
    const far = { x: 20, y: 0, velocityX: 0, velocityY: 0 };
    expect(smoothPredictionCorrection(predicted, far, 0.25, 10)).toEqual(far);
  });
});
