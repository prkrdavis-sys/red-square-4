import Phaser from 'phaser';

import { audio } from './audio';
import {
  CHECKPOINT_FIREWORK_ARC,
  checkpointFlagLaunch,
  FIREWORK_FLIGHT_MS,
  FIREWORK_SIDES,
  fireworkArcPoint,
  fireworkArcTangent,
  LEVEL_CLEAR_MENU_DELAY_MS,
  VICTORY_FIREWORK_COUNT,
  VICTORY_FLIGHT_MS,
  victoryLaunch,
  type FireworkArc,
  type FireworkSide,
  type FlagSprite,
} from './fireworks-path';

export { FIREWORK_FLIGHT_MS, LEVEL_CLEAR_MENU_DELAY_MS };
export type { FlagSprite };

export const LEVEL_CLEAR_KEY = 'level-clear-celebrate';

const VICTORY_PALETTES: Palette[] = [
  {
    rocket: 0xffe066,
    trail: 0xffcc55,
    burst: [0xffffff, 0xffe566, 0xff9a3a, 0xff5533],
  },
  {
    rocket: 0xff9ad5,
    trail: 0xff77bb,
    burst: [0xffffff, 0xffc0ee, 0xff5aa5, 0x66e8ff],
  },
  {
    rocket: 0x66e8ff,
    trail: 0x44ccee,
    burst: [0xffffff, 0x9aeeff, 0x5ad0ff, 0xffe066],
  },
  {
    rocket: 0x9aff88,
    trail: 0x66ee66,
    burst: [0xffffff, 0xc8ff9a, 0x66e8ff, 0xffe066],
  },
];

interface Palette {
  rocket: number;
  trail: number;
  burst: number[];
}

function track<T extends Phaser.GameObjects.GameObject>(
  bits: Phaser.GameObjects.GameObject[],
  object: T,
): T {
  bits.push(object);
  return object;
}

function paletteFor(side: FireworkSide): Palette {
  switch (side) {
    case -1:
      return {
        rocket: 0xffe066,
        trail: 0xffcc55,
        burst: [0xffffff, 0xffe566, 0xff9a3a, 0xff5533],
      };
    case 1:
      return {
        rocket: 0xff9ad5,
        trail: 0xff77bb,
        burst: [0xffffff, 0xffc0ee, 0xff5aa5, 0x66e8ff],
      };
    default: {
      const neverSide: never = side;
      return neverSide;
    }
  }
}

function burst(
  scene: Phaser.Scene,
  bits: Phaser.GameObjects.GameObject[],
  x: number,
  y: number,
  texture: string,
  config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig,
  count: number,
  scrollFactor: number,
  depth: number,
): void {
  const emitter = scene.add.particles(x, y, texture, { ...config, emitting: false });
  emitter.setDepth(depth);
  emitter.setScrollFactor(scrollFactor);
  track(bits, emitter);
  emitter.explode(count);
}

function explodeRocket(
  scene: Phaser.Scene,
  bits: Phaser.GameObjects.GameObject[],
  x: number,
  y: number,
  palette: Palette,
  scrollFactor: number,
  depth: number,
): void {
  const flash = track(
    bits,
    scene.add
      .image(x, y, 'blast-core')
      .setDepth(depth + 1)
      .setScale(0.06)
      .setScrollFactor(scrollFactor)
      .setTint(palette.rocket)
      .setBlendMode(Phaser.BlendModes.ADD),
  );
  scene.tweens.add({
    targets: flash,
    scale: 0.34,
    alpha: 0,
    duration: 260,
    ease: 'Cubic.easeOut',
  });

  const ring = track(
    bits,
    scene.add
      .image(x, y, 'blast-ring')
      .setDepth(depth - 1)
      .setScale(0.08)
      .setAlpha(0.9)
      .setScrollFactor(scrollFactor)
      .setTint(palette.rocket),
  );
  scene.tweens.add({
    targets: ring,
    scale: 0.82,
    alpha: 0,
    duration: 400,
    ease: 'Cubic.easeOut',
  });

  burst(
    scene,
    bits,
    x,
    y,
    'cartoon-star',
    {
      speed: { min: 70, max: 260 },
      scale: { start: 0.7, end: 0.08 },
      lifespan: { min: 420, max: 720 },
      blendMode: Phaser.BlendModes.ADD,
      tint: palette.burst,
      gravityY: 220,
      rotate: { min: -80, max: 80 },
    },
    16,
    scrollFactor,
    depth,
  );
  burst(
    scene,
    bits,
    x,
    y,
    'firework-spark',
    {
      speed: { min: 90, max: 340 },
      scale: { start: 1.1, end: 0.1 },
      lifespan: { min: 380, max: 680 },
      blendMode: Phaser.BlendModes.ADD,
      tint: palette.burst,
      gravityY: 260,
    },
    22,
    scrollFactor,
    depth,
  );
  burst(
    scene,
    bits,
    x,
    y,
    'blast-spark',
    {
      speed: { min: 80, max: 280 },
      scale: { start: 0.55, end: 0.08 },
      lifespan: { min: 320, max: 560 },
      blendMode: Phaser.BlendModes.ADD,
      tint: palette.burst,
      gravityY: 300,
      rotate: { min: -40, max: 40 },
    },
    10,
    scrollFactor,
    depth,
  );
}

interface RocketSpec {
  startX: number;
  startY: number;
  side: FireworkSide;
  palette: Palette;
  arc?: FireworkArc;
  flightMs?: number;
  scrollFactor?: number;
  depth?: number;
  scale?: number;
}

function launchRocket(scene: Phaser.Scene, bits: Phaser.GameObjects.GameObject[], spec: RocketSpec): void {
  const arc = spec.arc ?? CHECKPOINT_FIREWORK_ARC;
  const flightMs = spec.flightMs ?? FIREWORK_FLIGHT_MS;
  const scrollFactor = spec.scrollFactor ?? 1;
  const depth = spec.depth ?? 26;
  const rocketScale = spec.scale ?? 1.25;
  const rocket = track(
    bits,
    scene.add
      .image(spec.startX, spec.startY, 'blast-spark')
      .setDepth(depth)
      .setScale(rocketScale)
      .setScrollFactor(scrollFactor)
      .setTint(spec.palette.rocket)
      .setBlendMode(Phaser.BlendModes.ADD),
  );
  const trail = track(
    bits,
    scene.add.particles(0, 0, 'firework-spark', {
      speed: { min: 16, max: 48 },
      scale: { start: 1.15, end: 0 },
      lifespan: { min: 220, max: 360 },
      frequency: 16,
      quantity: 2,
      blendMode: Phaser.BlendModes.ADD,
      tint: spec.palette.trail,
      gravityY: 46,
      alpha: { start: 0.95, end: 0 },
    }),
  );
  trail.setDepth(depth - 2);
  trail.setScrollFactor(scrollFactor);
  trail.startFollow(rocket);

  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: flightMs,
    ease: 'Quad.easeOut',
    onUpdate: (tween) => {
      if (!rocket.active) {
        return;
      }
      const t = tween.getValue() ?? 0;
      const point = fireworkArcPoint(spec.startX, spec.startY, spec.side, t, arc);
      const tangent = fireworkArcTangent(spec.startX, spec.startY, spec.side, t, arc);
      rocket.setPosition(point.x, point.y);
      rocket.setRotation(Math.atan2(tangent.y, tangent.x) + Math.PI / 2);
    },
    onComplete: () => {
      const point = fireworkArcPoint(spec.startX, spec.startY, spec.side, 1, arc);
      trail.stopFollow();
      trail.emitting = false;
      if (rocket.active) {
        rocket.setVisible(false);
      }
      explodeRocket(scene, bits, point.x, point.y, spec.palette, scrollFactor, depth);
    },
  });
}

export function spawnCheckpointFireworks(scene: Phaser.Scene, flag: FlagSprite): void {
  const bits: Phaser.GameObjects.GameObject[] = [];
  const cleanup = (): void => {
    for (const bit of bits) {
      bit.destroy();
    }
    bits.length = 0;
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);

  const start = checkpointFlagLaunch(flag);
  const puff = track(
    bits,
    scene.add.particles(start.x, start.y, 'poof-particle', {
      speed: { min: 20, max: 70 },
      scale: { start: 0.4, end: 0 },
      lifespan: 320,
      emitting: false,
      tint: 0xffe8a8,
      gravityY: -40,
    }),
  );
  puff.setDepth(23);
  puff.explode(8);

  for (const side of FIREWORK_SIDES) {
    launchRocket(scene, bits, {
      startX: start.x,
      startY: start.y,
      side,
      palette: paletteFor(side),
    });
  }

  audio.play(scene, 'firework');
  audio.play(scene, 'celebrate');
  scene.time.delayedCall(FIREWORK_FLIGHT_MS, () => {
    if (!scene.scene.isActive()) {
      return;
    }
    audio.play(scene, 'firework-burst');
  });
  scene.time.delayedCall(FIREWORK_FLIGHT_MS + 900, cleanup);
}

export function spawnVictoryFireworks(scene: Phaser.Scene): void {
  const bits: Phaser.GameObjects.GameObject[] = [];
  const cleanup = (): void => {
    for (const bit of bits) {
      bit.destroy();
    }
    bits.length = 0;
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);

  for (const extraDelay of [0, 920]) {
    const count = extraDelay === 0 ? VICTORY_FIREWORK_COUNT : 4;
    for (let index = 0; index < count; index += 1) {
      const launch = victoryLaunch(index);
      const palette = VICTORY_PALETTES[(index + extraDelay) % VICTORY_PALETTES.length];
      if (!palette) {
        continue;
      }
      scene.time.delayedCall(launch.delayMs + extraDelay, () => {
        if (!scene.scene.isActive()) {
          return;
        }
        launchRocket(scene, bits, {
          startX: launch.x + (extraDelay === 0 ? 0 : launch.side * 28),
          startY: launch.y,
          side: launch.side,
          palette,
          arc: launch.arc,
        flightMs: VICTORY_FLIGHT_MS,
        scrollFactor: 0,
        depth: 62,
        scale: 1.7,
        });
      });
    }
  }

  audio.play(scene, 'firework');
  scene.time.delayedCall(160, () => {
    if (scene.scene.isActive()) {
      audio.play(scene, 'firework');
    }
  });
  scene.time.delayedCall(VICTORY_FLIGHT_MS, () => {
    if (scene.scene.isActive()) {
      audio.play(scene, 'firework-burst');
    }
  });
  scene.time.delayedCall(VICTORY_FLIGHT_MS + 180, () => {
    if (scene.scene.isActive()) {
      audio.play(scene, 'firework-burst');
    }
  });
  scene.time.delayedCall(920 + VICTORY_FLIGHT_MS, () => {
    if (scene.scene.isActive()) {
      audio.play(scene, 'firework-burst');
    }
  });
  scene.time.delayedCall(920 + VICTORY_FLIGHT_MS + 1400, cleanup);
}

export function celebrateLevelClear(scene: Phaser.Scene): void {
  if (scene.data.get(LEVEL_CLEAR_KEY) === true) {
    return;
  }
  scene.data.set(LEVEL_CLEAR_KEY, true);
  audio.play(scene, 'victory');
  spawnVictoryFireworks(scene);
}

export function resetLevelClearCelebrate(scene: Phaser.Scene): void {
  scene.data.set(LEVEL_CLEAR_KEY, false);
}
