import { describe, expect, it } from 'vitest';
import { ALL_LEVEL_IDS, parseLevelId } from '../config';
import {
  isBossRewardSkin,
  isSkinUnlocked,
  legacyPurchasedSkinIds,
  SKINS,
  skinById,
  skinForLevel,
  skinShopStatus,
} from './skins';

const emptySave = { cleared: [], purchasedSkins: [] };

describe('skin shop', () => {
  it('prices stage 1-3 skins between 10 and 20 and leaves x-4 free', () => {
    const prices: Record<string, number> = {
      '1-1': 10,
      '1-2': 10,
      '1-3': 14,
      '2-1': 12,
      '2-2': 10,
      '2-3': 14,
      '3-1': 10,
      '3-2': 16,
      '3-3': 12,
      '4-1': 14,
      '4-2': 14,
      '4-3': 18,
      '5-1': 14,
      '5-2': 16,
      '5-3': 10,
      '6-1': 10,
      '6-2': 14,
      '6-3': 12,
    };
    for (const id of ALL_LEVEL_IDS) {
      const skin = skinForLevel(id);
      expect(skin).toBeDefined();
      if (!skin) {
        continue;
      }
      const { stage } = parseLevelId(id);
      if (stage === 4) {
        expect(skin.cost).toBeUndefined();
        expect(isBossRewardSkin(skin)).toBe(true);
        expect(skin.heldItem).not.toBe('none');
        continue;
      }
      expect(skin.cost).toBe(prices[id]);
      expect(skin.heldItem).toBe('none');
    }
    expect(skinById('classic')?.cost).toBeUndefined();
  });

  it('keeps the default skin free and locks paid skins until they are cleared and bought', () => {
    const sprout = skinForLevel('1-1');
    const king = skinForLevel('1-4');
    expect(sprout && isSkinUnlocked(sprout, emptySave)).toBe(false);
    expect(king && isSkinUnlocked(king, emptySave)).toBe(false);
    expect(isSkinUnlocked(SKINS[0]!, emptySave)).toBe(true);
    expect(sprout && isSkinUnlocked(sprout, { cleared: ['1-1'], purchasedSkins: [] })).toBe(false);
    expect(sprout && isSkinUnlocked(sprout, { cleared: ['1-1'], purchasedSkins: ['level-1-1'] })).toBe(true);
    expect(king && isSkinUnlocked(king, { cleared: ['1-4'], purchasedSkins: [] })).toBe(true);
  });

  it('reports shop status for buyable, owned, and boss-locked skins', () => {
    const sprout = skinForLevel('1-1')!;
    const king = skinForLevel('1-4')!;
    expect(skinShopStatus(sprout, emptySave)).toBe('locked-course');
    expect(skinShopStatus(sprout, { cleared: ['1-1'], purchasedSkins: [] })).toBe('for-sale');
    expect(skinShopStatus(sprout, { cleared: ['1-1'], purchasedSkins: ['level-1-1'] })).toBe('owned');
    expect(skinShopStatus(king, emptySave)).toBe('locked-boss');
    expect(skinShopStatus(king, { cleared: ['1-4'], purchasedSkins: [] })).toBe('owned');
  });

  it('migrates only cleared non-boss skins from legacy saves', () => {
    expect(legacyPurchasedSkinIds(['1-1', '1-4', '2-2'])).toEqual(['level-1-1', 'level-2-2']);
  });
});
