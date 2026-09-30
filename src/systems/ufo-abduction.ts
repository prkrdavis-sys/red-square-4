import Phaser from 'phaser';
import type { Player } from '../entities/Player';
import { maybeShake } from '../data/settings';
import { audio } from './audio';
import {
  UFO_BEAM_KEY,
  UFO_BEAM_TOP_W,
  UFO_BEAM_W,
  UFO_DOME_Y,
  UFO_EMITTER_Y,
  UFO_H,
  UFO_KEY,
  UFO_LIGHT_KEY,
  UFO_RIM,
  UFO_STREAK_KEY,
  UFO_W,
} from './escape-textures';

const UFO_DEPTH = 24;
const BEAM_DEPTH = 18;
const RIM_LIGHTS = 11;
const RIM_COLORS = [0xff4a4a, 0xffd23a, 0x5aff7a, 0x5ae8ff, 0xff6ae8];
const ARRIVE_MS = 950;
const BEAM_OPEN_MS = 380;
const ZIP_MS = 620;

/**
 * UFO ending: the saucer swoops in over `player`, opens a tractor beam and reels them into
 * the dome, then streaks off. `onDone` fires only after the saucer has left the screen.
 */
export function playAbduction(scene: Phaser.Scene, player: Player, onDone: () => void): void {
  const view = scene.cameras.main.worldView;
  const x = player.x;
  const floorY = player.arcadeBody.bottom;
  const hoverY = Math.max(view.y + UFO_H / 2 + 24, floorY - 430);
  const beamTop = hoverY + UFO_EMITTER_Y - UFO_H / 2;
  const beamHeight = floorY - beamTop + 6;
  const domeY = hoverY + UFO_DOME_Y - UFO_H / 2;

  const streak = scene.add.image(-UFO_W / 2 + 36, 4, UFO_STREAK_KEY).setOrigin(1, 0.5).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
  const hull = scene.add.image(0, 0, UFO_KEY);
  const lights = Array.from({ length: RIM_LIGHTS }, (_, i) => {
    const a = (i / (RIM_LIGHTS - 1)) * Math.PI;
    return scene.add
      .image(Math.cos(a) * UFO_RIM.rx, UFO_RIM.y + Math.sin(a) * UFO_RIM.ry - 14, UFO_LIGHT_KEY)
      .setBlendMode(Phaser.BlendModes.ADD);
  });
  const ufo = scene.add.container(x + 560, view.y - UFO_H, [streak, hull, ...lights]).setDepth(UFO_DEPTH).setAngle(14);

  let phase = 0;
  const chase = scene.time.addEvent({
    delay: 80,
    loop: true,
    callback: () => {
      phase += 1;
      lights.forEach((light, i) => {
        const hot = (i + phase) % 3 === 0;
        light.setTint(RIM_COLORS[(i + Math.floor(phase / 3)) % RIM_COLORS.length] ?? 0xffffff);
        light.setAlpha(hot ? 1 : 0.3);
        light.setScale(hot ? 1.25 : 0.8);
      });
    },
  });

  const beam = scene.add
    .image(x, beamTop, UFO_BEAM_KEY)
    .setOrigin(0.5, 0)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(BEAM_DEPTH)
    .setDisplaySize(UFO_BEAM_W * 0.72, beamHeight)
    .setVisible(false);
  const beamScaleY = beam.scaleY;
  const pool = scene.add
    .ellipse(x, floorY - 2, UFO_BEAM_W * 0.66, 26, 0x7affb0, 0.55)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(BEAM_DEPTH)
    .setAlpha(0);
  const sparkles = scene.add
    .particles(0, 0, 'firework-spark', {
      x: { min: x - 70, max: x + 70 },
      y: { min: floorY - 30, max: floorY },
      speedY: { min: -260, max: -140 },
      speedX: { min: -14, max: 14 },
      scale: { start: 0.34, end: 0 },
      alpha: { start: 0.9, end: 0 },
      lifespan: 1500,
      frequency: 45,
      tint: [0xffffff, 0xb8ffd0, 0x7affb0],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    })
    .setDepth(BEAM_DEPTH + 1);
  const rings = scene.time.addEvent({
    delay: 240,
    loop: true,
    paused: true,
    callback: () => {
      const ring = scene.add
        .ellipse(x, floorY - 6, UFO_BEAM_W * 0.62, 22)
        .setStrokeStyle(3, 0xd8ffe4, 0.9)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(BEAM_DEPTH + 1);
      scene.tweens.add({
        targets: ring,
        y: beamTop + 18,
        scaleX: UFO_BEAM_TOP_W / (UFO_BEAM_W * 0.62),
        scaleY: 0.5,
        alpha: 0,
        duration: 900,
        ease: 'Quad.easeIn',
        onComplete: () => ring.destroy(),
      });
    },
  });

  scene.tweens.add({
    targets: ufo,
    x,
    y: hoverY,
    angle: 0,
    duration: ARRIVE_MS,
    ease: 'Cubic.easeOut',
    onComplete: () => {
      const bob = scene.tweens.add({ targets: ufo, y: hoverY + 6, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      openBeam(bob);
    },
  });

  function openBeam(bob: Phaser.Tweens.Tween): void {
    audio.play(scene, 'ufo-beam');
    audio.setMusicDuck(0.25);
    beam.setVisible(true).setScale(beam.scaleX, 0);
    scene.tweens.add({ targets: beam, scaleY: beamScaleY, duration: BEAM_OPEN_MS, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: beam, alpha: { from: 1, to: 0.78 }, duration: 70, yoyo: true, repeat: -1, delay: BEAM_OPEN_MS });
    scene.tweens.add({ targets: pool, alpha: 1, duration: BEAM_OPEN_MS });
    sparkles.start();
    rings.paused = false;
    scene.cameras.main.flash(160, 180, 255, 200);
    scene.time.delayedCall(BEAM_OPEN_MS + 200, () => player.abduct(x, domeY, () => swallow(bob)));
  }

  function swallow(bob: Phaser.Tweens.Tween): void {
    audio.play(scene, 'abduct-pop');
    maybeShake(scene, 120, 0.004);
    const pop = scene.add.circle(x, domeY, 22, 0xffffff, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(UFO_DEPTH + 1);
    scene.tweens.add({ targets: pop, scale: 3.2, alpha: 0, duration: 320, ease: 'Quad.easeOut', onComplete: () => pop.destroy() });
    hull.setTintFill(0xffffff);
    scene.time.delayedCall(60, () => hull.clearTint());
    rings.remove();
    sparkles.stop();
    scene.tweens.killTweensOf(beam);
    scene.tweens.add({ targets: beam, scaleY: 0, alpha: 0.4, duration: 300, ease: 'Quad.easeIn' });
    scene.tweens.add({ targets: pool, alpha: 0, duration: 300 });
    scene.time.delayedCall(520, () => zipAway(bob));
  }

  function zipAway(bob: Phaser.Tweens.Tween): void {
    bob.stop();
    const exitX = x + 1500;
    const exitY = view.y - 360;
    ufo.setAngle(Phaser.Math.RadToDeg(Math.atan2(exitY - ufo.y, exitX - ufo.x)));
    scene.tweens.add({ targets: streak, alpha: 1, scaleX: 2.4, duration: ZIP_MS * 0.6, ease: 'Quad.easeIn' });
    scene.tweens.add({
      targets: ufo,
      x: exitX,
      y: exitY,
      duration: ZIP_MS,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        chase.remove();
        beam.destroy();
        pool.destroy();
        ufo.destroy();
        scene.time.delayedCall(700, () => {
          sparkles.destroy();
          onDone();
        });
      },
    });
    scene.time.delayedCall(ZIP_MS * 0.7, () => twinkle(scene, view.right - 40, view.y + 40));
  }
}

/** The classic "ding" star where the saucer left the frame. */
function twinkle(scene: Phaser.Scene, x: number, y: number): void {
  const star = scene.add
    .star(x, y, 4, 4, 22, 0xffffff)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(UFO_DEPTH + 2)
    .setScale(0.2);
  scene.tweens.add({
    targets: star,
    scale: 1.3,
    angle: 90,
    duration: 220,
    yoyo: true,
    ease: 'Quad.easeOut',
    onComplete: () => star.destroy(),
  });
}
