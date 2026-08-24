import { describe, expect, it } from 'vitest';
import { HELD_SHIELD_OFFSET_X, heldShieldPosition } from './held-shield';

describe('heldShieldPosition', () => {
  it('places the shield in front of the facing direction', () => {
    const right = heldShieldPosition(100, 80, false);
    const left = heldShieldPosition(100, 80, true);
    expect(right.x).toBe(100 + HELD_SHIELD_OFFSET_X);
    expect(left.x).toBe(100 - HELD_SHIELD_OFFSET_X);
    expect(right.y).toBe(left.y);
    expect(right.x - 100).toBe(-(left.x - 100));
  });
});
