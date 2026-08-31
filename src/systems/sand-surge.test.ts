import { describe, expect, it } from 'vitest';
import { TILE, themePhysics } from '../config';
import { sandSurgeDuneAlong } from './sand-surge';

describe('sandSurgeDuneAlong', () => {
  it('centers the dune on a desert surge landing', () => {
    const gravity = themePhysics('desert').gravity;
    const speed = 520;
    const lift = -280;
    const drop = 8;
    const width = TILE * 2;
    const along = sandSurgeDuneAlong(speed, lift, gravity, drop, width);
    const flight = (-lift + Math.sqrt(lift * lift + 2 * gravity * drop)) / gravity;
    const land = speed * flight;

    expect(along).toBeGreaterThan(24);
    expect(land).toBeGreaterThan(along);
    expect(land).toBeLessThan(along + width);
    expect(land).toBeCloseTo(along + width / 2, 5);
  });
});
