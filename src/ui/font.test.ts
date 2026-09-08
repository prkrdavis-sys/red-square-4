import { afterEach, describe, expect, it, vi } from 'vitest';
import { UI_FONT_WAIT_MS, waitForUiFont } from './font';

describe('waitForUiFont', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('returns immediately when the fonts API is missing', async () => {
    vi.stubGlobal('document', {});
    await expect(waitForUiFont()).resolves.toBeUndefined();
  });

  it('does not wait forever if the font never loads', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('document', {
      fonts: {
        load: () => new Promise(() => undefined),
      },
    });
    const pending = waitForUiFont();
    await vi.advanceTimersByTimeAsync(UI_FONT_WAIT_MS);
    await expect(pending).resolves.toBeUndefined();
  });
});
