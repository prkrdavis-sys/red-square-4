import { describe, expect, it } from 'vitest';
import { MENU_OPEN_GUARD_MS, MENU_TAP_LOCK_MS, menuDismissIsArmed, shouldAcceptTap } from './menu-tap';

describe('shouldAcceptTap', () => {
  it('accepts the first tap and ignores a ghost click in the lock window', () => {
    expect(shouldAcceptTap(Number.NEGATIVE_INFINITY, 0)).toBe(true);
    expect(shouldAcceptTap(1000, 1000 + MENU_TAP_LOCK_MS - 1)).toBe(false);
    expect(shouldAcceptTap(1000, 1000 + MENU_TAP_LOCK_MS)).toBe(true);
  });
});

describe('menuDismissIsArmed', () => {
  it('stays closed until the opening gesture has aged out', () => {
    expect(menuDismissIsArmed(undefined, 500)).toBe(false);
    expect(menuDismissIsArmed(100, 100 + MENU_OPEN_GUARD_MS - 1)).toBe(false);
    expect(menuDismissIsArmed(100, 100 + MENU_OPEN_GUARD_MS)).toBe(true);
  });
});
