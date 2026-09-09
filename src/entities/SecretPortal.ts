import Phaser from 'phaser';
import { themeSky, type Theme } from '../config';

export class SecretPortal extends Phaser.Physics.Arcade.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number, theme: Theme) {
    super(scene, x, y, 'secret-portal');
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.setDepth(17);
    this.setTint(themeSky(theme));
    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    body.setCircle(22, 10, 10);
    body.updateFromGameObject();
    scene.tweens.add({
      targets: this,
      angle: 360,
      duration: 2800,
      repeat: -1,
      ease: 'Linear',
    });
    scene.tweens.add({
      targets: this,
      scale: 1.12,
      duration: 720,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    scene.add.particles(x, y, 'poof-particle', {
      lifespan: 700,
      speed: { min: 8, max: 28 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.7, end: 0 },
      frequency: 80,
      quantity: 1,
      blendMode: 'ADD',
    }).setDepth(16);
  }
}
