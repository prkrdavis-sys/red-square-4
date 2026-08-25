import { beforeEach, describe, expect, it } from 'vitest';
import {
  checkpointForLevelStart,
  clearCheckpoint,
  getCheckpoint,
  session,
  setCheckpoint,
  writeSave,
} from './progress';
import { DEFAULT_SKIN_ID } from './skins';

function resetProgress(): void {
  writeSave({
    unlocked: [],
    cleared: [],
    lastPlayed: '1-1',
    collectibles: {},
    checkpoints: {},
    creatureCards: [],
    equippedSkin: DEFAULT_SKIN_ID,
  });
  session.lives = 3;
}

describe('checkpoints', () => {
  beforeEach(() => {
    resetProgress();
  });

  it('remembers a checkpoint until it is cleared', () => {
    setCheckpoint('1-2', 640, 320);
    expect(getCheckpoint('1-2')).toEqual({ x: 640, y: 320 });
    expect(getCheckpoint('1-1')).toBeUndefined();
  });

  it('forgets a level checkpoint after game over so the next run starts at the beginning', () => {
    setCheckpoint('1-2', 640, 320);
    setCheckpoint('2-1', 880, 320);
    clearCheckpoint('1-2');
    expect(getCheckpoint('1-2')).toBeUndefined();
    expect(getCheckpoint('2-1')).toEqual({ x: 880, y: 320 });
  });

  it('ignores a saved checkpoint when starting a level from the map', () => {
    setCheckpoint('1-2', 640, 320);
    expect(checkpointForLevelStart('1-2', 'fresh')).toBeUndefined();
    expect(checkpointForLevelStart('1-2', 'death')).toEqual({ x: 640, y: 320 });
  });
});
