import { describe, expect, it } from 'vitest';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { HUD_PAUSE, pauseButtonScreenRect } from './hud-pause';

describe('pauseButtonScreenRect', () => {
  it('matches game coordinates when the canvas is 1:1', () => {
    const box = pauseButtonScreenRect({ left: 0, top: 0, width: GAME_WIDTH, height: GAME_HEIGHT });
    expect(box.width).toBe(HUD_PAUSE.width);
    expect(box.height).toBe(HUD_PAUSE.height);
    expect(box.left).toBe(HUD_PAUSE.x - HUD_PAUSE.width / 2);
    expect(box.top).toBe(HUD_PAUSE.y - HUD_PAUSE.height / 2);
  });

  it('keeps a 48px tap target when the canvas is scaled down', () => {
    const half = pauseButtonScreenRect({ left: 40, top: 10, width: GAME_WIDTH / 2, height: GAME_HEIGHT / 2 });
    expect(half.width).toBe(HUD_PAUSE.width / 2);
    expect(half.height).toBe(48);
    expect(half.left).toBe(40 + HUD_PAUSE.x / 2 - half.width / 2);
    expect(half.top).toBe(18);

    const tiny = pauseButtonScreenRect({ left: 0, top: 0, width: GAME_WIDTH / 8, height: GAME_HEIGHT / 8 });
    expect(tiny.width).toBe(48);
    expect(tiny.height).toBe(48);
    expect(tiny.top).toBeGreaterThanOrEqual(8);
    expect(tiny.left + tiny.width).toBeLessThanOrEqual(GAME_WIDTH / 8);
  });
});
