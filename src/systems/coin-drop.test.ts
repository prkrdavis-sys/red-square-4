import { describe, expect, it } from 'vitest';
import { COIN_DROP_CHANCE, shouldDropCoin } from './coin-drop';

describe('coin drops', () => {
  it('uses a 25% chance and treats the threshold as exclusive', () => {
    expect(COIN_DROP_CHANCE).toBe(0.25);
    expect(shouldDropCoin(() => 0)).toBe(true);
    expect(shouldDropCoin(() => 0.249)).toBe(true);
    expect(shouldDropCoin(() => 0.25)).toBe(false);
    expect(shouldDropCoin(() => 0.9)).toBe(false);
  });
});
