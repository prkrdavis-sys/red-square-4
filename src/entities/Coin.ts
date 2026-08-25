import Phaser from 'phaser';

const RAY_SPIN_MS = 2400;

export class Coin extends Phaser.Physics.Arcade.Sprite {
  private readonly rays: Phaser.GameObjects.Image;
  private settled = false;
  private bobBaseY = 0;
  private collecting = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'coin');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(22, 22);
    body.setOffset(5, 5);
    body.setBounce(0.42, 0.42);
    body.setDrag(36, 0);
    body.setMaxVelocity(280, 720);
    body.setVelocity(Phaser.Math.Between(-90, 90), Phaser.Math.Between(-380, -300));

    this.setDepth(16);
    this.setScale(0.92);

    this.rays = scene.add.image(x, y, 'coin-rays');
    this.rays.setDepth(15);
    this.rays.setBlendMode(Phaser.BlendModes.ADD);
    this.rays.setScale(0.3);
    this.once('destroy', () => this.rays.destroy());
  }

  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  get isCollecting(): boolean {
    return this.collecting;
  }

  beginCollect(): void {
    if (this.collecting) {
      return;
    }
    this.collecting = true;
    this.arcadeBody.enable = false;
  }

  fadeTargets(): Phaser.GameObjects.GameObject[] {
    return [this, this.rays];
  }

  protected preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    const body = this.arcadeBody;
    if (!this.settled && !this.collecting && body.blocked.down && Math.abs(body.velocity.y) < 48) {
      this.settled = true;
      this.bobBaseY = this.y;
      body.setAllowGravity(false);
      body.setVelocity(0, 0);
      body.setImmovable(true);
      this.setAngle(0);
    }

    this.rays.setPosition(this.x, this.y);
    this.rays.setAlpha(this.alpha * 0.95);
    const pulse = 1 + Math.sin(time / 220) * 0.1;
    this.rays.setScale((this.collecting ? this.scaleX : 0.3) * pulse);
    this.rays.angle += delta * (360 / RAY_SPIN_MS);

    if (this.collecting) {
      return;
    }
    if (this.settled) {
      this.y = this.bobBaseY + Math.sin(time / 280) * 3;
      return;
    }
    this.angle += delta * 0.42;
  }
}
