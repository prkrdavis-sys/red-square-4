import { afterEach, describe, expect, it, vi } from 'vitest';
import { dismissBootSplash } from './boot-splash';

describe('dismissBootSplash', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('is a no-op when the splash node is missing', () => {
    vi.stubGlobal('document', { getElementById: () => null });
    expect(() => dismissBootSplash()).not.toThrow();
  });

  it('fades and removes the splash once', () => {
    vi.useFakeTimers();
    const listeners = new Map<string, () => void>();
    const splash = {
      classList: {
        tokens: new Set<string>(),
        contains(name: string) {
          return this.tokens.has(name);
        },
        add(name: string) {
          this.tokens.add(name);
        },
      },
      addEventListener(type: string, listener: () => void) {
        listeners.set(type, listener);
      },
      remove: vi.fn(),
    };
    vi.stubGlobal('document', { getElementById: () => splash });

    dismissBootSplash();
    dismissBootSplash();

    expect(splash.classList.contains('is-done')).toBe(true);
    expect(listeners.has('transitionend')).toBe(true);

    listeners.get('transitionend')?.();
    expect(splash.remove).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(400);
    expect(splash.remove).toHaveBeenCalledTimes(1);
  });
});
