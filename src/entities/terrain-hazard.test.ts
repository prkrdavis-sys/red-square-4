import { describe, expect, it } from 'vitest';
import { THEMES, TILE, hazardForTheme, themePhysics, type TerrainHazardKind } from '../config';
import {
  MORTAR_FALLOUT_TILES,
  MORTAR_SHOTS,
  SHOTGUN_OFFSETS_DEG,
  beamLethal,
  extraHillsForTraps,
  hazardAttackMs,
  hazardMount,
  hazardTelegraphMs,
  hazardThreatRangeTiles,
  hazardThreatensTile,
  hazardUsesGravity,
  mortarLaunchVelocity,
  mortarVelocities,
  pitcherBlockedByStand,
  shotgunVelocities,
  urchinIdleTextureKey,
  urchinVelocities,
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
      'urchin-ball',
      'power-box',
    ]);
    expect(new Set(kinds).size).toBe(THEMES.length);
  });

  it('charges a telegraphed electrical puddle lane', () => {
    expect(hazardMount('power-box')).toBe('ground');
    expect(hazardTelegraphMs('power-box')).toBeGreaterThan(600);
    expect(hazardAttackMs('power-box')).toBeGreaterThan(500);
    expect(hazardThreatRangeTiles('power-box')).toBe(4);
    expect(beamLethal('power-box', 100)).toBe(true);
    expect(beamLethal('power-box', hazardAttackMs('power-box'))).toBe(false);
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

  it('lobs cactus needles high and far instead of a short shotgun', () => {
    const gravity = themePhysics('desert').gravity;
    const shots = mortarVelocities(gravity);
    expect(MORTAR_SHOTS[0]?.rangeTiles).toBeGreaterThan(3);
    expect(MORTAR_SHOTS[1]?.rangeTiles).toBeGreaterThan(MORTAR_SHOTS[0]?.rangeTiles ?? 0);
    expect(shots).toHaveLength(MORTAR_SHOTS.length * 2);
    expect(hazardThreatRangeTiles('needle-mortar')).toBe(MORTAR_FALLOUT_TILES);
    expect(hazardThreatRangeTiles('needle-mortar')).toBeGreaterThan(hazardThreatRangeTiles('bramble-vent'));

    const leftFar = shots[2];
    const rightFar = shots[3];
    expect(leftFar?.vx).toBeLessThan(0);
    expect(rightFar?.vx).toBeGreaterThan(0);
    expect(rightFar?.vx).toBeCloseTo(-(leftFar?.vx ?? 0), 8);
    expect(rightFar?.vy).toBeCloseTo(leftFar?.vy ?? 0, 8);
    expect(rightFar?.vy).toBeLessThan(-900);

    const far = mortarLaunchVelocity(MORTAR_SHOTS[1].rangeTiles * TILE, MORTAR_SHOTS[1].apexTiles * TILE, gravity);
    const near = mortarLaunchVelocity(MORTAR_SHOTS[0].rangeTiles * TILE, MORTAR_SHOTS[0].apexTiles * TILE, gravity);
    const apex = (far.vy * far.vy) / (2 * gravity);
    expect(apex).toBeCloseTo(MORTAR_SHOTS[1].apexTiles * TILE, 4);
    expect(Math.abs(far.vx)).toBeGreaterThan(Math.abs(near.vx));
  });

  it('gives only the desert mortar gravity', () => {
    const kinds: TerrainHazardKind[] = [
      'bramble-vent',
      'glacier-bore',
      'needle-mortar',
      'sonar-well',
      'keep-burner',
      'pitcher-snare',
      'urchin-ball',
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
    expect(hazardThreatensTile('needle-mortar', 40, 31)).toBe(true);
    expect(hazardThreatensTile('needle-mortar', 40, 28)).toBe(false);
    expect(hazardThreatensTile('pitcher-snare', 40, 40)).toBe(true);
    expect(TILE).toBeGreaterThan(0);
  });

  it('fires eight radial urchin spikes and regrows them in idle', () => {
    const shots = urchinVelocities(100);
    expect(shots).toHaveLength(8);
    for (const shot of shots) {
      expect(Math.hypot(shot.vx, shot.vy)).toBeCloseTo(100);
    }
    expect(hazardThreatRangeTiles('urchin-ball')).toBe(5);
    expect(hazardThreatensTile('urchin-ball', 40, 44)).toBe(true);
    expect(hazardThreatensTile('urchin-ball', 40, 46)).toBe(false);
    expect(hazardMount('urchin-ball')).toBe('ground');
    expect(urchinIdleTextureKey(0, 2600)).toBe('hazard-urchin-ball-bald');
    expect(urchinIdleTextureKey(800, 2600)).toBe('hazard-urchin-ball-half');
    expect(urchinIdleTextureKey(2000, 2600)).toBe('hazard-urchin-ball');
  });
});
