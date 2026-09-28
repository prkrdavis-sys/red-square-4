import { describe, expect, it } from 'vitest';
import { TILE } from '../config';
import { CONSOLE_REACH_PX, canPressConsole } from './escape-console';

describe('escape console', () => {
  const x = 214 * TILE + TILE / 2;

  it('answers a grounded player at the console once the stalker is gone', () => {
    expect(canPressConsole(x, x, true, true)).toBe(true);
    expect(canPressConsole(x, x + CONSOLE_REACH_PX, true, true)).toBe(true);
  });

  it('stays dead while the stalker is still chasing', () => {
    expect(canPressConsole(x, x, true, false)).toBe(false);
  });

  it('ignores players who are airborne or out of reach', () => {
    expect(canPressConsole(x, x, false, true)).toBe(false);
    expect(canPressConsole(x, x - CONSOLE_REACH_PX - 1, true, true)).toBe(false);
  });
});
