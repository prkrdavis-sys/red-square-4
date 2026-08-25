import { describe, expect, it } from 'vitest';
import { THEMES, TILE, hazardForTheme, type TerrainHazardKind } from '../config';
import {
  SHOTGUN_OFFSETS_DEG,
  beamLethal,
  extraHillsForTraps,
  hazardAttackMs,
  hazardMount,
  hazardTelegraphMs,
  hazardThreatensTile,
  hazardUsesGravity,
  pitcherBlockedByStand,
  shotgunVelocities,
  trapHillSpec,
} from './terrain-hazard';

describe('terrain hazard helpers', () => {
  it('maps every theme to a unique embedded hazard', () => {
    const kinds = THEMES.map((theme) => hazardForTheme(theme));
    expect(kinds).toEqual([
      'bramble-vent',
      'glacier-bore',
      'needle-mortar',
      'sonar-well',
      'keep-burner',
      'pitcher-snare',
    ]);
    expect(new Set(kinds).size).toBe(THEMES.length);
  });

  it('fans a five-way shotgun around straight up', () => {
    const shots = shotgunVelocities(100);
    expect(SHOTGUN_OFFSETS_DEG).toEqual([-60, -30, 0, 30, 60]);
    expect(shots).toHaveLength(5);
    expect(shots[2]?.vx).toBeCloseTo(0, 8);
    expect(shots[2]?.vy).toBeCloseTo(-100, 8);
    expect(shots[0]?.vx).toBeLessThan(0);
    expect(shots[4]?.vx).toBeGreaterThan(0);
    expect(shots[0]?.vy).toBeLessThan(0);
    expect(shots[4]?.vy).toBeLessThan(0);
  });

  it('gives only the desert mortar gravity', () => {
    const kinds: TerrainHazardKind[] = [
      'bramble-vent',
      'glacier-bore',
      'needle-mortar',
      'sonar-well',
      'keep-burner',
      'pitcher-snare',
    ];
    for (const kind of kinds) {
      expect(hazardUsesGravity(kind)).toBe(kind === 'needle-mortar');
    }
  });

  it('opens a laser only after telegraph, then for the attack window', () => {
    expect(hazardTelegraphMs('glacier-bore')).toBe(800);
    expect(hazardAttackMs('glacier-bore')).toBe(320);
    expect(beamLethal('glacier-bore', -1)).toBe(false);
    expect(beamLethal('glacier-bore', 0)).toBe(true);
    expect(beamLethal('glacier-bore', 319)).toBe(true);
    expect(beamLethal('glacier-bore', 320)).toBe(false);
  });

  it('pulses the keep burner three times instead of a solid beam', () => {
    expect(beamLethal('keep-burner', 40)).toBe(true);
    expect(beamLethal('keep-burner', 200)).toBe(false);
    expect(beamLethal('keep-burner', 360)).toBe(true);
    expect(beamLethal('keep-burner', 520)).toBe(false);
    expect(beamLethal('keep-burner', 640)).toBe(true);
    expect(beamLethal('keep-burner', 780)).toBe(false);
  });

  it('keeps a pitcher down when the player stands on the socket', () => {
    expect(pitcherBlockedByStand(true)).toBe(true);
    expect(pitcherBlockedByStand(false)).toBe(false);
  });

  it('stamps a hill socket only when a hill trap has no covering hill', () => {
    expect(hazardMount('glacier-bore')).toBe('hill');
    expect(trapHillSpec(40)).toEqual([38, 3, 2]);
    expect(extraHillsForTraps('snow', [40], [])).toEqual([[38, 3, 2]]);
    expect(extraHillsForTraps('snow', [40], [[38, 6, 2]])).toEqual([]);
    expect(extraHillsForTraps('grass', [40], [])).toEqual([]);
  });

  it('treats hill beams as a facing lane and vents as local fallout', () => {
    expect(hazardThreatensTile('glacier-bore', 40, 36, -1)).toBe(true);
    expect(hazardThreatensTile('glacier-bore', 40, 41, -1)).toBe(false);
    expect(hazardThreatensTile('bramble-vent', 40, 3)).toBe(false);
    expect(hazardThreatensTile('pitcher-snare', 40, 40)).toBe(true);
    expect(TILE).toBeGreaterThan(0);
  });
});
