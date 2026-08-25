import { describe, expect, it } from 'vitest';
import { clamp01, specialChargeRatio, specialMeterFillWidth } from './special-cooldown';

describe('specialChargeRatio', () => {
  it('is full when the cooldown is spent', () => {
    expect(specialChargeRatio(0)).toBe(1);
  });

  it('is empty just after the special is used', () => {
    expect(specialChargeRatio(1)).toBe(0);
  });

  it('fills as remaining cooldown drops', () => {
    expect(specialChargeRatio(0.25)).toBe(0.75);
  });

  it('clamps values outside 0-1', () => {
    expect(specialChargeRatio(-0.2)).toBe(1);
    expect(specialChargeRatio(2)).toBe(0);
    expect(clamp01(Number.NaN)).toBe(0);
  });
});

describe('specialMeterFillWidth', () => {
  it('scales the bar to the charge', () => {
    expect(specialMeterFillWidth(0, 200)).toBe(0);
    expect(specialMeterFillWidth(0.5, 200)).toBe(100);
    expect(specialMeterFillWidth(1, 200)).toBe(200);
  });
});
