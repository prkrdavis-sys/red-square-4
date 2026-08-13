import Phaser from 'phaser';
import { type Theme, themePhysics } from '../config';
import { audio } from '../systems/audio';

export interface PlayerInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpJust: boolean;
  down: boolean;
  downJust: boolean;
}

type HeroFrame = 'player' | 'player-blink' | 'player-run-a' | 'player-run-b' | 'player-jump' | 'player-fall';

export class Player extends Phaser.Physics.Arcade.Sprite {
  coyoteUntil = 0;
  jumpBufferUntil = 0;
  droppingUntil = 0;
  invulnerableUntil = 0;
  frozen = false;
  private jumpHeld = false;
  private wasGrounded = true;
  private visualLockUntil = 0;
  private blinkUntil = 0;
  private nextBlinkAt = 0;
  private squashTween?: Phaser.Tweens.Tween;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly dust: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(34, 36);
    body.setOffset(7, 8);
    body.setMaxVelocity(340, 1400);
    body.setCollideWorldBounds(false);
    this.setDepth(20);
    this.nextBlinkAt = scene.time.now + 1400;

    this.shadow = scene.add.ellipse(x, y + 22, 34, 12, 0x120408, 0.32);
    this.shadow.setDepth(19);
    this.dust = scene.add.particles(0, 0, 'poof-particle', {
      speed: { min: 20, max: 90 },
      scale: { start: 0.45, end: 0 },
      lifespan: 280,
      emitting: false,
      tint: 0xe8c8b0,
      gravityY: 240,
    });
    this.dust.setDepth(19);
    this.once('destroy', () => {
      this.shadow.destroy();
      this.dust.destroy();
    });
  }

  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  get isDropping(): boolean {
    return this.scene.time.now < this.droppingUntil;
  }

  canBeHurt(): boolean {
    return !this.frozen && this.scene.time.now >= this.invulnerableUntil;
  }

  flashHurt(): void {
    this.invulnerableUntil = this.scene.time.now + 1200;
    this.scene.tweens.add({
      targets: this,
      alpha: 0.25,
      yoyo: true,
      repeat: 7,
      duration: 70,
      onComplete: () => this.setAlpha(1),
    });
  }

  bounce(): void {
    this.arcadeBody.setVelocityY(-420);
    this.squash(0.88, 1.16, 90);
  }

  freeze(): void {
    this.frozen = true;
    this.arcadeBody.setVelocity(0, 0);
    this.arcadeBody.allowGravity = false;
    this.squashTween?.stop();
    this.scene.tweens.killTweensOf(this);
    this.setTexture('player');
    this.setAngle(0);
    this.setScale(1);
    this.setAlpha(1);
  }

  applyTheme(theme: Theme): void {
    const physics = themePhysics(theme);
    this.arcadeBody.setMaxVelocity(physics.maxSpeed, 1400);
  }

  tick(input: PlayerInput, theme: Theme): void {
    if (this.frozen) {
      this.shadow.setPosition(this.x, this.y + 22);
      this.shadow.setAlpha(0.22);
      return;
    }

    const physics = themePhysics(theme);
    const body = this.arcadeBody;
    this.scene.physics.world.gravity.y = physics.gravity;

    const grounded = body.blocked.down || body.touching.down;
    const now = this.scene.time.now;

    if (grounded) {
      this.coyoteUntil = now + 90;
    }

    if (input.jumpJust) {
      this.jumpBufferUntil = now + 110;
    }

    let accel = 0;
    if (input.left) {
      accel = -physics.accel;
      this.setFlipX(true);
    } else if (input.right) {
      accel = physics.accel;
      this.setFlipX(false);
    }
    body.setAccelerationX(accel);

    if (grounded && accel === 0) {
      body.setDragX(physics.groundDrag);
    } else {
      body.setDragX(40);
    }

    const canJump = grounded || now < this.coyoteUntil;
    if (canJump && now < this.jumpBufferUntil) {
      body.setVelocityY(physics.jump);
      this.jumpBufferUntil = 0;
      this.coyoteUntil = 0;
      this.jumpHeld = true;
      audio.play(this.scene, 'jump');
      this.squash(0.86, 1.18, 100);
    }

    if (!input.jump) {
      if (this.jumpHeld && body.velocity.y < -160) {
        body.setVelocityY(body.velocity.y * 0.48);
      }
      this.jumpHeld = false;
    }

    if (input.downJust && grounded) {
      this.droppingUntil = now + 220;
      body.setVelocityY(Math.max(body.velocity.y, 180));
    }

    if (theme === 'ocean' && input.jump && !grounded && body.velocity.y > 40) {
      body.setVelocityY(body.velocity.y * 0.82);
    }

    if (grounded && !this.wasGrounded) {
      this.squash(1.2, 0.78, 110);
      this.dust.emitParticleAt(this.x, this.y + 20, 6);
    }
    this.wasGrounded = grounded;
    this.present(grounded, body.velocity.x, body.velocity.y);
  }

  private squash(scaleX: number, scaleY: number, duration: number): void {
    this.visualLockUntil = this.scene.time.now + duration + 20;
    this.squashTween?.stop();
    this.squashTween = this.scene.tweens.add({
      targets: this,
      scaleX,
      scaleY,
      duration: duration * 0.45,
      yoyo: true,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.setScale(1);
        this.squashTween = undefined;
      },
    });
  }

  private present(grounded: boolean, vx: number, vy: number): void {
    const now = this.scene.time.now;
    const running = grounded && Math.abs(vx) > 50;
    const facing = this.flipX ? -1 : 1;

    if (grounded && !running && !this.frozen && now >= this.nextBlinkAt) {
      this.blinkUntil = now + 90;
      this.nextBlinkAt = now + 1800 + Math.floor(Math.random() * 2200);
    }

    let frame: HeroFrame = 'player';
    if (now < this.blinkUntil) {
      frame = 'player-blink';
    } else if (vy < -90) {
      frame = 'player-jump';
    } else if (!grounded) {
      frame = 'player-fall';
    } else if (running) {
      frame = Math.floor(now / 90) % 2 === 0 ? 'player-run-a' : 'player-run-b';
    }
    if (this.texture.key !== frame) {
      this.setTexture(frame);
      this.arcadeBody.setSize(34, 36);
      this.arcadeBody.setOffset(7, 8);
    }

    if (!this.frozen && now >= this.visualLockUntil) {
      if (running) {
        const bob = Math.sin(now / 62);
        this.setScale(1 + bob * 0.05, 1 - bob * 0.07);
        this.setAngle(facing * 8);
      } else if (!grounded) {
        const stretch = Phaser.Math.Clamp(Math.abs(vy) / 900, 0, 0.12);
        this.setScale(1 - stretch, 1 + stretch);
        this.setAngle(facing * 5);
      } else {
        const breathe = Math.sin(now / 260);
        this.setScale(1 + breathe * 0.025, 1 - breathe * 0.02);
        this.setAngle(0);
      }
    }

    const planted = grounded ? 0.34 : 0.16;
    this.shadow.setPosition(this.x, this.y + 22);
    this.shadow.setScale(this.scaleX * 1.05, 1);
    this.shadow.setAlpha(planted);
    this.shadow.setVisible(this.visible);
  }
}
