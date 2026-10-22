import { describe, expect, it } from 'vitest';
import { ALL_THEMES, type Theme } from '../config';
import { foregroundPropIds } from './foreground';

const ESSENTIALS = ['pumpkin', 'jack'] as const;

const BASE_IDS: Record<Theme, readonly string[]> = {
  grass: ['tuft', 'stone', 'daisy', 'flowers', 'shroom', 'clump', 'fern', 'bush', 'bush-lg'],
  snow: ['tuft', 'cap', 'rock', 'mound', 'drift', 'crystals', 'snowman', 'pine'],
  desert: ['grass', 'ridge', 'rock', 'bloom', 'skull', 'pot', 'tumble', 'pear', 'cactus'],
  ocean: ['grass', 'reed', 'shell', 'star', 'stone', 'anemone', 'fan', 'coral', 'kelp'],
  castle: ['rubble', 'cobble', 'bones', 'spike', 'bramble', 'fence', 'column', 'candelabra', 'gargoyle'],
  rainforest: ['tuft', 'bank', 'moss', 'shroom', 'orchid', 'bloom', 'drip', 'vine', 'fern', 'leaf'],
  beach: ['tuft', 'shell', 'star', 'stone', 'drift', 'grass', 'palm', 'umbrella'],
  'rainy-city': ['puddle', 'trash', 'hydrant', 'barrier', 'umbrella', 'neon-sign', 'cables'],
  backrooms: ['stain', 'bottle', 'box', 'wet-sign', 'chair'],
};

describe('halloween foreground props', () => {
  it('keeps the everyday kit when the seasonal set is off', () => {
    for (const theme of ALL_THEMES) {
      expect(foregroundPropIds(theme, false)).toEqual(BASE_IDS[theme]);
    }
  });

  it('gives every theme pumpkins plus at least two biome props', () => {
    for (const theme of ALL_THEMES) {
      const ids = foregroundPropIds(theme, true);
      const base = new Set(foregroundPropIds(theme, false));
      expect(new Set(ids).size, theme).toBe(ids.length);
      expect(ids, theme).toEqual(expect.arrayContaining([...ESSENTIALS]));
      const extras = ids.filter((id) => !base.has(id) && !ESSENTIALS.includes(id as (typeof ESSENTIALS)[number]));
      expect(extras.length, `${theme} ${extras.join(',')}`).toBeGreaterThanOrEqual(2);
    }
  });
});
