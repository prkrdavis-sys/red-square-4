const CHARACTER_ROOT = 'characters';

export type CharacterPose = 'idle' | 'move' | 'attack' | 'hurt' | 'dead';

export const CHARACTER_ASSETS: Record<string, string> = {};

for (const color of ['beige', 'green', 'pink', 'purple', 'yellow']) {
  for (const pose of ['climb_a', 'duck', 'front', 'hit', 'idle', 'jump', 'walk_a', 'walk_b']) {
    CHARACTER_ASSETS[`kenney-character-${color}-${pose.replace('_', '-')}`] =
      `${CHARACTER_ROOT}/character_${color}_${pose}.png`;
  }
}

export { enemyTextureKey } from './enemies';
export { miniBossTextureKey } from './mini-bosses';
export { worldBossTextureKey } from './world-bosses';
