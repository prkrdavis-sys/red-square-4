import { beforeEach, describe, expect, it } from 'vitest';
import {
  addCoins,
  checkpointForLevelStart,
  clearCheckpoint,
  getCheckpoint,
  loadSave,
  markCleared,
  parseSaveRaw,
  purchaseSkin,
  session,
  setCheckpoint,
  writeSave,
} from './progress';
import { isSkinUnlocked, skinForLevel, DEFAULT_SKIN_ID } from './skins';

function blankSave(overrides: Partial<ReturnType<typeof loadSave>> = {}) {
  return {
    unlocked: [],
    cleared: [],
    lastPlayed: '1-1' as const,
    collectibles: {},
    checkpoints: {},
    creatureCards: [],
    equippedSkin: DEFAULT_SKIN_ID,
    coins: 0,
    purchasedSkins: [],
    ...overrides,
  };
}

function resetProgress(): void {
  writeSave(blankSave());
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

  it('forgets a level checkpoint after a clear so the next run starts at the beginning', () => {
    setCheckpoint('1-3', 640, 320);
    markCleared('1-3');
    expect(getCheckpoint('1-3')).toBeUndefined();
    expect(checkpointForLevelStart('1-3', 'fresh')).toBeUndefined();
    expect(checkpointForLevelStart('1-3', 'death')).toBeUndefined();
  });
});

describe('coins and skin shop', () => {
  beforeEach(() => {
    resetProgress();
  });

  it('persists coins as soon as they are added', () => {
    addCoins(3);
    expect(loadSave().coins).toBe(3);
    addCoins(2);
    expect(loadSave().coins).toBe(5);
  });

  it('refuses to spend coins when the wallet is short', () => {
    writeSave(blankSave({ cleared: ['1-1'], coins: 5 }));
    const result = purchaseSkin('level-1-1');
    expect(result.ok).toBe(false);
    expect(result.save.coins).toBe(5);
    expect(result.save.purchasedSkins).toEqual([]);
  });

  it('requires a course clear before a 1-3 skin can be bought', () => {
    writeSave(blankSave({ coins: 20 }));
    expect(purchaseSkin('level-1-1').ok).toBe(false);
    writeSave(blankSave({ cleared: ['1-1'], coins: 10 }));
    const sprout = skinForLevel('1-1')!;
    expect(isSkinUnlocked(sprout, loadSave())).toBe(false);
    const bought = purchaseSkin('level-1-1');
    expect(bought.ok).toBe(true);
    expect(bought.save.coins).toBe(0);
    expect(bought.save.purchasedSkins).toContain('level-1-1');
    expect(isSkinUnlocked(sprout, bought.save)).toBe(true);
  });

  it('unlocks x-4 skins by beating the boss and never sells them', () => {
    writeSave(blankSave({ cleared: ['1-4'], coins: 40 }));
    const king = skinForLevel('1-4')!;
    expect(isSkinUnlocked(king, loadSave())).toBe(true);
    expect(purchaseSkin('level-1-4').ok).toBe(false);
    expect(loadSave().coins).toBe(40);
    expect(loadSave().purchasedSkins).toEqual([]);
  });

  it('treats missing purchasedSkins as a legacy grant of cleared 1-3 skins', () => {
    const save = parseSaveRaw(
      JSON.stringify({
        unlocked: ['1-1'],
        cleared: ['1-1', '1-4'],
        lastPlayed: '1-1',
        collectibles: {},
        checkpoints: {},
        creatureCards: [],
        equippedSkin: DEFAULT_SKIN_ID,
      }),
    );
    expect(save).not.toBeNull();
    expect(save?.purchasedSkins).toEqual(['level-1-1']);
    expect(save?.coins).toBe(0);
    expect(save && isSkinUnlocked(skinForLevel('1-1')!, save)).toBe(true);
    expect(save && isSkinUnlocked(skinForLevel('1-4')!, save)).toBe(true);
  });

  it('does not re-grant skins when purchasedSkins is already present', () => {
    const save = parseSaveRaw(
      JSON.stringify({
        unlocked: ['1-1'],
        cleared: ['1-1'],
        lastPlayed: '1-1',
        collectibles: {},
        checkpoints: {},
        creatureCards: [],
        equippedSkin: DEFAULT_SKIN_ID,
        coins: 8,
        purchasedSkins: [],
      }),
    );
    expect(save).not.toBeNull();
    expect(save?.purchasedSkins).toEqual([]);
    expect(save?.coins).toBe(8);
    expect(save && isSkinUnlocked(skinForLevel('1-1')!, save)).toBe(false);
  });
});
