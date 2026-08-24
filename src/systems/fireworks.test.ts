import { describe, expect, it } from 'vitest';

import {
  checkpointFlagLaunch,
  fireworkArcPoint,
  fireworkArcTangent,
  FIREWORK_ARC_HEIGHT,
  FIREWORK_ARC_WIDTH,
  FIREWORK_SIDES,
} from './fireworks-path';

const FLAG = {
  x: 400,
  y: 546,
  displayWidth: 42,
  displayHeight: 62,
  originX: 0.5,
  originY: 0.5,
};

describe('checkpoint fireworks', () => {
  it('launches from the flag cloth near the top of the pole', () => {
    const origin = checkpointFlagLaunch(FLAG);
    const left = FLAG.x - FLAG.displayWidth * FLAG.originX;
    const top = FLAG.y - FLAG.displayHeight * FLAG.originY;
    const poleX = left + 7.5;
    expect(origin.x).toBeGreaterThan(poleX);
    expect(origin.x).toBeLessThan(left + FLAG.displayWidth);
    expect(origin.y).toBeGreaterThan(top);
    expect(origin.y).toBeLessThan(FLAG.y - 12);
  });

  it('sends two rockets on mirrored arcs that burst above the flag', () => {
    const start = checkpointFlagLaunch(FLAG);
    const left = fireworkArcPoint(start.x, start.y, -1, 1);
    const right = fireworkArcPoint(start.x, start.y, 1, 1);
    expect(left.x).toBeCloseTo(start.x - FIREWORK_ARC_WIDTH);
    expect(right.x).toBeCloseTo(start.x + FIREWORK_ARC_WIDTH);
    expect(left.y).toBeCloseTo(right.y);
    expect(left.y).toBeCloseTo(start.y - FIREWORK_ARC_HEIGHT);
    expect(start.y - left.y).toBeGreaterThan(140);

    for (const t of [0.25, 0.5, 0.75]) {
      const a = fireworkArcPoint(start.x, start.y, -1, t);
      const b = fireworkArcPoint(start.x, start.y, 1, t);
      expect(a.y).toBeCloseTo(b.y);
      expect(a.x - start.x).toBeCloseTo(-(b.x - start.x));
    }
  });

  it('arches above the straight line between launch and burst', () => {
    const start = checkpointFlagLaunch(FLAG);
    for (const side of FIREWORK_SIDES) {
      const end = fireworkArcPoint(start.x, start.y, side, 1);
      const mid = fireworkArcPoint(start.x, start.y, side, 0.5);
      const chordY = (start.y + end.y) / 2;
      expect(mid.y).toBeLessThan(chordY - 20);
      expect(fireworkArcPoint(start.x, start.y, side, 0)).toEqual(start);
    }
  });

  it('aims each rocket up and outward at launch', () => {
    const start = checkpointFlagLaunch(FLAG);
    const left = fireworkArcTangent(start.x, start.y, -1, 0);
    const right = fireworkArcTangent(start.x, start.y, 1, 0);
    expect(left.y).toBeLessThan(0);
    expect(right.y).toBeLessThan(0);
    expect(left.x).toBeLessThan(0);
    expect(right.x).toBeGreaterThan(0);
    expect(left.x).toBeCloseTo(-right.x);
    expect(left.y).toBeCloseTo(right.y);
  });
});
