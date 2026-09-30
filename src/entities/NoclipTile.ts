import Phaser from 'phaser';
import { GROUND_Y, TILE } from '../config';
import {
  NOCLIP_GLOW_KEY,
  NOCLIP_SHARD_KEY,
  NOCLIP_TILE_GLITCH_KEY,
  NOCLIP_TILE_KEY,
} from '../systems/backrooms-textures';

export class NoclipTile extends Phaser.GameObjects.Image {
  readonly tileX: number;
  private readonly glow: Phaser.GameObjects.Image;
  private glitchTimer?: Phaser.Time.TimerEvent;
  private triggered = false;

  constructor(scene: Phaser.Scene, tileX: number) {
    super(scene, tileX * TILE, GROUND_Y * TILE, NOCLIP_TILE_KEY);
    this.tileX = tileX;
    this.setOrigin(0, 0);
    this.setDepth(1);
    scene.add.existing(this);

    this.glow = scene.add
      .image(this.centerX, this.topY + 2, NOCLIP_GLOW_KEY)
      .setOrigin(0.5, 1)
      .setDepth(2)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.22);
    scene.tweens.add({
      targets: this.glow,
      alpha: 0.38,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.scheduleGlitch();
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.glitchTimer?.remove();
      this.glow.destroy();
    });
  }

  get centerX(): number {
    return this.tileX * TILE + TILE / 2;
  }

  get topY(): number {
    return GROUND_Y * TILE;
  }

  /** Violent tear when a player lands on it: flicker, shards, and a flare of light. */
  trigger(): void {
    if (this.triggered) {
      return;
    }
    this.triggered = true;
    this.glitchTimer?.remove();
    const scene = this.scene;
    let flips = 0;
    scene.time.addEvent({
      delay: 45,
      repeat: 14,
      callback: () => {
        flips += 1;
        this.setTexture(flips % 2 === 0 ? NOCLIP_TILE_KEY : NOCLIP_TILE_GLITCH_KEY);
        this.setX(this.tileX * TILE + Phaser.Math.Between(-4, 4));
      },
    });
    scene.tweens.killTweensOf(this.glow);
    scene.tweens.add({ targets: this.glow, alpha: 1, scaleX: 1.8, scaleY: 2.4, duration: 520, ease: 'Cubic.easeOut' });
    for (let i = 0; i < 14; i += 1) {
      const shard = scene.add
        .image(this.centerX + Phaser.Math.Between(-26, 26), this.topY + Phaser.Math.Between(0, 10), NOCLIP_SHARD_KEY)
        .setDepth(22)
        .setAngle(Phaser.Math.Between(0, 90));
      scene.tweens.add({
        targets: shard,
        y: shard.y - Phaser.Math.Between(30, 90),
        x: shard.x + Phaser.Math.Between(-30, 30),
        angle: shard.angle + Phaser.Math.Between(-180, 180),
        alpha: 0,
        duration: Phaser.Math.Between(420, 760),
        ease: 'Cubic.easeOut',
        onComplete: () => shard.destroy(),
      });
    }
  }

  private scheduleGlitch(): void {
    this.glitchTimer = this.scene.time.delayedCall(Phaser.Math.Between(1400, 3400), () => {
      if (!this.active || this.triggered) {
        return;
      }
      this.setTexture(NOCLIP_TILE_GLITCH_KEY);
      this.setX(this.tileX * TILE + Phaser.Math.Between(-2, 2));
      this.scene.time.delayedCall(Phaser.Math.Between(50, 120), () => {
        if (!this.active || this.triggered) {
          return;
        }
        this.setTexture(NOCLIP_TILE_KEY);
        this.setX(this.tileX * TILE);
        this.scheduleGlitch();
      });
    });
  }
}
