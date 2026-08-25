import { describe, expect, it } from 'vitest';
import { MOVE_DEADZONE_PX, moveDirectionFromDelta, sliderThumbOffset } from './touch-controls';

describe('moveDirectionFromDelta', () => {
  it('stays idle inside the deadzone, including a tap with no drag', () => {
    expect(moveDirectionFromDelta(0)).toBeNull();
    expect(moveDirectionFromDelta(MOVE_DEADZONE_PX - 1)).toBeNull();
    expect(moveDirectionFromDelta(-(MOVE_DEADZONE_PX - 1))).toBeNull();
  });

  it('turns right only after dragging past the press point', () => {
    expect(moveDirectionFromDelta(MOVE_DEADZONE_PX)).toBe('right');
    expect(moveDirectionFromDelta(96)).toBe('right');
  });

  it('turns left only after dragging past the press point', () => {
    expect(moveDirectionFromDelta(-MOVE_DEADZONE_PX)).toBe('left');
    expect(moveDirectionFromDelta(-96)).toBe('left');
  });
});

describe('sliderThumbOffset', () => {
  it('follows the drag and clamps to the track', () => {
    expect(sliderThumbOffset(12, 48)).toBe(12);
    expect(sliderThumbOffset(-12, 48)).toBe(-12);
    expect(sliderThumbOffset(400, 48)).toBe(48);
    expect(sliderThumbOffset(-400, 48)).toBe(-48);
  });
});
