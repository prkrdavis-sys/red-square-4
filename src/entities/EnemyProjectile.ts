import Phaser from 'phaser';
import type { EnemyKind } from '../config';
import {
  BOOMERANG_CATCH_RADIUS,
  BOOMERANG_OUTBOUND_MS,
  BOOMERANG_RETURN_RANGE,
  BOOMERANG_SHOT_SPEED,
  FIREBALL_MAX_TURN_RAD_PER_SEC,
  FIREBALL_SEEK_FOLLOW_PER_SEC,
  FIREBALL_SHOT_SPEED,
  boomerangHomeVelocity,
  projectileLifetimeMs,
  projectileStyleForKind,
  steerToward,
  type ProjectileStyle,
} from '../systems/projectile-style';

export class EnemyProjectile extends Phaser.Physics.Arcade.Sprite {
  readonly ownerKind: EnemyKind;
  readonly style: ProjectileStyle;
  readonly spawnedAt: number;
  neutralized = false;
  private readonly launchVelocityX: number;
  private readonly launchVelocityY: number;
  private readonly launchGravity: boolean;
  private readonly spawnX: number;
  private readonly spawnY: number;
  private readonly thrower?: Phaser.GameObjects.Sprite;
  private seekX: number;
  private seekY: number;
  private returning = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    ownerKind: EnemyKind,
    velocityX: number,
    velocityY: number,
    gravity = false,
    thrower?: Phaser.GameObjects.Sprite,
    aim?: { x: number; y: number },
  ) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.ownerKind = ownerKind;
    this.style = projectileStyleForKind(ownerKind);
    this.spawnedAt = scene.time.now;
    this.launchVelocityX = velocityX;
    this.launchVelocityY = velocityY;
    this.launchGravity = gravity;
    this.spawnX = x;
    this.spawnY = y;
    this.thrower = thrower;
    this.seekX = aim?.x ?? x;
    this.seekY = aim?.y ?? y;
    this.setDepth(17);
    this.setDataEnabled();
    this.launch();
  }

  /** Physics groups apply velocity 0 / gravity defaults on add; call again after `group.add`. */
  launch(): void {
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (!body) {
      return;
    }
    body.setAllowGravity(this.launchGravity);
    body.setImmovable(false);
    body.setBounce(0, 0);
    body.setDrag(0, 0);
    body.setFriction(0, 0);
    body.setSize(Math.max(12, this.width * 0.65), Math.max(12, this.height * 0.65));
    body.setVelocity(this.launchVelocityX, this.launchVelocityY);
  }

  tick(player: Phaser.Physics.Arcade.Sprite): void {
    if (!this.active) {
      return;
    }
    if (this.scene.time.now - this.spawnedAt > projectileLifetimeMs(this.style)) {
      this.destroy();
      return;
    }
    if (this.neutralized) {
      return;
    }
    switch (this.style) {
      case 'thorn':
      case 'icicle':
        this.faceVelocity();
        return;
      case 'cactus':
        this.setAngle(this.angle + 8);
        return;
      case 'bubble':
        this.pulseBubble();
        return;
      case 'fireball':
        this.steerFireball(player);
        this.faceVelocity();
        return;
      case 'boomerang':
        this.tickBoomerang();
        this.setAngle(this.angle + 12);
        return;
      default: {
        const neverStyle: never = this.style;
        return neverStyle;
      }
    }
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

  private faceVelocity(): void {
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (!body) {
      return;
    }
    this.setRotation(Math.atan2(body.velocity.y, body.velocity.x));
  }

  private pulseBubble(): void {
    this.setScale(1 + Math.sin(this.scene.time.now / 140) * 0.08);
  }

  private steerFireball(player: Phaser.Physics.Arcade.Sprite): void {
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (!body) {
      return;
    }
    const dt = Math.min(0.05, this.scene.game.loop.delta / 1000);
    const follow = 1 - Math.exp(-FIREBALL_SEEK_FOLLOW_PER_SEC * dt);
    this.seekX += (player.x - this.seekX) * follow;
    this.seekY += (player.y - this.seekY) * follow;
    const steered = steerToward(
      body.velocity.x,
      body.velocity.y,
      this.seekX - this.x,
      this.seekY - this.y,
      FIREBALL_MAX_TURN_RAD_PER_SEC * dt,
      FIREBALL_SHOT_SPEED,
    );
    body.setVelocity(steered.vx, steered.vy);
  }

  private tickBoomerang(): void {
    const traveled = Math.hypot(this.x - this.spawnX, this.y - this.spawnY);
    if (
      !this.returning &&
      (this.scene.time.now - this.spawnedAt >= BOOMERANG_OUTBOUND_MS || traveled >= BOOMERANG_RETURN_RANGE)
    ) {
      this.returning = true;
    }
    if (!this.returning) {
      return;
    }
    const owner = this.thrower;
    if (!owner?.active) {
      return;
    }
    if (Phaser.Math.Distance.Between(this.x, this.y, owner.x, owner.y) <= BOOMERANG_CATCH_RADIUS) {
      this.destroy();
      return;
    }
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (!body) {
      return;
    }
    const home = boomerangHomeVelocity(this.x, this.y, owner.x, owner.y, BOOMERANG_SHOT_SPEED);
    body.setVelocity(home.vx, home.vy);
  }
}
