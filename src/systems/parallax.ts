import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, themeSky, type Theme } from '../config';
import { hillKey, mountainKey } from './textures';

interface ParallaxLayer {
  image: Phaser.GameObjects.TileSprite;
  factor: number;
}

export class Parallax {
  private readonly layers: ParallaxLayer[] = [];

  constructor(scene: Phaser.Scene, theme: Theme, worldWidth: number) {
    const sky = scene.add.rectangle(0, 0, worldWidth, GAME_HEIGHT, themeSky(theme)).setOrigin(0, 0);
    sky.setScrollFactor(0);
    sky.setDepth(-40);

    const far = scene.add
      .tileSprite(0, 80, GAME_WIDTH, 220, mountainKey(theme))
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-30);
    const mid = scene.add
      .tileSprite(0, GAME_HEIGHT - 220, GAME_WIDTH, 160, hillKey(theme))
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-20);
    const near = scene.add
      .tileSprite(0, 40, GAME_WIDTH, 120, 'cloud')
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-10)
      .setAlpha(theme === 'castle' ? 0.18 : theme === 'ocean' ? 0.35 : 0.85);

    if (theme === 'castle') {
      far.setTint(0x3a2048);
      mid.setTint(0x1a1018);
      near.setTint(0x886688);
    } else if (theme === 'ocean') {
      far.setTint(0x1a4a66);
      mid.setTint(0x0e3a4a);
      near.setTint(0xaadfff);
    }

    this.layers.push({ image: far, factor: 0.15 }, { image: mid, factor: 0.35 }, { image: near, factor: 0.6 });
  }

  update(scrollX: number): void {
    for (const layer of this.layers) {
      layer.image.tilePositionX = scrollX * layer.factor;
    }
  }
}
