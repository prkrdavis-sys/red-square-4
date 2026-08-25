import { describe, expect, it } from 'vitest';
import { SKINS, skinForLevel } from '../data/skins';
import {
  SKIN_SHOP_PALETTE,
  skinMatchesFilter,
  skinShopCard,
  skinShopEmptyHint,
  skinShopFilterCounts,
  skinShopFilterLabel,
  skinShopTone,
  type SkinShopSave,
} from './skin-shop';

const classic = SKINS[0]!;
const sprout = skinForLevel('1-1')!;
const scout = skinForLevel('1-2')!;
const beetle = skinForLevel('1-3')!;
const king = skinForLevel('1-4')!;

function save(partial: Partial<SkinShopSave> = {}): SkinShopSave {
  return {
    cleared: [],
    purchasedSkins: [],
    equippedSkin: 'classic',
    coins: 0,
    ...partial,
  };
}

const mixed = save({
  cleared: ['1-1', '1-2', '1-3'],
  purchasedSkins: ['level-1-1'],
  coins: 12,
});

describe('skin shop view', () => {
  it('paints wearing, ready, shop, broke, and locked as different tones', () => {
    expect(skinShopTone(classic, mixed)).toBe('wearing');
    expect(skinShopTone(sprout, mixed)).toBe('ready');
    expect(skinShopTone(scout, mixed)).toBe('shop');
    expect(skinShopTone(beetle, mixed)).toBe('broke');
    expect(skinShopTone(king, mixed)).toBe('locked');
    expect(skinShopTone(skinForLevel('2-1')!, mixed)).toBe('locked');
  });

  it('keeps each tone on its own fill, band, and badge', () => {
    const wearing = skinShopCard(classic, mixed);
    const ready = skinShopCard(sprout, mixed);
    const shop = skinShopCard(scout, mixed);
    const broke = skinShopCard(beetle, mixed);
    const locked = skinShopCard(king, mixed);

    expect(wearing).toMatchObject({
      tone: 'wearing',
      badge: 'ON',
      fill: SKIN_SHOP_PALETTE.wearing.fill,
      band: SKIN_SHOP_PALETTE.wearing.band,
      actionLabel: 'WEARING',
      actionTone: 'muted',
      displayName: 'Red Square',
      hint: 'Wearing this look',
      hidden: false,
      showCoin: false,
    });
    expect(ready).toMatchObject({
      tone: 'ready',
      badge: 'READY',
      fill: SKIN_SHOP_PALETTE.ready.fill,
      actionLabel: 'EQUIP',
      actionTone: 'equip',
      hidden: false,
      showCoin: false,
    });
    expect(shop).toMatchObject({
      tone: 'shop',
      badge: '10',
      fill: SKIN_SHOP_PALETTE.shop.fill,
      actionLabel: 'BUY  10',
      actionTone: 'buy',
      showCoin: true,
      hidden: false,
      displayName: 'Acorn Scout',
    });
    expect(broke).toMatchObject({
      tone: 'broke',
      badge: '14',
      fill: SKIN_SHOP_PALETTE.broke.fill,
      actionLabel: 'NEED  14',
      actionTone: 'muted',
      showCoin: true,
    });
    expect(locked).toMatchObject({
      tone: 'locked',
      badge: 'BOSS',
      fill: SKIN_SHOP_PALETTE.locked.fill,
      actionLabel: 'LOCKED',
      actionTone: 'muted',
      hidden: true,
      showCoin: false,
      displayName: '???',
    });
    expect(skinShopCard(skinForLevel('2-1')!, mixed).badge).toBe('2-1');
    expect(new Set([wearing.fill, ready.fill, shop.fill, broke.fill, locked.fill]).size).toBe(5);
  });

  it('filters owned, stocked, and locked racks without mixing them', () => {
    expect(skinMatchesFilter('wearing', 'ready')).toBe(true);
    expect(skinMatchesFilter('ready', 'ready')).toBe(true);
    expect(skinMatchesFilter('shop', 'ready')).toBe(false);
    expect(skinMatchesFilter('broke', 'shop')).toBe(true);
    expect(skinMatchesFilter('shop', 'shop')).toBe(true);
    expect(skinMatchesFilter('locked', 'shop')).toBe(false);
    expect(skinMatchesFilter('locked', 'locked')).toBe(true);
    expect(skinMatchesFilter('ready', 'all')).toBe(true);

    const counts = skinShopFilterCounts(SKINS, mixed);
    expect(counts).toEqual({ all: SKINS.length, ready: 2, shop: 2, locked: SKINS.length - 4 });
    expect(skinShopFilterLabel('ready', 2)).toBe('READY  2');
    expect(skinShopFilterLabel('shop', 2)).toBe('SHOP  2');
    expect(skinShopFilterLabel('locked', 21)).toBe('LOCKED  21');
    expect(skinShopEmptyHint('shop')).toBe('Clear a course to stock the shop.');
    expect(skinShopEmptyHint('locked')).toBe('Every skin is unlocked.');
  });
});
