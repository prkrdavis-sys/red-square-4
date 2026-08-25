import type { EnemyKind } from '../config';

export type CharacterPose = 'idle' | 'move' | 'attack' | 'hurt' | 'dead';

interface CharacterFrames {
  idle: string;
  move: string;
  attack: string;
  hurt: string;
  dead: string;
}

const ENEMY_ROOT = 'enemies';
const CHARACTER_ROOT = 'characters';

export const CHARACTER_ASSETS: Record<string, string> = {
  'kenney-frog-rest': `${ENEMY_ROOT}/frog_rest.png`,
  'kenney-frog-jump': `${ENEMY_ROOT}/frog_jump.png`,
  'kenney-frog-idle': `${ENEMY_ROOT}/frog_idle.png`,
  'kenney-bee-rest': `${ENEMY_ROOT}/bee_rest.png`,
  'kenney-bee-a': `${ENEMY_ROOT}/bee_a.png`,
  'kenney-bee-b': `${ENEMY_ROOT}/bee_b.png`,
  'kenney-ladybug-rest': `${ENEMY_ROOT}/ladybug_rest.png`,
  'kenney-ladybug-walk-a': `${ENEMY_ROOT}/ladybug_walk_a.png`,
  'kenney-ladybug-walk-b': `${ENEMY_ROOT}/ladybug_walk_b.png`,
  'kenney-ladybug-fly': `${ENEMY_ROOT}/ladybug_fly.png`,
  'kenney-mouse-rest': `${ENEMY_ROOT}/mouse_rest.png`,
  'kenney-mouse-walk-a': `${ENEMY_ROOT}/mouse_walk_a.png`,
  'kenney-mouse-walk-b': `${ENEMY_ROOT}/mouse_walk_b.png`,
  'kenney-fly-rest': `${ENEMY_ROOT}/fly_rest.png`,
  'kenney-fly-a': `${ENEMY_ROOT}/fly_a.png`,
  'kenney-fly-b': `${ENEMY_ROOT}/fly_b.png`,
  'kenney-slime-block-rest': `${ENEMY_ROOT}/slime_block_rest.png`,
  'kenney-slime-block-walk-a': `${ENEMY_ROOT}/slime_block_walk_a.png`,
  'kenney-slime-block-walk-b': `${ENEMY_ROOT}/slime_block_walk_b.png`,
  'kenney-slime-block-jump': `${ENEMY_ROOT}/slime_block_jump.png`,
  'kenney-slime-block-flat': `${ENEMY_ROOT}/slime_block_jump.png`,
  'kenney-worm-ring-rest': `${ENEMY_ROOT}/worm_ring_rest.png`,
  'kenney-worm-ring-a': `${ENEMY_ROOT}/worm_ring_move_a.png`,
  'kenney-worm-ring-b': `${ENEMY_ROOT}/worm_ring_move_b.png`,
  'kenney-slime-spike-rest': `${ENEMY_ROOT}/slime_spike_rest.png`,
  'kenney-slime-spike-walk-a': `${ENEMY_ROOT}/slime_spike_walk_a.png`,
  'kenney-slime-spike-walk-b': `${ENEMY_ROOT}/slime_spike_walk_b.png`,
  'kenney-slime-spike-flat': `${ENEMY_ROOT}/slime_spike_flat.png`,
  'kenney-worm-normal-rest': `${ENEMY_ROOT}/worm_normal_rest.png`,
  'kenney-worm-normal-a': `${ENEMY_ROOT}/worm_normal_move_a.png`,
  'kenney-worm-normal-b': `${ENEMY_ROOT}/worm_normal_move_b.png`,
  'kenney-snail-rest': `${ENEMY_ROOT}/snail_rest.png`,
  'kenney-snail-walk-a': `${ENEMY_ROOT}/snail_walk_a.png`,
  'kenney-snail-walk-b': `${ENEMY_ROOT}/snail_walk_b.png`,
  'kenney-snail-shell': `${ENEMY_ROOT}/snail_shell.png`,
  'kenney-fish-blue-rest': `${ENEMY_ROOT}/fish_blue_rest.png`,
  'kenney-fish-blue-a': `${ENEMY_ROOT}/fish_blue_swim_a.png`,
  'kenney-fish-blue-b': `${ENEMY_ROOT}/fish_blue_swim_b.png`,
  'kenney-fish-purple-rest': `${ENEMY_ROOT}/fish_purple_rest.png`,
  'kenney-fish-purple-up': `${ENEMY_ROOT}/fish_purple_up.png`,
  'kenney-fish-purple-down': `${ENEMY_ROOT}/fish_purple_down.png`,
  'kenney-slime-fire-rest': `${ENEMY_ROOT}/slime_fire_rest.png`,
  'kenney-slime-fire-walk-a': `${ENEMY_ROOT}/slime_fire_walk_a.png`,
  'kenney-slime-fire-walk-b': `${ENEMY_ROOT}/slime_fire_walk_b.png`,
  'kenney-slime-fire-flat': `${ENEMY_ROOT}/slime_fire_flat.png`,
  'kenney-barnacle-rest': `${ENEMY_ROOT}/barnacle_attack_rest.png`,
  'kenney-barnacle-attack-a': `${ENEMY_ROOT}/barnacle_attack_a.png`,
  'kenney-barnacle-attack-b': `${ENEMY_ROOT}/barnacle_attack_b.png`,
  'kenney-block-idle': `${ENEMY_ROOT}/block_idle.png`,
  'kenney-block-rest': `${ENEMY_ROOT}/block_rest.png`,
  'kenney-block-fall': `${ENEMY_ROOT}/block_fall.png`,
};

for (const color of ['beige', 'green', 'pink', 'purple', 'yellow']) {
  for (const pose of ['climb_a', 'duck', 'front', 'hit', 'idle', 'jump', 'walk_a', 'walk_b']) {
    CHARACTER_ASSETS[`kenney-character-${color}-${pose.replace('_', '-')}`] =
      `${CHARACTER_ROOT}/character_${color}_${pose}.png`;
  }
}

const ENEMY_FRAMES: Record<EnemyKind, CharacterFrames> = {
  'bramble-hopper': {
    idle: 'kenney-frog-rest',
    move: 'kenney-frog-jump',
    attack: 'kenney-frog-idle',
    hurt: 'kenney-frog-rest',
    dead: 'kenney-frog-idle',
  },
  'acorn-slinger': {
    idle: 'kenney-bee-rest',
    move: 'kenney-bee-a',
    attack: 'kenney-bee-b',
    hurt: 'kenney-bee-rest',
    dead: 'kenney-bee-b',
  },
  'skating-hare': {
    idle: 'kenney-mouse-rest',
    move: 'kenney-mouse-walk-a',
    attack: 'kenney-mouse-walk-b',
    hurt: 'kenney-mouse-rest',
    dead: 'kenney-mouse-walk-b',
  },
  'snowball-finch': {
    idle: 'kenney-fly-rest',
    move: 'kenney-fly-a',
    attack: 'kenney-fly-b',
    hurt: 'kenney-fly-rest',
    dead: 'kenney-fly-b',
  },
  'dune-scarab': {
    idle: 'kenney-worm-ring-rest',
    move: 'kenney-worm-ring-a',
    attack: 'kenney-worm-ring-b',
    hurt: 'kenney-worm-ring-rest',
    dead: 'kenney-worm-ring-b',
  },
  'cactus-imp': {
    idle: 'kenney-slime-spike-rest',
    move: 'kenney-slime-spike-walk-a',
    attack: 'kenney-slime-spike-walk-b',
    hurt: 'kenney-slime-spike-rest',
    dead: 'kenney-slime-spike-flat',
  },
  'reef-crab': {
    idle: 'kenney-snail-rest',
    move: 'kenney-snail-walk-a',
    attack: 'kenney-snail-shell',
    hurt: 'kenney-snail-walk-b',
    dead: 'kenney-snail-shell',
  },
  'bubble-archerfish': {
    idle: 'kenney-fish-blue-rest',
    move: 'kenney-fish-blue-a',
    attack: 'kenney-fish-blue-b',
    hurt: 'kenney-fish-blue-rest',
    dead: 'kenney-fish-blue-b',
  },
  'clockwork-hound': {
    idle: 'kenney-slime-fire-rest',
    move: 'kenney-slime-fire-walk-a',
    attack: 'kenney-slime-fire-walk-b',
    hurt: 'kenney-slime-fire-rest',
    dead: 'kenney-slime-fire-flat',
  },
  'gargoyle-page': {
    idle: 'kenney-barnacle-rest',
    move: 'kenney-barnacle-attack-a',
    attack: 'kenney-barnacle-attack-b',
    hurt: 'kenney-barnacle-rest',
    dead: 'kenney-barnacle-attack-b',
  },
  'howler-ape': {
    idle: 'kenney-mouse-rest',
    move: 'kenney-mouse-walk-a',
    attack: 'kenney-mouse-walk-b',
    hurt: 'kenney-mouse-rest',
    dead: 'kenney-mouse-walk-b',
  },
  'dart-mosquito': {
    idle: 'kenney-fly-rest',
    move: 'kenney-fly-a',
    attack: 'kenney-fly-b',
    hurt: 'kenney-fly-rest',
    dead: 'kenney-fly-b',
  },
};

export function enemyTextureKey(kind: EnemyKind, pose: CharacterPose): string {
  return ENEMY_FRAMES[kind][pose];
}

export { miniBossTextureKey } from './mini-bosses';
export { worldBossTextureKey } from './world-bosses';
