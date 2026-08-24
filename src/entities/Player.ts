import Phaser from 'phaser';
import { STOMP_BOUNCE_VELOCITY, type Theme, themePhysics } from '../config';
import { maybeShake } from '../data/settings';
import { audio } from '../systems/audio';
import { DEATH_BLAST_MS, spawnDeathBlast } from '../systems/explosion';
import { heldShieldPosition } from './held-shield';

export interface PlayerInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpJust: boolean;
  down: boolean;
  downJust: boolean;
  special: boolean;
  specialJust: boolean;
}

type HeroFrame =
  | 'player'
  | 'player-blink'
  | 'player-run-a'
  | 'player-run-b'
  | 'player-jump'
  | 'player-fall'
  | 'player-dead';

export class Player extends Phaser.Physics.Arcade.Sprite {
  coyoteUntil = 0;
  jumpBufferUntil = 0;
  droppingUntil = 0;
  invulnerableUntil = 0;
  shielded = false;
  frozen = false;
  jumpLocked = false;
  private swinging = false;
  private jumpHeld = false;
  private wasGrounded = true;
  private visualLockUntil = 0;
  private blinkUntil = 0;
  private nextBlinkAt = 0;
  private squashTween?: Phaser.Tweens.Tween;
  private readonly view: Phaser.GameObjects.Image;
  private readonly heldShield: Phaser.GameObjects.Image;
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
    body.setCollideWorldBounds(true);
    this.setVisible(false);
    this.setDepth(20);
    this.nextBlinkAt = scene.time.now + 1400;

    this.view = scene.add.image(x, y, 'player');
    this.view.setDepth(20);
    this.heldShield = scene.add.image(x, y, 'player-shield');
    this.heldShield.setDepth(21);
    this.heldShield.setVisible(false);
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
      this.view.destroy();
      this.heldShield.destroy();
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

  grantSafety(duration: number): void {
    this.invulnerableUntil = Math.max(this.invulnerableUntil, this.scene.time.now + duration);
  }

  flashTint(color: number, duration: number): void {
    this.view.setTint(color);
    this.scene.time.delayedCall(duration, () => {
      if (this.shielded) {
        this.view.setTint(0x8deaff);
        return;
      }
      this.view.clearTint();
    });
  }

  burstSpeed(speed: number, duration: number): void {
    const body = this.arcadeBody;
    const previousMax = body.maxVelocity.x;
    body.setMaxVelocity(Math.max(previousMax, speed), 1400);
    this.scene.time.delayedCall(duration, () => {
      body.setMaxVelocity(previousMax, 1400);
    });
  }

  giveShield(): void {
    this.shielded = true;
    this.view.setTint(0x8deaff);
    this.scene.tweens.killTweensOf(this.heldShield);
    this.heldShield.setVisible(true);
    this.heldShield.setAlpha(1);
    this.heldShield.setScale(0.62);
    this.scene.tweens.add({
      targets: this.heldShield,
      scale: 1,
      duration: 160,
      ease: 'Back.easeOut',
    });
    this.syncHeldShield();
  }

  consumeShield(): boolean {
    if (!this.shielded) {
      return false;
    }
    this.shielded = false;
    this.grantSafety(1200);
    this.view.clearTint();
    this.scene.tweens.killTweensOf(this.heldShield);
    this.scene.tweens.add({
      targets: this.heldShield,
      scale: 1.45,
      alpha: 0,
      duration: 180,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (!this.heldShield.active) {
          return;
        }
        this.heldShield.setVisible(false);
        this.heldShield.setScale(1);
        this.heldShield.setAlpha(1);
      },
    });
    this.scene.tweens.add({
      targets: this.view,
      alpha: 0.35,
      yoyo: true,
      repeat: 5,
      duration: 65,
      onComplete: () => this.view.setAlpha(1),
    });
    return true;
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
    this.arcadeBody.setVelocityY(STOMP_BOUNCE_VELOCITY);
    this.squash(0.88, 1.16, 90);
  }

  bossBounce(bossX: number, safeX: number): void {
    const away = Math.sign(safeX - bossX) || Math.sign(this.x - bossX) || 1;
    this.setX(Phaser.Math.Clamp(this.x + away * 18, 24, this.scene.physics.world.bounds.width - 24));
    this.arcadeBody.setVelocity(away * 360, STOMP_BOUNCE_VELOCITY);
    this.grantSafety(720);
    this.squash(0.82, 1.22, 110);
  }

  freeze(): void {
    this.frozen = true;
    this.swinging = false;
    this.arcadeBody.checkCollision.none = false;
    this.arcadeBody.setVelocity(0, 0);
    this.arcadeBody.allowGravity = false;
    this.squashTween?.stop();
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.killTweensOf(this.view);
    this.setTexture('player');
    this.setAngle(0);
    this.setScale(1);
    this.setAlpha(1);
    this.view.setTexture('player');
    this.view.setAngle(0);
    this.view.setScale(1);
    this.view.setAlpha(1);
    this.syncView();
  }

  die(onComplete: () => void): void {
    this.frozen = true;
    this.swinging = false;
    this.arcadeBody.checkCollision.none = false;
    this.arcadeBody.setVelocity(0, 0);
    this.arcadeBody.allowGravity = false;
    this.arcadeBody.enable = false;
    this.squashTween?.stop();
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.killTweensOf(this.view);

    const scene = this.scene;
    const cam = scene.cameras.main;
    const x = this.x;
    const y = Phaser.Math.Clamp(this.y, cam.worldView.y + 72, cam.worldView.bottom - 72);

    this.view.setTexture('player-dead');
    this.view.setPosition(x, y);
    this.view.setAngle(-22);
    this.view.setScale(1.22, 0.68);
    this.view.setVisible(true);
    this.view.clearTint();
    this.hideHeldShield();
    this.shadow.setVisible(false);
    this.dust.emitParticleAt(x, y + 18, 12);
    maybeShake(scene, 140, 0.01);
    this.popDeathStars(x, y);

    let finished = false;
    const finish = (): void => {
      if (finished) {
        return;
      }
      finished = true;
      onComplete();
    };

    scene.tweens.add({
      targets: this.view,
      x: x + 6,
      duration: 28,
      yoyo: true,
      repeat: 9,
      ease: 'Sine.easeInOut',
    });
    scene.tweens.add({
      targets: this.view,
      scaleX: 0.78,
      scaleY: 1.28,
      angle: 16,
      duration: 90,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });

    scene.time.delayedCall(260, () => {
      if (!this.view.active) {
        return;
      }
      this.view.setTintFill(0xffffff);
      scene.tweens.add({
        targets: this.view,
        scaleX: 2.15,
        scaleY: 2.15,
        angle: 0,
        duration: 180,
        ease: 'Back.easeIn',
      });
    });

    scene.time.delayedCall(460, () => {
      if (!this.view.active) {
        finish();
        return;
      }
      scene.tweens.killTweensOf(this.view);
      this.view.setVisible(false);
      audio.play(scene, 'explode');
      spawnDeathBlast(scene, x, y);
    });

    scene.time.delayedCall(460 + DEATH_BLAST_MS, finish);
  }

  private popDeathStars(x: number, y: number): void {
    const scene = this.scene;
    for (let i = 0; i < 5; i += 1) {
      const angle = -Math.PI * 0.85 + (Math.PI * 0.7 * i) / 4;
      const star = scene.add.image(x, y - 10, 'cartoon-star').setDepth(22).setScale(0.4);
      scene.tweens.add({
        targets: star,
        x: x + Math.cos(angle) * 54,
        y: y - 28 + Math.sin(angle) * 36,
        scale: 1.15,
        angle: 80 + i * 40,
        alpha: 0,
        duration: 340,
        ease: 'Cubic.easeOut',
        onComplete: () => star.destroy(),
      });
    }
  }

  applyTheme(theme: Theme): void {
    const physics = themePhysics(theme);
    this.arcadeBody.setMaxVelocity(physics.maxSpeed, 1400);
  }

  beginSwing(): void {
    this.swinging = true;
    this.arcadeBody.setVelocity(0, 0);
    this.arcadeBody.setAcceleration(0, 0);
    this.arcadeBody.allowGravity = false;
    this.arcadeBody.checkCollision.none = true;
    this.view.setTexture('player-jump');
  }

  poseOnVine(lean: number): void {
    this.view.setTexture('player-jump');
    this.view.setAngle(lean);
    this.syncView();
    this.shadow.setPosition(this.x, this.y + 22);
    this.shadow.setAlpha(0.16);
  }

  endSwing(vx: number, vy: number): void {
    this.swinging = false;
    this.arcadeBody.checkCollision.none = false;
    if (!this.active || this.frozen) {
      return;
    }
    this.arcadeBody.allowGravity = true;
    this.arcadeBody.setVelocity(vx, vy);
    this.view.setAngle(this.flipX ? -8 : 8);
  }

  tick(input: PlayerInput, theme: Theme): void {
    if (this.frozen) {
      this.syncView();
      this.shadow.setPosition(this.x, this.y + 22);
      this.shadow.setAlpha(0.22);
      return;
    }

    if (this.swinging) {
      this.arcadeBody.setVelocity(0, 0);
      this.arcadeBody.setAcceleration(0, 0);
      this.syncView();
      this.shadow.setPosition(this.x, this.y + 22);
      this.shadow.setAlpha(0.16);
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

    const canJump = !this.jumpLocked && (grounded || now < this.coyoteUntil);
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
      this.droppingUntil = now + 280;
      body.setVelocityY(Math.max(body.velocity.y, 240));
    }

    if (theme === 'ocean' && !this.jumpLocked && input.jump && !grounded && body.velocity.y > 40) {
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
      targets: this.view,
      scaleX,
      scaleY,
      duration: duration * 0.45,
      yoyo: true,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.view.setScale(1);
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
    this.view.setTexture(frame);

    if (!this.frozen && now >= this.visualLockUntil) {
      if (running) {
        const bob = Math.sin(now / 62);
        this.view.setScale(1 + bob * 0.05, 1 - bob * 0.07);
        this.view.setAngle(facing * 5);
      } else if (!grounded) {
        const stretch = Phaser.Math.Clamp(Math.abs(vy) / 900, 0, 0.12);
        this.view.setScale(1 - stretch, 1 + stretch);
        this.view.setAngle(facing * 5);
      } else {
        const breathe = Math.sin(now / 260);
        this.view.setScale(1 + breathe * 0.025, 1 - breathe * 0.02);
        this.view.setAngle(0);
      }
    }

    this.syncView();
    const planted = grounded ? 0.34 : 0.16;
    this.shadow.setPosition(this.x, this.y + 22);
    this.shadow.setScale(this.view.scaleX * 1.05, 1);
    this.shadow.setAlpha(planted);
    this.shadow.setVisible(this.view.visible);
  }

  private syncView(): void {
    this.view.setPosition(this.x, this.y);
    this.view.setFlipX(this.flipX);
    this.view.setAlpha(this.alpha);
    this.view.setVisible(true);
    this.syncHeldShield();
  }

  private syncHeldShield(): void {
    const hold = heldShieldPosition(this.x, this.y, this.flipX);
    this.heldShield.setPosition(hold.x, hold.y);
    this.heldShield.setFlipX(this.flipX);
    if (!this.shielded || !this.heldShield.visible || this.scene.tweens.isTweening(this.heldShield)) {
      return;
    }
    const wave = 0.5 + 0.5 * Math.sin(this.scene.time.now / 150);
    this.heldShield.setScale(0.94 + wave * 0.08);
  }

  private hideHeldShield(): void {
    this.scene.tweens.killTweensOf(this.heldShield);
    this.heldShield.setVisible(false);
    this.heldShield.setScale(1);
    this.heldShield.setAlpha(1);
  }
}
