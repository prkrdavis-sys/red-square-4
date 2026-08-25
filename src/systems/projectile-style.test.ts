import { describe, expect, it } from 'vitest';
import { THEMES, enemiesForWorld, type Theme } from '../config';
import {
  boomerangHomeVelocity,
  bubbleSpreadOffsets,
  projectileStyleForKind,
  projectileStyleForTheme,
  steerToward,
  type ProjectileStyle,
} from './projectile-style';

const STYLE_BY_THEME: Record<Theme, ProjectileStyle> = {
  grass: 'thorn',
  snow: 'icicle',
  desert: 'cactus',
  ocean: 'bubble',
  castle: 'fireball',
  rainforest: 'boomerang',
};

describe('projectile styles', () => {
  it('maps every theme to its world projectile', () => {
    for (const theme of THEMES) {
      expect(projectileStyleForTheme(theme)).toBe(STYLE_BY_THEME[theme]);
    }
  });

  it('maps every enemy kind to its world projectile', () => {
    const worlds: Array<{ world: number; style: ProjectileStyle }> = [
      { world: 1, style: 'thorn' },
      { world: 2, style: 'icicle' },
      { world: 3, style: 'cactus' },
      { world: 4, style: 'bubble' },
      { world: 5, style: 'fireball' },
      { world: 6, style: 'boomerang' },
    ];
    for (const { world, style } of worlds) {
      for (const kind of enemiesForWorld(world)) {
        expect(projectileStyleForKind(kind)).toBe(style);
      }
    }
  });

  it('spreads bubbles across three unique headings', () => {
    const offsets = bubbleSpreadOffsets();
    expect(offsets).toHaveLength(3);
    expect(new Set(offsets).size).toBe(3);
    expect(offsets[1]).toBe(0);
    expect(offsets[0]).toBeLessThan(0);
    expect(offsets[2]).toBeGreaterThan(0);
    expect(offsets[2]).toBeCloseTo(-offsets[0], 8);
  });

  it('does not let a fireball snap 180 degrees in one steer step', () => {
    const steered = steerToward(100, 0, -80, 0, 0.35, 100);
    expect(steered.vx).toBeGreaterThan(0);
    expect(Math.hypot(steered.vx, steered.vy)).toBeCloseTo(100, 6);
  });

  it('sends a returning boomerang back toward its owner', () => {
    const home = boomerangHomeVelocity(40, 80, 200, 20, 180);
    expect(home.vx).toBeGreaterThan(0);
    expect(home.vy).toBeLessThan(0);
    expect(Math.hypot(home.vx, home.vy)).toBeCloseTo(180, 6);
  });
});
