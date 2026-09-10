import Phaser from 'phaser';
import { MOVER_HEIGHT, TILE, type Theme } from '../config';
import { enableOneWayCollision } from '../levels/colliders';
import type { MoverSpawn } from '../levels/grid';
import { moverCarries, moverHomeX, moverHomeY, moverPosition } from './mover-path';
import { moverTileKey } from '../systems/textures';

export class MovingPlatform extends Phaser.Physics.Arcade.Image {
  readonly spec: MoverSpawn;
  private lastX: number;
  private lastY: number;

  constructor(scene: Phaser.Scene, spec: MoverSpawn, theme: Theme) {
    super(scene, moverHomeX(spec), moverHomeY(spec), moverTileKey(theme));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.spec = spec;
    this.lastX = this.x;
    this.lastY = this.y;
    this.setDepth(13);
    this.setDisplaySize(spec.w * TILE, MOVER_HEIGHT);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(spec.w * TILE, MOVER_HEIGHT);
    if (spec.oneWay) {
      enableOneWayCollision(body);
    }
  }

  /**
   * Servo the plate onto its scripted path. Returns how far it moved this frame so
   * the scene can carry riders, which Arcade physics will not do on its own.
   */
  tick(now: number, deltaMs: number): { dx: number; dy: number } {
    const target = moverPosition(this.spec, now);
    const dx = target.x - this.lastX;
    const dy = target.y - this.lastY;

    const seconds = Math.max(deltaMs, 1) / 1000;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(dx / seconds, dy / seconds);
    this.setPosition(target.x, target.y);
    this.lastX = target.x;
    this.lastY = target.y;
    return { dx, dy };
  }

  carries(rider: Phaser.Physics.Arcade.Body): boolean {
    const body = this.body as Phaser.Physics.Arcade.Body;
    return moverCarries(body, {
      bottom: rider.bottom,
      left: rider.left,
      right: rider.right,
      velocityY: rider.velocity.y,
    });
  }
}
