import { describe, expect, it } from 'vitest';

import {
  checkpointPlaneX,
  checkpointSpawnMatches,
  isEarlierCheckpoint,
  laterCheckpointIsActive,
  playerLeadX,
  reachedCheckpointPlane,
} from './checkpoint-plane';

describe('checkpoint plane', () => {
  it('uses the stored flag X so a moved sprite cannot shift the gate', () => {
    expect(checkpointPlaneX({ x: 9999, getData: () => 5600 })).toBe(5600);
    expect(checkpointPlaneX({ x: 400, getData: () => undefined })).toBe(400);
  });

  it('triggers in the air as soon as the player reaches the flag X', () => {
    const planeX = 5600;
    expect(reachedCheckpointPlane(5480, planeX)).toBe(false);
    expect(reachedCheckpointPlane(5600, planeX)).toBe(true);
    expect(reachedCheckpointPlane(5617, planeX)).toBe(true);
  });

  it('uses the farther of sprite center and body right', () => {
    expect(playerLeadX(100, 117)).toBe(117);
    expect(playerLeadX(200, 180)).toBe(200);
    expect(playerLeadX(80, Number.NaN)).toBe(80);
  });

  it('lets the second flag retire the first and blocks going backward', () => {
    expect(isEarlierCheckpoint(3200, 6400)).toBe(true);
    expect(isEarlierCheckpoint(6400, 3200)).toBe(false);
    expect(laterCheckpointIsActive(3200, [6400])).toBe(true);
    expect(laterCheckpointIsActive(6400, [3200])).toBe(false);
    expect(checkpointSpawnMatches({ x: 6400, y: 544 }, { x: 6400, y: 544 })).toBe(true);
    expect(checkpointSpawnMatches({ x: 3200, y: 544 }, { x: 6400, y: 544 })).toBe(false);
  });
});
