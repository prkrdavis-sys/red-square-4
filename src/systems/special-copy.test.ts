import { describe, expect, it } from 'vitest';
import { THEMES, specialForTheme, type SpecialKind } from '../config';
import { specialDescription, specialLabel } from './special-copy';

const COPY: Record<SpecialKind, { label: string; description: string }> = {
  grow: { label: 'Grow', description: 'Sprout a short-lived platform ahead of you.' },
  'frost-path': { label: 'Frost', description: 'Dash forward and lay a trail of ice.' },
  'sand-surge': { label: 'Surge', description: 'Burst up and forward on a dune.' },
  'bubble-pulse': { label: 'Bubble', description: 'Launch yourself on a rising bubble.' },
  'shadow-blink': { label: 'Blink', description: 'Blink a short distance in the direction you face.' },
  'liana-swing': { label: 'Swing', description: 'Grab a vine and swing forward.' },
};

describe('world special copy', () => {
  it('names and describes every biome special', () => {
    for (const theme of THEMES) {
      const kind = specialForTheme(theme);
      expect(specialLabel(kind)).toBe(COPY[kind].label);
      expect(specialDescription(kind)).toBe(COPY[kind].description);
    }
  });
});
