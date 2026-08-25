import { describe, expect, it } from 'vitest';
import { THEMES, themePhysics } from '../config';
import {
  airJumpHint,
  airJumpMode,
  applySwimStroke,
  canCarpetGlide,
  canSwimStroke,
  carpetGlideVelocity,
  carpetTrailPosition,
  CARPET_GLIDE_DAMP,
  CARPET_GLIDE_MAX_FALL,
  CARPET_TRAIL_OFFSET_X,
  flyingCarpetPosition,
  swimStrokeVelocity,
} from './air-jump';

describe('airJumpMode', () => {
  it('maps ocean to swim and desert to carpet, and leaves the rest stock', () => {
    expect(airJumpMode('ocean')).toBe('swim-stroke');
    expect(airJumpMode('desert')).toBe('carpet-glide');
    expect(airJumpMode('grass')).toBe('none');
    expect(airJumpMode('snow')).toBe('none');
    expect(airJumpMode('castle')).toBe('none');
    expect(airJumpMode('rainforest')).toBe('none');
  });

  it('covers every theme', () => {
    for (const theme of THEMES) {
      expect(airJumpMode(theme)).toMatch(/^(none|swim-stroke|carpet-glide)$/);
    }
  });
});

describe('airJumpHint', () => {
  it('explains swim and carpet, and stays quiet elsewhere', () => {
    expect(airJumpHint('ocean')).toBe('Tap jump in the air to swim.');
    expect(airJumpHint('desert')).toBe('Hold jump in the air to ride a flying carpet.');
    expect(airJumpHint('grass')).toBeNull();
    expect(airJumpHint('snow')).toBeNull();
    expect(airJumpHint('castle')).toBeNull();
    expect(airJumpHint('rainforest')).toBeNull();
  });
});

describe('swim strokes', () => {
  const gravity = themePhysics('ocean').gravity;

  it('launches a weaker stroke than a ground jump', () => {
    const stroke = swimStrokeVelocity(gravity);
    const jump = themePhysics('ocean').jump;
    expect(stroke).toBeLessThan(0);
    expect(stroke).toBeGreaterThan(jump);
  });

  it('replaces fall or rise with the stroke speed', () => {
    const stroke = swimStrokeVelocity(gravity);
    expect(applySwimStroke(stroke)).toBe(stroke);
  });

  it('fires on a mid-air tap when unlocked and ready', () => {
    expect(
      canSwimStroke({
        jumpLocked: false,
        grounded: false,
        jumpJust: true,
        now: 400,
        strokeReadyAt: 260,
      }),
    ).toBe(true);
  });

  it('rejects locked, grounded, held, or cooling-down strokes', () => {
    const ready = {
      jumpLocked: false,
      grounded: false,
      jumpJust: true,
      now: 400,
      strokeReadyAt: 260,
    };
    expect(canSwimStroke({ ...ready, jumpLocked: true })).toBe(false);
    expect(canSwimStroke({ ...ready, grounded: true })).toBe(false);
    expect(canSwimStroke({ ...ready, jumpJust: false })).toBe(false);
    expect(canSwimStroke({ ...ready, now: 200 })).toBe(false);
  });
});

describe('carpet glide', () => {
  it('only slows a held falling jump', () => {
    expect(canCarpetGlide({ jumpHeld: true, grounded: false, velocityY: 80 })).toBe(true);
    expect(canCarpetGlide({ jumpHeld: false, grounded: false, velocityY: 80 })).toBe(false);
    expect(canCarpetGlide({ jumpHeld: true, grounded: true, velocityY: 80 })).toBe(false);
    expect(canCarpetGlide({ jumpHeld: true, grounded: false, velocityY: -20 })).toBe(false);
    expect(canCarpetGlide({ jumpHeld: true, grounded: false, velocityY: 20 })).toBe(false);
  });

  it('damps and caps downward speed, and leaves a rise alone', () => {
    expect(carpetGlideVelocity(-120)).toBe(-120);
    expect(carpetGlideVelocity(80)).toBeCloseTo(80 * CARPET_GLIDE_DAMP);
    expect(carpetGlideVelocity(400)).toBe(CARPET_GLIDE_MAX_FALL);
  });

  it('parks the rug under the hero and trails behind facing', () => {
    const pos = flyingCarpetPosition(100, 80, 0);
    expect(pos.x).toBe(100);
    expect(pos.y).toBeGreaterThan(80);
    expect(carpetTrailPosition(100, 110, false).x).toBe(100 - CARPET_TRAIL_OFFSET_X);
    expect(carpetTrailPosition(100, 110, true).x).toBe(100 + CARPET_TRAIL_OFFSET_X);
  });
});
