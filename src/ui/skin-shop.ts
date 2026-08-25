import { parseLevelId } from '../config';
import { isBossRewardSkin, skinShopStatus, type SkinDef, type SkinShopStatus, type SkinUnlockState } from '../data/skins';

const TEXT = '#fff8f0';
const MUTED = '#d0c0b8';
const GOLD = '#ffe9a8';
const PANEL_STROKE = 0xe23b3b;

export type SkinShopFilter = 'all' | 'ready' | 'shop' | 'locked';

export type SkinShopTone = 'wearing' | 'ready' | 'shop' | 'broke' | 'locked';

export type SkinShopActionTone = 'equip' | 'buy' | 'muted';

export interface SkinShopSave extends SkinUnlockState {
  equippedSkin: string;
  coins: number;
}

export interface SkinShopPalette {
  fill: number;
  stroke: number;
  strokeWidth: number;
  band: number;
  badge: string;
}

export const SKIN_SHOP_FILTERS: readonly SkinShopFilter[] = ['all', 'ready', 'shop', 'locked'];

export const SKIN_SHOP_PALETTE: Record<SkinShopTone, SkinShopPalette> = {
  wearing: { fill: 0x5a3810, stroke: 0xffd060, strokeWidth: 4, band: 0xd4a84a, badge: '#1a1008' },
  ready: { fill: 0x16301c, stroke: 0x7ed86a, strokeWidth: 4, band: 0x3d8a40, badge: '#102010' },
  shop: { fill: 0x4a3410, stroke: 0xffd060, strokeWidth: 4, band: 0xe0b24a, badge: '#1a1008' },
  broke: { fill: 0x2c2410, stroke: 0x8a6840, strokeWidth: 3, band: 0x6a5420, badge: TEXT },
  locked: { fill: 0x0c080a, stroke: 0x3a2428, strokeWidth: 2, band: 0x241418, badge: MUTED },
};

export const SKIN_SHOP_FILTER_ACCENT: Record<SkinShopFilter, number> = {
  all: PANEL_STROKE,
  ready: SKIN_SHOP_PALETTE.ready.stroke,
  shop: SKIN_SHOP_PALETTE.shop.stroke,
  locked: 0x6a4048,
};

export interface SkinShopCard {
  status: SkinShopStatus;
  tone: SkinShopTone;
  hidden: boolean;
  showCoin: boolean;
  badge: string;
  badgeColor: string;
  fill: number;
  stroke: number;
  strokeWidth: number;
  band: number;
  nameColor: string;
  displayName: string;
  hint: string;
  actionLabel: string;
  actionTone: SkinShopActionTone;
}

export function skinShopTone(skin: SkinDef, save: SkinShopSave): SkinShopTone {
  const status = skinShopStatus(skin, save);
  switch (status) {
    case 'owned':
      return skin.id === save.equippedSkin ? 'wearing' : 'ready';
    case 'for-sale':
      return save.coins >= (skin.cost ?? 0) ? 'shop' : 'broke';
    case 'locked-course':
    case 'locked-boss':
      return 'locked';
    default: {
      const neverStatus: never = status;
      return neverStatus;
    }
  }
}

export function skinMatchesFilter(tone: SkinShopTone, filter: SkinShopFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'ready':
      return tone === 'wearing' || tone === 'ready';
    case 'shop':
      return tone === 'shop' || tone === 'broke';
    case 'locked':
      return tone === 'locked';
    default: {
      const neverFilter: never = filter;
      return neverFilter;
    }
  }
}

export function skinShopFilterCounts(skins: readonly SkinDef[], save: SkinShopSave): Record<SkinShopFilter, number> {
  const counts: Record<SkinShopFilter, number> = { all: skins.length, ready: 0, shop: 0, locked: 0 };
  for (const skin of skins) {
    const tone = skinShopTone(skin, save);
    switch (tone) {
      case 'wearing':
      case 'ready':
        counts.ready += 1;
        break;
      case 'shop':
      case 'broke':
        counts.shop += 1;
        break;
      case 'locked':
        counts.locked += 1;
        break;
      default: {
        const neverTone: never = tone;
        void neverTone;
      }
    }
  }
  return counts;
}

export function skinShopFilterLabel(filter: SkinShopFilter, count: number): string {
  switch (filter) {
    case 'all':
      return `ALL  ${count}`;
    case 'ready':
      return `READY  ${count}`;
    case 'shop':
      return `SHOP  ${count}`;
    case 'locked':
      return `LOCKED  ${count}`;
    default: {
      const neverFilter: never = filter;
      return neverFilter;
    }
  }
}

export function skinShopEmptyHint(filter: SkinShopFilter): string {
  switch (filter) {
    case 'all':
      return 'No skins yet.';
    case 'ready':
      return 'No skins to wear yet.';
    case 'shop':
      return 'Clear a course to stock the shop.';
    case 'locked':
      return 'Every skin is unlocked.';
    default: {
      const neverFilter: never = filter;
      return neverFilter;
    }
  }
}

export function skinShopCard(skin: SkinDef, save: SkinShopSave): SkinShopCard {
  const status = skinShopStatus(skin, save);
  const tone = skinShopTone(skin, save);
  const palette = SKIN_SHOP_PALETTE[tone];
  const hidden = tone === 'locked';
  return {
    status,
    tone,
    hidden,
    showCoin: tone === 'shop' || tone === 'broke',
    badge: badgeText(skin, tone),
    badgeColor: palette.badge,
    fill: palette.fill,
    stroke: palette.stroke,
    strokeWidth: palette.strokeWidth,
    band: palette.band,
    nameColor: tone === 'wearing' ? GOLD : hidden ? MUTED : TEXT,
    displayName: hidden ? '???' : skin.name,
    hint: hintFor(skin, status, tone, save.coins),
    actionLabel: actionLabel(skin, tone),
    actionTone: actionToneFor(tone),
  };
}

function badgeText(skin: SkinDef, tone: SkinShopTone): string {
  switch (tone) {
    case 'wearing':
      return 'ON';
    case 'ready':
      return 'READY';
    case 'shop':
    case 'broke':
      return `${skin.cost ?? 0}`;
    case 'locked':
      return isBossRewardSkin(skin) ? 'BOSS' : (skin.level ?? 'LOCK');
    default: {
      const neverTone: never = tone;
      return neverTone;
    }
  }
}

function hintFor(skin: SkinDef, status: SkinShopStatus, tone: SkinShopTone, coins: number): string {
  switch (status) {
    case 'owned':
      return tone === 'wearing'
        ? 'Wearing this look'
        : skin.level
          ? isBossRewardSkin(skin)
            ? `Won by beating the World ${parseLevelId(skin.level).world} boss`
            : `Cleared ${skin.level}  ·  bought for ${skin.cost ?? 0} coins`
          : 'Available from the start';
    case 'for-sale':
      return coins >= (skin.cost ?? 0)
        ? `Cleared ${skin.level}  ·  buy for ${skin.cost ?? 0} coins`
        : `Need ${skin.cost ?? 0} coins  ·  you have ${coins}`;
    case 'locked-course':
      return `Clear ${skin.level} to buy for ${skin.cost ?? 0} coins`;
    case 'locked-boss':
      return skin.level
        ? `Beat the World ${parseLevelId(skin.level).world} boss to unlock`
        : 'Beat the world boss to unlock';
    default: {
      const neverStatus: never = status;
      return neverStatus;
    }
  }
}

function actionLabel(skin: SkinDef, tone: SkinShopTone): string {
  switch (tone) {
    case 'wearing':
      return 'WEARING';
    case 'ready':
      return 'EQUIP';
    case 'shop':
      return `BUY  ${skin.cost ?? 0}`;
    case 'broke':
      return `NEED  ${skin.cost ?? 0}`;
    case 'locked':
      return 'LOCKED';
    default: {
      const neverTone: never = tone;
      return neverTone;
    }
  }
}

function actionToneFor(tone: SkinShopTone): SkinShopActionTone {
  switch (tone) {
    case 'ready':
      return 'equip';
    case 'shop':
      return 'buy';
    case 'wearing':
    case 'broke':
    case 'locked':
      return 'muted';
    default: {
      const neverTone: never = tone;
      return neverTone;
    }
  }
}
