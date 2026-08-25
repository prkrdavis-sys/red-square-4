import { describe, expect, it } from 'vitest';
import { COIN_DROP_CHANCE, shouldDropCoin } from './coin-drop';

describe('coin drops', () => {
  it('uses a 40% chance and treats the threshold as exclusive', () => {
    expect(COIN_DROP_CHANCE).toBe(0.4);
    expect(shouldDropCoin(() => 0)).toBe(true);
    expect(shouldDropCoin(() => 0.399)).toBe(true);
    expect(shouldDropCoin(() => 0.4)).toBe(false);
    expect(shouldDropCoin(() => 0.9)).toBe(false);
  });
});
