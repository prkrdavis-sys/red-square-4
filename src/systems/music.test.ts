import { describe, expect, it } from 'vitest';

import { THEMES } from '../config';
import { biomeSong, countSteps, parseDrums, toMidi } from './music';

describe('biome soundtracks', () => {
  it('maps note names to MIDI', () => {
    expect(toMidi('C4')).toBe(60);
    expect(toMidi('A4')).toBe(69);
    expect(toMidi('C#5')).toBe(73);
    expect(toMidi('Eb5')).toBe(75);
  });

  it('gives every biome a looping phrase on the grid', () => {
    for (const theme of THEMES) {
      const song = biomeSong(theme);
      expect(song.bpm).toBeGreaterThan(0);
      expect(countSteps(song.pulse1.notes)).toBe(song.length);
      expect(countSteps(song.pulse2.notes)).toBe(song.length);
      expect(countSteps(song.bass.notes)).toBe(song.length);
      expect(parseDrums(song.drums, song.length)).toHaveLength(song.length);
    }
  });
});
