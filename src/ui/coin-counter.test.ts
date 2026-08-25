import { describe, expect, it } from 'vitest';

import { coinCounterLabel } from './coin-counter';

describe('coinCounterLabel', () => {
  it('shows the running wallet total', () => {
    expect(coinCounterLabel(0)).toBe('COINS  0');
    expect(coinCounterLabel(40)).toBe('COINS  40');
  });
});
