import Phaser from 'phaser';
import { RANGED_ATTACK_RANGE, enemyRole, type EnemyKind, type EnemyRole } from '../config';
import { audio } from '../systems/audio';
import { enemyTextureKey } from '../systems/characters';
import { bubbleSpreadOffsets, projectileFlightSpeed, projectileStyleForKind } from '../systems/projectile-style';
import { EnemyProjectile } from './EnemyProjectile';

type EnemyPose = 'idle' | 'move' | 'attack' | 'hurt' | 'dead';

const RANGED_WINDUP_MS = 860;
const RANGED_COOLDOWN_MS = 2400;
const FIRST_ATTACK_DELAY_MS = 1400;

export class Baddie extends Phaser.Physics.Arcade.Sprite {
  readonly kind: EnemyKind;
  readonly role: EnemyRole;
  speed: number;
  dir = -1;
  dying = false;
  private nextAttackAt = Number.POSITIVE_INFINITY;
  private nextMoveAt = 0;
  private vulnerableUntil = 0;
  private windingUp = false;
  private windupUntil = 0;
  private threatsArmed = false;
  private charge?: Phaser.GameObjects.Sprite;
  private readonly hitW: number;
  private readonly hitH: number;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: EnemyKind, speed = 70) {
    super(scene, x, y, enemyTextureKey(kind, 'idle'));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.kind = kind;
    this.role = enemyRole(kind);
    this.speed = speed;
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.hitW = Math.max(24, this.width * 0.68);
    this.hitH = Math.max(24, this.height * 0.7);
    body.setSize(this.hitW, this.hitH);
    body.setBounce(0, 0);
    body.pushable = false;
    this.setDepth(15);
    this.once('destroy', () => this.clearCharge());
  }

  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  exposeBySpecial(duration = 1600): void {
    this.vulnerableUntil = this.scene.time.now + duration;
    this.setTint(0xffef9d);
  }

  armThreats(): void {
    if (this.threatsArmed) {
      return;
    }
    this.threatsArmed = true;
    this.nextAttackAt = this.scene.time.now + FIRST_ATTACK_DELAY_MS + Math.floor(Math.random() * 800);
  }

  tryStomp(): 'defeated' | 'armored' {
    this.squash();
    return 'defeated';
  }

  tick(
    player: Phaser.Physics.Arcade.Sprite,
    solids: Phaser.Physics.Arcade.StaticGroup,
    oneways: Phaser.Physics.Arcade.StaticGroup,
    projectiles: Phaser.Physics.Arcade.Group,
  ): void {
    if (this.dying || !this.threatsArmed) {
      return;
    }
    if (!this.windingUp) {
      this.restoreRestTint(this.scene.time.now);
    }
    switch (this.role) {
      case 'movement':
        this.tickMovement(player, solids, oneways);
        break;
      case 'ranged':
        this.tickRanged(player, solids, oneways, projectiles);
        break;
      default: {
        const neverRole: never = this.role;
        return neverRole;
      }
    }
  }

  private tickMovement(
    player: Phaser.Physics.Arcade.Sprite,
    solids: Phaser.Physics.Arcade.StaticGroup,
    oneways: Phaser.Physics.Arcade.StaticGroup,
  ): void {
    this.patrol(solids, oneways);
    const body = this.arcadeBody;
    const dx = player.x - this.x;
    if (
      (this.kind === 'bramble-hopper' ||
        this.kind === 'dune-scarab' ||
        this.kind === 'clockwork-hound' ||
        this.kind === 'howler-ape') &&
      body.blocked.down &&
      Math.abs(dx) < 280 &&
      this.scene.time.now > this.nextMoveAt
    ) {
      body.setVelocityY(this.kind === 'clockwork-hound' ? -320 : -390);
      body.setVelocityX(Math.sign(dx) * this.speed * 1.8);
      this.nextMoveAt = this.scene.time.now + 1200;
    }
    this.present('move');
  }

  private tickRanged(
    player: Phaser.Physics.Arcade.Sprite,
    solids: Phaser.Physics.Arcade.StaticGroup,
    oneways: Phaser.Physics.Arcade.StaticGroup,
    projectiles: Phaser.Physics.Arcade.Group,
  ): void {
    const now = this.scene.time.now;
    const distance = Math.abs(player.x - this.x);
    const facing = player.x > this.x ? 1 : -1;
    if (this.windingUp) {
      this.arcadeBody.setVelocityX(0);
      this.setFlipX(facing > 0);
      this.present('attack');
      this.paintWindup(now, facing, RANGED_WINDUP_MS);
      if (distance > RANGED_ATTACK_RANGE + 140) {
        this.cancelWindup();
        this.present('idle');
        return;
      }
      if (now >= this.windupUntil) {
        this.releaseShot(player, projectiles);
        this.nextAttackAt = now + RANGED_COOLDOWN_MS;
      }
      return;
    }
    if (distance > 300) {
      this.patrol(solids, oneways);
    } else {
      this.arcadeBody.setVelocityX(0);
      this.setFlipX(facing > 0);
    }
    if (distance < RANGED_ATTACK_RANGE && now >= this.nextAttackAt) {
      this.beginWindup(now, facing, RANGED_WINDUP_MS);
    } else {
      this.present(distance < RANGED_ATTACK_RANGE ? 'idle' : 'move');
    }
  }

  private beginWindup(now: number, facing: number, duration: number): void {
    this.scene.tweens.killTweensOf(this);
    this.windingUp = true;
    this.windupUntil = now + duration;
    this.arcadeBody.setVelocityX(0);
    this.present('attack');
    this.ensureCharge(facing);
    this.paintWindup(now, facing, duration);
  }

  private paintWindup(now: number, facing: number, duration: number): void {
    const t = Phaser.Math.Clamp(1 - (this.windupUntil - now) / duration, 0, 1);
    const tremble = Math.sin(now / 32) * (2.4 + t * 4.5);
    this.setAngle(-facing * (7 + t * 11) + tremble);
    this.setScale(0.9 - t * 0.08, 1.1 + t * 0.14);
    this.fitPhysicsToScale();
    const flash = Math.sin(now / (72 - t * 42));
    this.setTint(flash > 0 ? 0xfff3c4 : 0xff6a3a);
    this.updateCharge(now, facing, t);
  }

  private releaseShot(player: Phaser.Physics.Arcade.Sprite, projectiles: Phaser.Physics.Arcade.Group): void {
    this.windingUp = false;
    this.setAngle(0);
    this.setScale(1);
    this.fitPhysicsToScale();
    const muzzleX = this.charge?.x ?? this.muzzleX(player.x > this.x ? 1 : -1);
    const muzzleY = this.charge?.y ?? this.muzzleY();
    this.clearCharge();
    this.restoreRestTint(this.scene.time.now);
    this.fireAt(player, projectiles, muzzleX, muzzleY);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.18,
      scaleY: 0.82,
      duration: 90,
      yoyo: true,
      onUpdate: () => this.fitPhysicsToScale(),
      onComplete: () => this.fitPhysicsToScale(),
    });
  }

  private cancelWindup(): void {
    this.windingUp = false;
    this.setAngle(0);
    this.setScale(1);
    this.fitPhysicsToScale();
    this.clearCharge();
    this.restoreRestTint(this.scene.time.now);
  }

  private restoreRestTint(now: number): void {
    if (now < this.vulnerableUntil) {
      this.setTint(0xffef9d);
      return;
    }
    this.clearTint();
  }

  private muzzleX(facing: number): number {
    return this.x + facing * Math.max(28, this.width * 0.45);
  }

  private muzzleY(): number {
    return this.y - 10;
  }

  private ensureCharge(facing: number): void {
    if (this.charge?.active) {
      return;
    }
    this.charge = this.scene.add.sprite(this.muzzleX(facing), this.muzzleY(), `projectile-${this.kind}`);
    this.charge.setDepth(16);
    this.charge.setScale(0.22);
    this.charge.setAlpha(0.4);
  }

  private updateCharge(now: number, facing: number, t: number): void {
    this.ensureCharge(facing);
    const charge = this.charge;
    if (!charge) {
      return;
    }
    charge.setPosition(this.muzzleX(facing), this.muzzleY());
    charge.setFlipX(facing < 0);
    const pulse = 0.22 + t * 0.78 + Math.sin(now / 40) * 0.06;
    charge.setScale(pulse);
    charge.setAlpha(0.4 + t * 0.6);
    charge.setAngle(charge.angle + 9 + t * 8);
    if (t > 0.72 && Math.sin(now / 28) > 0) {
      charge.setTint(0xffffff);
    } else {
      charge.clearTint();
    }
  }

  private clearCharge(): void {
    this.charge?.destroy();
    this.charge = undefined;
  }

  private fireAt(
    player: Phaser.Physics.Arcade.Sprite,
    projectiles: Phaser.Physics.Arcade.Group,
    originX: number,
    originY: number,
  ): void {
    const style = projectileStyleForKind(this.kind);
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const heading = Math.atan2(dy, dx);
    const speed = projectileFlightSpeed(style, false);
    const offsets = style === 'bubble' ? bubbleSpreadOffsets() : [0];
    for (const offset of offsets) {
      const angle = heading + offset;
      const shot = new EnemyProjectile(
        this.scene,
        originX,
        originY,
        `projectile-${this.kind}`,
        this.kind,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        false,
        this,
        player,
      );
      projectiles.add(shot);
      shot.launch();
    }
    audio.play(this.scene, 'enemy-shot');
    this.present('attack');
  }

  private squash(): void {
    if (this.dying) {
      return;
    }
    this.dying = true;
    this.arcadeBody.enable = false;
    this.scene.tweens.killTweensOf(this);
    this.cancelWindup();
    this.present('dead');
    this.clearTint();
    this.scene.tweens.add({
      targets: this,
      scaleY: 0.12,
      scaleX: 1.2,
      alpha: 0,
      duration: 180,
      onComplete: () => this.destroy(),
    });
  }

  private present(pose: EnemyPose): void {
    if (!this.active || (this.dying && pose !== 'dead')) {
      return;
    }
    const texture = enemyTextureKey(this.kind, pose);
    if (this.texture.key === texture) {
      return;
    }
    this.setTexture(texture);
  }

  /** Keep the world hitbox stable when the sprite squashes for windup. */
  private fitPhysicsToScale(): void {
    if (this.dying) {
      return;
    }
    const sx = Math.max(0.05, Math.abs(this.scaleX));
    const sy = Math.max(0.05, Math.abs(this.scaleY));
    this.arcadeBody.setSize(this.hitW / sx, this.hitH / sy);
  }

  private patrol(solids: Phaser.Physics.Arcade.StaticGroup, oneways?: Phaser.Physics.Arcade.StaticGroup): void {
    const body = this.arcadeBody;
    if (body.blocked.left) {
      this.dir = 1;
    } else if (body.blocked.right) {
      this.dir = -1;
    }

    const probeX = this.x + this.dir * (body.width * 0.5 + 6);
    const probeY = this.y + body.height * 0.5 + 10;
    const groups = oneways ? [solids, oneways] : [solids];
    let groundAhead = false;
    for (const group of groups) {
      for (const child of group.getChildren()) {
        const sprite = child as Phaser.Physics.Arcade.Sprite;
        const solid = sprite.body as Phaser.Physics.Arcade.StaticBody | undefined;
        if (!solid) {
          continue;
        }
        if (probeX >= solid.left && probeX <= solid.right && probeY >= solid.top - 2 && probeY <= solid.bottom + 8) {
          groundAhead = true;
          break;
        }
      }
      if (groundAhead) {
        break;
      }
    }
    if (body.blocked.down && !groundAhead) {
      this.dir *= -1;
    }
    this.setVelocityX(this.dir * this.speed);
    this.setFlipX(this.dir > 0);
  }
}
