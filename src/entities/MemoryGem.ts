import Phaser from 'phaser';

const RAY_SPIN_MS = 9000;
const GEM_SCALE = 0.48;

export class MemoryGem extends Phaser.Physics.Arcade.Sprite {
  private readonly rays: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'memory-gem');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(50, 54);
    body.setOffset(11, 13);

    this.setDepth(15);
    this.setScale(GEM_SCALE);

    this.rays = scene.add.image(x, y, 'memory-rays');
    this.rays.setDepth(14);
    this.rays.setBlendMode(Phaser.BlendModes.ADD);
    this.rays.setScale(GEM_SCALE);

    this.once('destroy', () => this.rays.destroy());
  }

  protected preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    const pulse = 1 + Math.sin(time / 260) * 0.08;
    this.rays.setPosition(this.x, this.y);
    this.rays.setAlpha(this.alpha * 0.9);
    this.rays.setScale(this.scaleX * pulse);
    this.rays.angle += delta * (360 / RAY_SPIN_MS);
  }
}
