import Phaser from 'phaser';

const RAY_SPIN_MS = 9000;
const STAR_SCALE = 0.5;

export class Star extends Phaser.Physics.Arcade.Sprite {
  private readonly rays: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'star');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(48, 48);
    body.setOffset(12, 12);

    this.setDepth(15);
    this.setScale(STAR_SCALE);

    this.rays = scene.add.image(x, y, 'star-rays');
    this.rays.setDepth(14);
    this.rays.setBlendMode(Phaser.BlendModes.ADD);
    this.rays.setScale(STAR_SCALE);

    this.once('destroy', () => this.rays.destroy());
  }

  protected preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    const pulse = 1 + Math.sin(time / 260) * 0.08;
    this.rays.setPosition(this.x, this.y);
    this.rays.setAlpha(this.alpha * 0.9);
    this.rays.setScale(this.scaleX * pulse);
    this.rays.angle += delta * (360 / RAY_SPIN_MS);
    this.angle = Math.sin(time / 420) * 7;
  }
}
