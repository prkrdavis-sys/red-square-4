import { describe, expect, it } from 'vitest';
import {
  clampSharedCameraToBounds,
  sharedCameraGoal,
  smoothSharedCamera,
  type SharedCameraOptions,
  type SharedCameraPlayer,
} from './shared-camera';

const options: SharedCameraOptions = {
  viewportWidth: 1_280,
  viewportHeight: 720,
  paddingX: 160,
  paddingY: 120,
  minZoom: 0.5,
  maxZoom: 1,
  lookAheadSeconds: 0.25,
};

function player(
  id: SharedCameraPlayer['id'],
  x: number,
  y: number,
  overrides: Partial<SharedCameraPlayer> = {},
): SharedCameraPlayer {
  return {
    id,
    x,
    y,
    velocityX: 0,
    velocityY: 0,
    active: true,
    ...overrides,
  };
}

describe('shared camera goal', () => {
  it('centers between both players and zooms out to fit their spread', () => {
    const goal = sharedCameraGoal(
      [player('host', 0, 100), player('guest', 1_280, 100)],
      options,
    );
    expect(goal).toMatchObject({ x: 640, y: 100, zoom: 0.8, playerSeparation: 1_280 });
  });

  it('uses movement look-ahead and ignores inactive players', () => {
    const goal = sharedCameraGoal(
      [
        player('host', 100, 200, { velocityX: 80, velocityY: -40 }),
        player('guest', 2_000, 500, { active: false }),
      ],
      options,
    );
    expect(goal).toMatchObject({ x: 120, y: 190, zoom: 1, playerSeparation: 0 });
    expect(sharedCameraGoal([], options)).toBeNull();
  });

  it('clamps zoom when players are farther apart than the viewport can fit', () => {
    const goal = sharedCameraGoal(
      [player('host', 0, 0), player('guest', 4_000, 0)],
      options,
    );
    expect(goal?.zoom).toBe(0.5);
  });
});

describe('shared camera smoothing and bounds', () => {
  it('smooths target and zoom independently', () => {
    const next = smoothSharedCamera(
      { x: 0, y: 0, zoom: 1 },
      { x: 100, y: 50, zoom: 0.5, playerSeparation: 100 },
      0.25,
      0.5,
    );
    expect(next).toEqual({ x: 25, y: 12.5, zoom: 0.75 });
  });

  it('keeps the visible camera rectangle inside world bounds', () => {
    const clamped = clampSharedCameraToBounds(
      { x: 0, y: 900, zoom: 1 },
      { width: 1_280, height: 720 },
      { x: 0, y: 0, width: 2_000, height: 1_000 },
    );
    expect(clamped).toEqual({ x: 640, y: 640, zoom: 1 });
  });
});
