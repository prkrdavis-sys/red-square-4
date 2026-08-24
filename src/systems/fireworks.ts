import Phaser from 'phaser';

import { audio } from './audio';
import {
  checkpointFlagLaunch,
  FIREWORK_FLIGHT_MS,
  FIREWORK_SIDES,
  fireworkArcPoint,
  fireworkArcTangent,
  type FireworkSide,
  type FlagSprite,
} from './fireworks-path';

export { FIREWORK_FLIGHT_MS };
export type { FlagSprite };

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
): void {
  const emitter = scene.add.particles(x, y, texture, { ...config, emitting: false });
  emitter.setDepth(26);
  track(bits, emitter);
  emitter.explode(count);
}

function explodeRocket(
  scene: Phaser.Scene,
  bits: Phaser.GameObjects.GameObject[],
  x: number,
  y: number,
  palette: Palette,
): void {
  const flash = track(
    bits,
    scene.add
      .image(x, y, 'blast-core')
      .setDepth(27)
      .setScale(0.06)
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
    scene.add.image(x, y, 'blast-ring').setDepth(25).setScale(0.08).setAlpha(0.9).setTint(palette.rocket),
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
  );
}

function launchRocket(
  scene: Phaser.Scene,
  bits: Phaser.GameObjects.GameObject[],
  startX: number,
  startY: number,
  side: FireworkSide,
): void {
  const palette = paletteFor(side);
  const rocket = track(
    bits,
    scene.add
      .image(startX, startY, 'blast-spark')
      .setDepth(26)
      .setScale(1.25)
      .setTint(palette.rocket)
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
      tint: palette.trail,
      gravityY: 46,
      alpha: { start: 0.95, end: 0 },
    }),
  );
  trail.setDepth(24);
  trail.startFollow(rocket);

  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: FIREWORK_FLIGHT_MS,
    ease: 'Quad.easeOut',
    onUpdate: (tween) => {
      if (!rocket.active) {
        return;
      }
      const t = tween.getValue() ?? 0;
      const point = fireworkArcPoint(startX, startY, side, t);
      const tangent = fireworkArcTangent(startX, startY, side, t);
      rocket.setPosition(point.x, point.y);
      rocket.setRotation(Math.atan2(tangent.y, tangent.x) + Math.PI / 2);
    },
    onComplete: () => {
      const point = fireworkArcPoint(startX, startY, side, 1);
      trail.stopFollow();
      trail.emitting = false;
      if (rocket.active) {
        rocket.setVisible(false);
      }
      explodeRocket(scene, bits, point.x, point.y, palette);
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
    launchRocket(scene, bits, start.x, start.y, side);
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
