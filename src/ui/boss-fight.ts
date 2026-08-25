import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { maybeShake } from '../data/settings';
import { textStyle, UI } from './menu';

export function showBossFightBanner(scene: Phaser.Scene): void {
  const x = GAME_WIDTH / 2;
  const y = GAME_HEIGHT - 96;

  const wash = scene.add
    .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xff1a12, 0.45)
    .setScrollFactor(0)
    .setDepth(54);
  const flashBar = scene.add
    .rectangle(x, y, GAME_WIDTH, 130, 0xfff4e8, 0.75)
    .setScrollFactor(0)
    .setDepth(55);
  const bar = scene.add
    .rectangle(x, y, 720, 66, 0x140508, 0.94)
    .setStrokeStyle(4, 0xe23b3b, 1)
    .setScale(0.06, 1)
    .setScrollFactor(0)
    .setDepth(56);
  const inner = scene.add
    .rectangle(x, y, 692, 50, 0x000000, 0)
    .setStrokeStyle(2, 0xffd0a8, 0.55)
    .setScale(0.06, 1)
    .setScrollFactor(0)
    .setDepth(56);
  const ghost = scene.add
    .text(x, y, 'BOSS FIGHT', {
      ...textStyle('58px', '#e23b3b'),
      stroke: '#6a0610',
      strokeThickness: 6,
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(57)
    .setAlpha(0.7);
  const label = scene.add
    .text(x, y, 'BOSS FIGHT', {
      ...textStyle('58px', UI.gold),
      stroke: '#6a0610',
      strokeThickness: 6,
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(58)
    .setScale(3.4)
    .setAlpha(0)
    .setAngle(-10);
  const slashL = scene.add
    .text(x - 160, y, '///', {
      ...textStyle('28px', '#e23b3b'),
      strokeThickness: 6,
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(57)
    .setAlpha(0);
  const slashR = scene.add
    .text(x + 160, y, '///', {
      ...textStyle('28px', '#e23b3b'),
      strokeThickness: 6,
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(57)
    .setAlpha(0);

  const bits: Phaser.GameObjects.GameObject[] = [wash, flashBar, bar, inner, ghost, label, slashL, slashR];
  const destroyBits = (): void => {
    for (const bit of bits) {
      bit.destroy();
    }
    bits.length = 0;
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, destroyBits);

  maybeShake(scene, 280, 0.014);

  scene.tweens.add({
    targets: wash,
    alpha: 0,
    duration: 340,
    ease: 'Quad.easeOut',
  });
  scene.tweens.add({
    targets: flashBar,
    alpha: 0,
    duration: 150,
    ease: 'Quad.easeOut',
  });
  scene.tweens.add({
    targets: [bar, inner],
    scaleX: 1,
    duration: 170,
    ease: 'Back.easeOut',
  });
  scene.tweens.add({
    targets: ghost,
    scale: 2.1,
    alpha: 0,
    duration: 420,
    ease: 'Cubic.easeOut',
  });
  scene.tweens.add({
    targets: label,
    alpha: 1,
    scale: 1.2,
    angle: 0,
    duration: 220,
    ease: 'Back.easeOut',
    onComplete: () => {
      if (!label.active) {
        return;
      }
      scene.tweens.add({
        targets: label,
        scale: 1.08,
        duration: 90,
        yoyo: true,
        repeat: 5,
        ease: 'Sine.easeInOut',
      });
    },
  });
  scene.tweens.add({
    targets: [slashL, slashR],
    alpha: 1,
    duration: 120,
    delay: 70,
  });
  scene.tweens.add({
    targets: slashL,
    x: x - 268,
    duration: 180,
    ease: 'Back.easeOut',
  });
  scene.tweens.add({
    targets: slashR,
    x: x + 268,
    duration: 180,
    ease: 'Back.easeOut',
  });

  if (scene.textures.exists('poof-particle')) {
    const burst = scene.add.particles(x, y, 'poof-particle', {
      speed: { min: 90, max: 340 },
      scale: { start: 1.15, end: 0 },
      lifespan: 440,
      quantity: 18,
      tint: [0xe23b3b, 0xffe9a8, 0xff6622],
      emitting: false,
    });
    burst.setScrollFactor(0).setDepth(57);
    burst.explode(24);
    bits.push(burst);
    scene.time.delayedCall(520, () => burst.destroy());
  }

  scene.time.delayedCall(90, () => maybeShake(scene, 150, 0.007));

  scene.time.delayedCall(1700, () => {
    const remaining = [bar, inner, label, slashL, slashR].filter((bit) => bit.active);
    scene.tweens.killTweensOf(remaining);
    scene.tweens.add({
      targets: remaining,
      alpha: 0,
      y: y + 20,
      duration: 280,
      ease: 'Quad.easeIn',
      onComplete: destroyBits,
    });
  });
}
