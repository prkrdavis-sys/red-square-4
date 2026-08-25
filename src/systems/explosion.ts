import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { maybeShake } from '../data/settings';
import { spawnFlakBurst } from './flak';

export const DEATH_BLAST_MS = 1500;

function track<T extends Phaser.GameObjects.GameObject>(
  bits: Phaser.GameObjects.GameObject[],
  object: T,
): T {
  bits.push(object);
  return object;
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
  emitter.setDepth(44);
  track(bits, emitter);
  emitter.explode(count);
}

export function spawnDeathBlast(scene: Phaser.Scene, x: number, y: number, flipX = false): void {
  const bits: Phaser.GameObjects.GameObject[] = [];
  const cleanup = (): void => {
    for (const bit of bits) {
      bit.destroy();
    }
    bits.length = 0;
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);

  maybeShake(scene, 980, 0.048);
  scene.cameras.main.flash(220, 255, 220, 170);

  const flash = track(
    bits,
    scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xfff4d8, 0.92)
      .setScrollFactor(0)
      .setDepth(70),
  );
  scene.tweens.add({
    targets: flash,
    alpha: 0,
    duration: 260,
    ease: 'Quad.easeOut',
  });

  const wash = track(
    bits,
    scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xff4a12, 0.42)
      .setScrollFactor(0)
      .setDepth(69),
  );
  scene.tweens.add({
    targets: wash,
    alpha: 0,
    duration: 640,
    ease: 'Quad.easeOut',
  });

  const scorch = track(bits, scene.add.ellipse(x, y + 28, 70, 24, 0x140808, 0.72).setDepth(10));
  scene.tweens.add({
    targets: scorch,
    scaleX: 9,
    scaleY: 3.4,
    duration: 180,
    ease: 'Cubic.easeOut',
  });
  scene.tweens.add({
    targets: scorch,
    alpha: 0,
    duration: 700,
    delay: 780,
    ease: 'Sine.easeIn',
  });

  const core = track(
    bits,
    scene.add.image(x, y, 'blast-core').setDepth(46).setScale(0.18).setBlendMode(Phaser.BlendModes.ADD),
  );
  scene.tweens.add({
    targets: core,
    scale: 14.5,
    duration: 160,
    ease: 'Cubic.easeOut',
    onComplete: () => {
      if (!core.active) {
        return;
      }
      scene.tweens.add({
        targets: core,
        scale: 22,
        alpha: 0,
        duration: 620,
        ease: 'Quad.easeIn',
      });
    },
  });

  const aftershock = track(
    bits,
    scene.add.image(x, y - 20, 'blast-core').setDepth(45).setScale(0.1).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD),
  );
  scene.tweens.add({
    targets: aftershock,
    scale: 11,
    alpha: 0.85,
    duration: 140,
    delay: 160,
    ease: 'Cubic.easeOut',
    onComplete: () => {
      if (!aftershock.active) {
        return;
      }
      scene.tweens.add({
        targets: aftershock,
        scale: 16,
        alpha: 0,
        duration: 520,
        ease: 'Quad.easeIn',
      });
    },
  });

  for (let i = 0; i < 3; i += 1) {
    const ring = track(
      bits,
      scene.add.image(x, y, 'blast-ring').setDepth(43).setScale(0.15).setAlpha(0.95),
    );
    scene.tweens.add({
      targets: ring,
      scale: 16 + i * 5,
      alpha: 0,
      duration: 520 + i * 180,
      delay: i * 70,
      ease: 'Cubic.easeOut',
    });
  }

  for (let i = 0; i < 12; i += 1) {
    const angle = (Math.PI * 2 * i) / 12;
    const dist = 210 + (i % 4) * 90;
    const fire = track(
      bits,
      scene.add
        .image(x, y, 'blast-core')
        .setDepth(44)
        .setScale(0.35)
        .setBlendMode(Phaser.BlendModes.ADD),
    );
    scene.tweens.add({
      targets: fire,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist * 0.78,
      scale: 4.2,
      alpha: 0,
      duration: 480 + (i % 3) * 80,
      ease: 'Cubic.easeOut',
    });
  }

  const stem = track(bits, scene.add.image(x, y, 'blast-smoke').setDepth(41).setScale(0.9).setTint(0x5a4030));
  scene.tweens.add({
    targets: stem,
    y: y - 190,
    scaleX: 2.8,
    scaleY: 5.4,
    alpha: 0,
    duration: 1180,
    ease: 'Cubic.easeOut',
  });
  for (let i = 0; i < 6; i += 1) {
    const spread = i - 2.5;
    const cap = track(
      bits,
      scene.add
        .image(x + spread * 28, y - 24, 'blast-smoke')
        .setDepth(42)
        .setScale(0.55)
        .setTint(i % 2 === 0 ? 0xff9966 : 0x6a6058),
    );
    scene.tweens.add({
      targets: cap,
      x: x + spread * 128,
      y: y - 250 - Math.abs(spread) * 10,
      scale: 3.6 + Math.abs(spread) * 0.35,
      alpha: 0,
      duration: 1240,
      delay: 50 + i * 28,
      ease: 'Cubic.easeOut',
    });
  }

  burst(
    scene,
    bits,
    x,
    y,
    'blast-core',
    {
      speed: { min: 180, max: 760 },
      scale: { start: 0.7, end: 0.05 },
      lifespan: { min: 420, max: 820 },
      blendMode: Phaser.BlendModes.ADD,
      tint: [0xffffff, 0xffee88, 0xff6622, 0xe23b3b],
      gravityY: -70,
      rotate: { min: 0, max: 360 },
    },
    56,
  );
  burst(
    scene,
    bits,
    x,
    y,
    'blast-smoke',
    {
      speed: { min: 40, max: 280 },
      scale: { start: 0.8, end: 2.4 },
      lifespan: { min: 700, max: 1200 },
      tint: [0x5a4030, 0xffaa77, 0x8a8070],
      gravityY: -120,
      alpha: { start: 0.85, end: 0 },
    },
    36,
  );
  burst(
    scene,
    bits,
    x,
    y,
    'blast-spark',
    {
      speed: { min: 260, max: 920 },
      scale: { start: 1.3, end: 0.2 },
      lifespan: { min: 380, max: 780 },
      blendMode: Phaser.BlendModes.ADD,
      gravityY: 420,
      rotate: { min: -120, max: 120 },
    },
    40,
  );
  spawnFlakBurst(scene, x, y, flipX);

  scene.time.delayedCall(90, () => maybeShake(scene, 420, 0.018));
  scene.time.delayedCall(DEATH_BLAST_MS + 80, cleanup);
}
