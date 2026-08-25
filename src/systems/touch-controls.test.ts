import { describe, expect, it } from 'vitest';
import {
  initialMoveFromPress,
  isPrimaryPointer,
  MOVE_DEADZONE_PX,
  moveDirectionFromDelta,
  pointHitsRect,
  sliderThumbOffset,
  steerMoveAxis,
} from './touch-controls';

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

describe('initialMoveFromPress', () => {
  it('uses the tapped arrow immediately', () => {
    expect(initialMoveFromPress('left', 200, 80)).toBe('left');
    expect(initialMoveFromPress('right', 40, 80)).toBe('right');
  });

  it('falls back to the press side of the slider when no arrow is hit', () => {
    expect(initialMoveFromPress(null, 40, 80)).toBe('left');
    expect(initialMoveFromPress(null, 80, 80)).toBe('right');
    expect(initialMoveFromPress(null, 120, 80)).toBe('right');
  });
});

describe('steerMoveAxis', () => {
  it('keeps the selected direction inside the deadzone so a tap keeps moving', () => {
    expect(steerMoveAxis(0, 'left')).toBe('left');
    expect(steerMoveAxis(0, 'right')).toBe('right');
    expect(steerMoveAxis(MOVE_DEADZONE_PX - 1, 'left')).toBe('left');
  });

  it('lets a slide reverse direction without a new tap', () => {
    expect(steerMoveAxis(MOVE_DEADZONE_PX, 'left')).toBe('right');
    expect(steerMoveAxis(-MOVE_DEADZONE_PX, 'right')).toBe('left');
  });
});

describe('pointHitsRect', () => {
  it('includes padding around the arrow', () => {
    const rect = { left: 20, top: 20, right: 40, bottom: 40 };
    expect(pointHitsRect(28, 28, rect, 16)).toBe(true);
    expect(pointHitsRect(8, 28, rect, 16)).toBe(true);
    expect(pointHitsRect(0, 28, rect, 16)).toBe(false);
  });
});

describe('isPrimaryPointer', () => {
  it('accepts iOS touch events that report button -1', () => {
    expect(isPrimaryPointer({ button: -1, pointerType: 'touch', isPrimary: true })).toBe(true);
    expect(isPrimaryPointer({ button: 0, pointerType: 'touch' })).toBe(true);
  });

  it('rejects extra mouse buttons and non-primary pointers', () => {
    expect(isPrimaryPointer({ button: 2, pointerType: 'mouse', isPrimary: true })).toBe(false);
    expect(isPrimaryPointer({ button: 0, pointerType: 'touch', isPrimary: false })).toBe(false);
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
