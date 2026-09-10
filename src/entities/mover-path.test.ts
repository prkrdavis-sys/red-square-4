import { describe, expect, it } from 'vitest';
import { GROUND_Y, MOVER_HEIGHT, TILE } from '../config';
import type { MoverSpawn } from '../levels/grid';
import { moverCarries, moverHomeY, moverOffset, moverPosition, RIDE_TOLERANCE } from './mover-path';

const FERRY: MoverSpawn = {
  x: 10,
  tilesUp: 2,
  w: 2,
  axis: 'x',
  span: 4,
  periodMs: 3200,
  phase: 0,
  oneWay: false,
};

const LIFT: MoverSpawn = { ...FERRY, axis: 'y', span: 3, phase: 0 };

describe('mover path', () => {
  it('stays inside its declared span', () => {
    for (let now = 0; now < FERRY.periodMs * 2; now += 25) {
      expect(Math.abs(moverOffset(FERRY, now))).toBeLessThanOrEqual((FERRY.span * TILE) / 2 + 1e-6);
    }
  });

  it('returns to its start after one full period', () => {
    expect(moverOffset(FERRY, 0)).toBeCloseTo(moverOffset(FERRY, FERRY.periodMs), 6);
  });

  it('only travels along its own axis', () => {
    const at = FERRY.periodMs / 4;
    const ferry = moverPosition(FERRY, at);
    const lift = moverPosition(LIFT, at);
    expect(ferry.y).toBe(moverHomeY(FERRY));
    expect(ferry.x).not.toBe(moverPosition(FERRY, 0).x);
    expect(lift.x).toBe(moverPosition(LIFT, 0).x);
    expect(lift.y).not.toBe(moverHomeY(LIFT));
  });

  it('sits its top face at the requested height above the ground', () => {
    const top = moverHomeY(FERRY) - MOVER_HEIGHT / 2;
    expect(top).toBe((GROUND_Y - FERRY.tilesUp) * TILE - MOVER_HEIGHT);
  });

  it('phase offsets let neighbouring plates run out of step', () => {
    const offset = moverOffset({ ...FERRY, phase: 0.5 }, 0);
    expect(offset).toBeCloseTo(-moverOffset(FERRY, 0), 6);
  });
});

describe('carrying a rider', () => {
  const plate = { top: 100, left: 0, right: 128 };
  const standing = { bottom: 100, left: 40, right: 74, velocityY: 0 };

  it('carries a body resting on the plate', () => {
    expect(moverCarries(plate, standing)).toBe(true);
    expect(moverCarries(plate, { ...standing, bottom: 100 + RIDE_TOLERANCE - 1 })).toBe(true);
  });

  it('drops a body that has jumped off', () => {
    expect(moverCarries(plate, { ...standing, velocityY: -400 })).toBe(false);
  });

  it('ignores a body beside the plate or far below it', () => {
    expect(moverCarries(plate, { ...standing, left: 200, right: 234 })).toBe(false);
    expect(moverCarries(plate, { ...standing, bottom: 400 })).toBe(false);
    expect(moverCarries(plate, { ...standing, bottom: 20 })).toBe(false);
  });
});
