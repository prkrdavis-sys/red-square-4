import { describe, expect, it } from 'vitest';

import { THEMES } from '../config';
import { crossfadeLoop, loopableLength, recordedThemeUrl } from './music-loop';

describe('recorded theme tracks', () => {
  it('uses the overworld recording only for grass / world 1', () => {
    expect(recordedThemeUrl('grass')).toBe('assets/audio/grass-overworld.mp3');
    for (const theme of THEMES) {
      if (theme !== 'grass') {
        expect(recordedThemeUrl(theme)).toBeNull();
      }
    }
  });
});

describe('seamless loop prep', () => {
  it('trims a quiet fade-out tail', () => {
    const sr = 1000;
    const samples = new Float32Array(sr * 4);
    samples.fill(0.2, 0, sr * 3);
    samples.fill(0.002, sr * 3);
    expect(loopableLength(samples, sr, 0.04, 80)).toBeLessThanOrEqual(sr * 3 + 80);
    expect(loopableLength(samples, sr, 0.04, 80)).toBeGreaterThan(sr * 2.5);
  });

  it('keeps a full-energy phrase', () => {
    const samples = new Float32Array(800);
    samples.fill(0.2);
    expect(loopableLength(samples, 1000, 0.04, 80)).toBe(800);
  });

  it('overlaps the tail onto the start so the wrap is continuous', () => {
    const fade = 8;
    const input = new Float32Array(32);
    for (let i = 0; i < input.length; i += 1) {
      input[i] = i;
    }
    const looped = crossfadeLoop(input, fade);
    expect(looped).toHaveLength(input.length - fade);
    expect(looped[0]).toBeCloseTo(input[looped.length] ?? 0, 5);
    expect(looped[looped.length - 1]).toBeCloseTo(input[looped.length - 1] ?? 0, 5);
  });

  it('leaves short clips unchanged', () => {
    const input = new Float32Array([0.1, -0.2, 0.3]);
    expect(Array.from(crossfadeLoop(input, 2))).toEqual(Array.from(input));
  });
});
