import Phaser from 'phaser';

export class Baddie extends Phaser.Physics.Arcade.Sprite {
  speed: number;
  dir = -1;
  dying = false;

  constructor(scene: Phaser.Scene, x: number, y: number, texture = 'baddie', speed = 70) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.speed = speed;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.width * 0.78, this.height * 0.78);
    body.setBounce(0, 0);
    this.setDepth(15);
  }

  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  squash(): void {
    if (this.dying) {
      return;
    }
    this.dying = true;
    this.arcadeBody.enable = false;
    this.scene.tweens.add({
      targets: this,
      scaleY: 0.12,
      scaleX: 1.2,
      alpha: 0,
      duration: 140,
      onComplete: () => this.destroy(),
    });
  }

  patrol(solids: Phaser.Physics.Arcade.StaticGroup, oneways?: Phaser.Physics.Arcade.StaticGroup): void {
    if (this.dying) {
      return;
    }
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
