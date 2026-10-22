import { describe, expect, it } from 'vitest';
import { ENEMY_KINDS, enemiesForWorld } from '../config';
import { MEADOW_FROG_SOURCES, enemyTextureKey, enemyTextureKeys } from './enemies';

const POSES = ['idle', 'move', 'attack', 'hurt', 'dead'] as const;

describe('world enemy art', () => {
  it('gives every enemy its own generated frames', () => {
    expect(ENEMY_KINDS).toHaveLength(18);
    expect(new Set(ENEMY_KINDS).size).toBe(18);
    for (const kind of ENEMY_KINDS) {
      expect(enemyTextureKeys(kind)).toEqual(POSES.map((pose) => `enemy-${kind}-${pose}`));
    }
  });

  it('does not share enemy textures across worlds', () => {
    const used = new Map<string, number>();
    for (let world = 1; world <= 8; world += 1) {
      for (const kind of enemiesForWorld(world)) {
        for (const pose of POSES) {
          const key = enemyTextureKey(kind, pose);
          expect(used.has(key), `${key} reused by world ${world}`).toBe(false);
          used.set(key, world);
        }
      }
    }
  });

  it('uses the original world 1 Kenney frog frames', () => {
    expect(MEADOW_FROG_SOURCES).toEqual({
      idle: 'kenney-frog-rest',
      move: 'kenney-frog-jump',
      attack: 'kenney-frog-idle',
      hurt: 'kenney-frog-rest',
      dead: 'kenney-frog-idle',
    });
  });

  it('does not use the Kenney mouse for any enemy', () => {
    for (const kind of ENEMY_KINDS) {
      for (const pose of POSES) {
        expect(enemyTextureKey(kind, pose)).not.toMatch(/mouse/i);
      }
    }
  });
});
