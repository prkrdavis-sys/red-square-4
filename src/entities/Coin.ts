import Phaser from 'phaser';
import { coinHoverY } from '../systems/coin-magnet';

const RAY_SPIN_MS = 2400;
const RAY_SCALE = 0.9;
const RISE_MS = 320;
const BOB_AMPLITUDE = 8;
const BOB_PERIOD = 280;

export class Coin extends Phaser.Physics.Arcade.Sprite {
  private readonly rays: Phaser.GameObjects.Image;
  private readonly spawnY: number;
  private readonly hoverY: number;
  private readonly spawnedAt: number;
  private rising = true;
  private bobbing = false;
  private bobBaseY = 0;
  private bobStart = 0;
  private collecting = false;
  private magnet: { x: number; y: number } | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'coin');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocity(0, 0);
    body.setSize(22, 22);
    body.setOffset(5, 5);

    this.spawnY = y;
    this.hoverY = coinHoverY(y);
    this.spawnedAt = scene.time.now;

    this.setDepth(16);
    this.setScale(0.92);

    this.rays = scene.add.image(x, y, 'coin-rays');
    this.rays.setDepth(15);
    this.rays.setBlendMode(Phaser.BlendModes.ADD);
    this.rays.setScale(RAY_SCALE);
    this.once('destroy', () => this.rays.destroy());
  }

  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  get isCollecting(): boolean {
    return this.collecting;
  }

  /** Apply this frame's magnet velocity. A zero vector releases the coin back to its hover. */
  setMagnet(velocity: { x: number; y: number }): void {
    if (this.collecting) {
      return;
    }
    const pulling = velocity.x !== 0 || velocity.y !== 0;
    this.magnet = pulling ? velocity : null;
    if (pulling) {
      this.rising = false;
      this.bobbing = false;
      this.arcadeBody.setVelocity(velocity.x, velocity.y);
      return;
    }
    this.arcadeBody.setVelocity(0, 0);
  }

  beginCollect(): void {
    if (this.collecting) {
      return;
    }
    this.collecting = true;
    this.magnet = null;
    this.arcadeBody.setVelocity(0, 0);
    this.arcadeBody.enable = false;
  }

  fadeTargets(): Phaser.GameObjects.GameObject[] {
    return [this, this.rays];
  }

  protected preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    this.rays.setPosition(this.x, this.y);
    this.rays.setAlpha(this.alpha * 0.95);
    this.rays.angle += delta * (360 / RAY_SPIN_MS);
    if (!this.collecting) {
      const pulse = 1 + Math.sin(time / 220) * 0.1;
      this.rays.setScale(RAY_SCALE * pulse);
    }
    if (this.collecting || this.magnet) {
      return;
    }

    this.arcadeBody.setVelocity(0, 0);
    if (this.rising) {
      const progress = Phaser.Math.Clamp((time - this.spawnedAt) / RISE_MS, 0, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      this.y = Phaser.Math.Linear(this.spawnY, this.hoverY, eased);
      if (progress >= 1) {
        this.startBob(time, this.hoverY);
      }
      return;
    }
    if (!this.bobbing) {
      this.startBob(time, this.y);
    }
    this.y = this.bobBaseY + Math.sin((time - this.bobStart) / BOB_PERIOD) * BOB_AMPLITUDE;
  }

  private startBob(time: number, baseY: number): void {
    this.rising = false;
    this.bobbing = true;
    this.bobBaseY = baseY;
    this.bobStart = time;
  }
}
