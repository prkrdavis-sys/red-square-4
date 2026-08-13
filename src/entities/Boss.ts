import Phaser from 'phaser';
import { type BossKind } from '../config';
import { maybeShake } from '../data/settings';
import { bossTextureKey } from '../systems/textures';

export class Boss extends Phaser.Physics.Arcade.Sprite {
  kind: BossKind;
  hp: number;
  maxHp: number;
  dying = false;
  invulnUntil = 0;
  private hopUntil = 0;
  private slamPhase: 'idle' | 'up' | 'down' = 'idle';
  private chargeDir = -1;
  private spawnY: number;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: BossKind, hp: number) {
    super(scene, x, y, hp === 1 ? 'mini-boss' : bossTextureKey(kind));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.kind = kind;
    this.hp = hp;
    this.maxHp = hp;
    this.spawnY = y;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setBounce(0.05, 0);
    body.setCollideWorldBounds(true);
    body.setMaxVelocity(360, 1400);
    this.setDepth(16);
    if (hp === 1) {
      this.setScale(1.15);
    }
  }

  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  get isInvulnerable(): boolean {
    return this.scene.time.now < this.invulnUntil;
  }

  takeStomp(): 'hit' | 'dead' | 'ignored' {
    if (this.dying || this.isInvulnerable) {
      return 'ignored';
    }
    this.hp -= 1;
    this.invulnUntil = this.scene.time.now + 650;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => this.clearTint());
    if (this.hp <= 0) {
      return 'dead';
    }
    this.scene.tweens.add({
      targets: this,
      scaleX: this.scaleX * 1.12,
      scaleY: this.scaleY * 0.86,
      yoyo: true,
      duration: 90,
    });
    return 'hit';
  }

  poofAway(onDone: () => void): void {
    this.dying = true;
    this.arcadeBody.enable = false;
    const particles = this.scene.add.particles(this.x, this.y, 'poof-particle', {
      speed: { min: 40, max: 220 },
      scale: { start: 1.4, end: 0 },
      lifespan: 520,
      quantity: 28,
      emitting: false,
    });
    particles.explode(32);
    this.scene.tweens.add({
      targets: this,
      scale: 0,
      alpha: 0,
      angle: 40,
      duration: 280,
      ease: 'Back.easeIn',
      onComplete: () => {
        this.destroy();
        this.scene.time.delayedCall(200, () => {
          particles.destroy();
          onDone();
        });
      },
    });
  }

  chase(player: Phaser.Physics.Arcade.Sprite, solids: Phaser.Physics.Arcade.StaticGroup): void {
    if (this.dying) {
      return;
    }
    const body = this.arcadeBody;
    const now = this.scene.time.now;
    const dx = player.x - this.x;
    const dir = Math.sign(dx) || -1;

    switch (this.kind) {
      case 'hopper': {
        body.setVelocityX(Phaser.Math.Clamp(dir * 90 + Math.sin(now / 180) * 20, -140, 140));
        if (body.blocked.down && now > this.hopUntil) {
          body.setVelocityY(-420);
          this.hopUntil = now + 900;
        }
        break;
      }
      case 'slider': {
        body.setAccelerationX(dir * 420);
        body.setDragX(40);
        if (body.blocked.left || body.blocked.right) {
          body.setVelocityX(-dir * 220);
        }
        break;
      }
      case 'slam': {
        body.setVelocityX(dir * 55);
        if (this.slamPhase === 'idle' && now > this.hopUntil) {
          this.slamPhase = 'up';
          body.setVelocityY(-560);
        } else if (this.slamPhase === 'up' && body.velocity.y > 0) {
          this.slamPhase = 'down';
          body.setVelocityY(680);
        } else if (this.slamPhase === 'down' && body.blocked.down) {
          this.slamPhase = 'idle';
          this.hopUntil = now + 700;
          maybeShake(this.scene, 80, 0.004);
        }
        break;
      }
      case 'swimmer': {
        body.allowGravity = false;
        const targetY = this.spawnY + Math.sin(now / 280) * 70;
        body.setVelocityX(dir * 110);
        body.setVelocityY((targetY - this.y) * 2.4);
        break;
      }
      case 'charger': {
        if (now > this.hopUntil) {
          this.chargeDir = dir;
          this.hopUntil = now + 1400;
          body.setVelocityX(this.chargeDir * 280);
        }
        if (body.blocked.left || body.blocked.right) {
          this.chargeDir *= -1;
          body.setVelocityX(this.chargeDir * 240);
        }
        if (body.blocked.down && Math.abs(dx) < 70 && now % 1600 < 30) {
          body.setVelocityY(-380);
        }
        break;
      }
      default: {
        const neverKind: never = this.kind;
        return neverKind;
      }
    }

    void solids;
    this.setFlipX(dx > 0);
  }
}
