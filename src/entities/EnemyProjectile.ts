import Phaser from 'phaser';
import type { EnemyKind } from '../config';

export class EnemyProjectile extends Phaser.Physics.Arcade.Sprite {
  readonly ownerKind: EnemyKind;
  readonly spawnedAt: number;
  neutralized = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    ownerKind: EnemyKind,
    velocityX: number,
    velocityY: number,
    gravity = false,
  ) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.ownerKind = ownerKind;
    this.spawnedAt = scene.time.now;
    this.setDepth(17);
    this.setVelocity(velocityX, velocityY);
    this.setDataEnabled();
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = gravity;
    body.setSize(Math.max(12, this.width * 0.65), Math.max(12, this.height * 0.65));
  }

  tick(): void {
    if (!this.active) {
      return;
    }
    if (this.scene.time.now - this.spawnedAt > 5200) {
      this.destroy();
      return;
    }
    this.setAngle(this.angle + 5);
  }

  neutralize(pushDirection: number): void {
    if (this.neutralized) {
      return;
    }
    this.neutralized = true;
    this.setTint(0xb8f5ff);
    this.setVelocity(pushDirection * 260, -180);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = true;
    this.scene.time.delayedCall(700, () => this.destroy());
  }
}
