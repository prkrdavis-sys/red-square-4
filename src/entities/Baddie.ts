import Phaser from 'phaser';
import { enemyRole, type EnemyKind, type EnemyRole } from '../config';
import { audio } from '../systems/audio';
import { enemyTextureKey } from '../systems/characters';
import { EnemyProjectile } from './EnemyProjectile';

type EnemyPose = 'idle' | 'move' | 'attack' | 'hurt' | 'dead';

export class Baddie extends Phaser.Physics.Arcade.Sprite {
  readonly kind: EnemyKind;
  readonly role: EnemyRole;
  speed: number;
  dir = -1;
  dying = false;
  private nextAttackAt = 0;
  private nextMoveAt = 0;
  private vulnerableUntil = 0;
  private readonly baseY: number;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: EnemyKind, speed = 70) {
    super(scene, x, y, enemyTextureKey(kind, 'idle'));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.kind = kind;
    this.role = enemyRole(kind);
    this.speed = speed;
    this.baseY = y;
    this.nextAttackAt = scene.time.now + 900 + Math.floor(Math.random() * 600);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(Math.max(24, this.width * 0.68), Math.max(24, this.height * 0.7));
    body.setBounce(0, 0);
    this.setDepth(15);
  }

  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  exposeBySpecial(duration = 1600): void {
    this.vulnerableUntil = this.scene.time.now + duration;
    this.setTint(0xffef9d);
  }

  tryStomp(): 'defeated' | 'armored' {
    if (this.role === 'terrain' && this.scene.time.now >= this.vulnerableUntil) {
      this.present('hurt');
      this.scene.time.delayedCall(180, () => this.present('idle'));
      return 'armored';
    }
    this.squash();
    return 'defeated';
  }

  tick(
    player: Phaser.Physics.Arcade.Sprite,
    solids: Phaser.Physics.Arcade.StaticGroup,
    oneways: Phaser.Physics.Arcade.StaticGroup,
    projectiles: Phaser.Physics.Arcade.Group,
  ): void {
    if (this.dying) {
      return;
    }
    if (this.scene.time.now >= this.vulnerableUntil) {
      this.clearTint();
    }
    switch (this.role) {
      case 'movement':
        this.tickMovement(player, solids, oneways);
        break;
      case 'ranged':
        this.tickRanged(player, solids, oneways, projectiles);
        break;
      case 'terrain':
        this.tickTerrain(player, solids, oneways, projectiles);
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
      (this.kind === 'bramble-hopper' || this.kind === 'dune-scarab' || this.kind === 'clockwork-hound') &&
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
    const distance = Math.abs(player.x - this.x);
    if (distance > 300) {
      this.patrol(solids, oneways);
    } else {
      this.arcadeBody.setVelocityX(0);
      this.setFlipX(player.x > this.x);
    }
    if (distance < 620 && this.scene.time.now >= this.nextAttackAt) {
      this.fireAt(player, projectiles, false);
      this.nextAttackAt = this.scene.time.now + 1500;
    } else {
      this.present(distance < 620 && this.nextAttackAt - this.scene.time.now < 360 ? 'attack' : 'idle');
    }
  }

  private tickTerrain(
    player: Phaser.Physics.Arcade.Sprite,
    solids: Phaser.Physics.Arcade.StaticGroup,
    oneways: Phaser.Physics.Arcade.StaticGroup,
    projectiles: Phaser.Physics.Arcade.Group,
  ): void {
    this.patrol(solids, oneways);
    const body = this.arcadeBody;
    const distance = Math.abs(player.x - this.x);
    if (distance < 420 && this.scene.time.now >= this.nextAttackAt) {
      this.fireAt(player, projectiles, true);
      if (body.blocked.down) {
        body.setVelocityY(-260);
      }
      this.nextAttackAt = this.scene.time.now + 1800;
    }
    if (this.kind === 'angler-eel') {
      body.allowGravity = false;
      this.y = this.baseY + Math.sin(this.scene.time.now / 260) * 38;
    }
    this.present(this.nextAttackAt - this.scene.time.now < 420 ? 'attack' : 'move');
  }

  private fireAt(
    player: Phaser.Physics.Arcade.Sprite,
    projectiles: Phaser.Physics.Arcade.Group,
    terrainShot: boolean,
  ): void {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const magnitude = Math.max(1, Math.hypot(dx, dy));
    const speed = terrainShot ? 190 : 240;
    const shot = new EnemyProjectile(
      this.scene,
      this.x + Math.sign(dx) * 20,
      this.y - 4,
      `projectile-${this.kind}`,
      this.kind,
      (dx / magnitude) * speed,
      terrainShot ? -220 : (dy / magnitude) * speed,
      terrainShot,
    );
    projectiles.add(shot);
    audio.play(this.scene, 'enemy-shot');
    this.present('attack');
    this.scene.time.delayedCall(220, () => this.present('idle'));
  }

  private squash(): void {
    if (this.dying) {
      return;
    }
    this.dying = true;
    this.arcadeBody.enable = false;
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
    this.setTexture(enemyTextureKey(this.kind, pose));
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
