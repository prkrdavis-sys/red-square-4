import { afterEach, describe, expect, it } from 'vitest';
import {
  activeCampaignIds,
  enemiesForWorld,
  themeName,
  titleTheme,
  type LevelId,
} from '../config';
import { nextLevelId, resumeLevelId, type SaveData } from '../data/progress';
import { shopSkins } from '../data/skins';
import { boatWorldPairs, islandForWorld } from '../systems/world-map-layout';
import { NOCLIP_CELL } from './grid';
import { getLevel } from './worlds';

const SETTINGS_KEY = 'red-square-4-settings-v1';

function setClassic(classic: boolean): void {
  const raw = localStorage.getItem(SETTINGS_KEY);
  const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  parsed.classic = classic;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed));
}

function save(lastPlayed: LevelId, unlocked: LevelId[]): SaveData {
  return {
    unlocked,
    cleared: [],
    lastPlayed,
    collectibles: {},
    checkpoints: {},
    creatureCards: [],
    equippedSkin: 'classic',
    coins: 0,
    purchasedSkins: [],
    seenGifts: [],
  };
}

describe('classic v1.0 edition', () => {
  afterEach(() => {
    setClassic(false);
  });

  it('serves the six-world roster, meadow title, and Dread Keep', () => {
    setClassic(true);

    const courses = activeCampaignIds();
    expect(courses).toHaveLength(24);
    expect(courses[0]).toBe('1-1');
    expect(courses[23]).toBe('6-4');
    expect(enemiesForWorld(1, 'classic')).toEqual(['bramble-hopper', 'acorn-slinger']);
    expect(enemiesForWorld(6, 'classic')).toEqual(['howler-ape', 'dart-mosquito']);
    expect(themeName('castle')).toBe('Dread Keep');
    expect(titleTheme()).toBe('grass');
    expect(nextLevelId('6-4')).toBeUndefined();
    expect(nextLevelId('6-3')).toBe('6-4');

    for (const id of courses) {
      const level = getLevel(id);
      const allowed = new Set(enemiesForWorld(level.world, 'classic'));
      expect(level.course.noclipTile, id).toBeUndefined();
      expect(level.rows.some((row) => row.includes(NOCLIP_CELL)), id).toBe(false);
      for (const enemy of level.course.enemies) {
        expect(allowed.has(enemy.kind), `${id} ${enemy.kind}`).toBe(true);
      }
    }

    expect(getLevel('1-3').course.enemies.some((enemy) => enemy.kind === 'acorn-slinger')).toBe(true);
    expect(islandForWorld(7)).toBeUndefined();
    expect(islandForWorld(6)?.departure).toBeUndefined();
    expect(boatWorldPairs()).toEqual([
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
    ]);
    expect(shopSkins().some((skin) => skin.motif === 'jack-o-lantern')).toBe(false);
    expect(shopSkins().some((skin) => skin.level === '7-1' || skin.level === '8-4')).toBe(false);
    expect(shopSkins().some((skin) => skin.id === 'classic')).toBe(true);
    expect(resumeLevelId(save('8-2', ['1-1', '6-4', '8-2']))).toBe('6-4');
  });

  it('keeps the current campaign when classic mode is off', () => {
    setClassic(false);
    expect(activeCampaignIds()).toHaveLength(32);
    expect(themeName('castle')).toBe('Hallow Keep');
    expect(titleTheme()).toBe('castle');
    expect(getLevel('1-1').course.enemies.some((enemy) => enemy.kind === 'meadow-frog')).toBe(true);
    expect(getLevel('1-2').course.noclipTile).toBeTypeOf('number');
    expect(getLevel('1-1').course.enemies.some((enemy) => enemy.kind === 'swoop-bat')).toBe(true);
    expect(nextLevelId('6-4')).toBe('7-1');
    expect(boatWorldPairs()).toHaveLength(7);
  });
});
