import { describe, expect, it } from 'vitest';
import {
  COIN_HOVER_LIFT,
  COIN_MAGNET_RANGE,
  COIN_MAGNET_SPEED,
  coinHoverY,
  coinMagnetVelocity,
} from './coin-magnet';

describe('coin hover', () => {
  it('lifts the drop point off the ground', () => {
    expect(COIN_HOVER_LIFT).toBe(48);
    expect(coinHoverY(200)).toBe(152);
  });
});

describe('coin magnet', () => {
  it('stays put when nobody is in range', () => {
    expect(coinMagnetVelocity({ x: 0, y: 0 }, [])).toEqual({ x: 0, y: 0 });
    expect(coinMagnetVelocity({ x: 0, y: 0 }, [{ x: COIN_MAGNET_RANGE + 1, y: 0 }])).toEqual({ x: 0, y: 0 });
  });

  it('pulls at the capped speed once a player is inside range', () => {
    const edge = coinMagnetVelocity({ x: 0, y: 0 }, [{ x: COIN_MAGNET_RANGE, y: 0 }]);
    expect(edge).toEqual({ x: COIN_MAGNET_SPEED, y: 0 });

    const diagonal = coinMagnetVelocity({ x: 0, y: 0 }, [{ x: 30, y: 40 }]);
    expect(diagonal.x).toBeCloseTo(COIN_MAGNET_SPEED * 0.6);
    expect(diagonal.y).toBeCloseTo(COIN_MAGNET_SPEED * 0.8);
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(COIN_MAGNET_SPEED);
  });

  it('chooses the closer player', () => {
    const velocity = coinMagnetVelocity({ x: 0, y: 0 }, [
      { x: 100, y: 0 },
      { x: -40, y: 0 },
    ]);
    expect(velocity).toEqual({ x: -COIN_MAGNET_SPEED, y: 0 });
  });

  it('does not move when the coin is already on the player', () => {
    expect(coinMagnetVelocity({ x: 10, y: 10 }, [{ x: 10, y: 10 }])).toEqual({ x: 0, y: 0 });
  });
});
