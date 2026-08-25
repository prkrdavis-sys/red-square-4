import { describe, expect, it } from 'vitest';
import { ENEMY_KINDS, enemiesForWorld } from '../config';
import { enemyTextureKey, enemyTextureKeys } from './enemies';

const POSES = ['idle', 'move', 'attack', 'hurt', 'dead'] as const;

describe('world enemy art', () => {
  it('gives every enemy its own generated frames', () => {
    expect(ENEMY_KINDS).toHaveLength(12);
    expect(new Set(ENEMY_KINDS).size).toBe(12);
    for (const kind of ENEMY_KINDS) {
      expect(enemyTextureKeys(kind)).toEqual(POSES.map((pose) => `enemy-${kind}-${pose}`));
    }
  });

  it('does not share enemy textures across worlds', () => {
    const used = new Map<string, number>();
    for (let world = 1; world <= 6; world += 1) {
      for (const kind of enemiesForWorld(world)) {
        for (const pose of POSES) {
          const key = enemyTextureKey(kind, pose);
          expect(used.has(key), `${key} reused by world ${world}`).toBe(false);
          used.set(key, world);
        }
      }
    }
  });

  it('does not use the Kenney mouse for any enemy', () => {
    for (const kind of ENEMY_KINDS) {
      for (const pose of POSES) {
        expect(enemyTextureKey(kind, pose)).not.toMatch(/mouse/i);
      }
    }
  });
});
