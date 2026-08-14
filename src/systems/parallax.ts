import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, type Theme } from '../config';
import { cloudKey, farKey, hillKey, LANDSCAPE, mountainKey, skyKey } from './landscapes';

interface ParallaxLayer {
  image: Phaser.GameObjects.TileSprite;
  factor: number;
}

interface BackdropLayout {
  cloudY: number;
  farY: number;
  mountainY: number;
  groundY: number;
  cloudAlpha: number;
}

function layoutFor(theme: Theme): BackdropLayout {
  const groundY = GAME_HEIGHT - LANDSCAPE.groundH;
  switch (theme) {
    case 'grass':
      return { cloudY: 8, farY: 138, mountainY: 188, groundY, cloudAlpha: 0.94 };
    case 'snow':
      return { cloudY: 8, farY: 118, mountainY: 166, groundY, cloudAlpha: 0.82 };
    case 'desert':
      return { cloudY: 8, farY: 146, mountainY: 198, groundY, cloudAlpha: 0.6 };
    case 'ocean':
      return { cloudY: 8, farY: 122, mountainY: 158, groundY, cloudAlpha: 0.9 };
    case 'castle':
      return { cloudY: 12, farY: 140, mountainY: 190, groundY, cloudAlpha: 0.34 };
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

function addStrip(
  scene: Phaser.Scene,
  y: number,
  height: number,
  key: string,
  depth: number,
  alpha: number,
): Phaser.GameObjects.TileSprite {
  return scene.add
    .tileSprite(0, y, GAME_WIDTH, height, key)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(depth)
    .setAlpha(alpha);
}

function addSun(scene: Phaser.Scene, theme: Theme): void {
  switch (theme) {
    case 'grass':
      scene.add.circle(1020, 92, 48, 0xffe08a, 0.28).setScrollFactor(0).setDepth(-48);
      scene.add.circle(1020, 92, 30, 0xfff4c4, 1).setScrollFactor(0).setDepth(-48);
      break;
    case 'snow':
      scene.add.circle(210, 78, 36, 0xfff8e8, 0.22).setScrollFactor(0).setDepth(-48);
      scene.add.circle(210, 78, 24, 0xfffdf6, 1).setScrollFactor(0).setDepth(-48);
      break;
    case 'desert':
      scene.add.circle(1088, 78, 58, 0xffc878, 0.32).setScrollFactor(0).setDepth(-48);
      scene.add.circle(1088, 78, 38, 0xffe08a, 1).setScrollFactor(0).setDepth(-48);
      break;
    case 'ocean':
      scene.add.circle(180, 102, 40, 0xffe6a8, 0.24).setScrollFactor(0).setDepth(-48);
      scene.add.circle(180, 102, 26, 0xfff2c8, 1).setScrollFactor(0).setDepth(-48);
      break;
    case 'castle':
      scene.add.circle(1108, 84, 22, 0xd8d0e8, 0.85).setScrollFactor(0).setDepth(-48);
      scene.add.circle(1114, 80, 8, 0x2a1830, 0.35).setScrollFactor(0).setDepth(-47);
      break;
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

export class Parallax {
  private readonly layers: ParallaxLayer[] = [];

  constructor(scene: Phaser.Scene, theme: Theme) {
    const layout = layoutFor(theme);

    scene.add
      .image(0, 0, skyKey(theme))
      .setOrigin(0, 0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setScrollFactor(0)
      .setDepth(-50);

    addSun(scene, theme);

    const clouds = addStrip(scene, layout.cloudY, LANDSCAPE.cloudH, cloudKey(theme), -44, layout.cloudAlpha);
    const far = addStrip(scene, layout.farY, LANDSCAPE.farH, farKey(theme), -40, 1);
    const mountains = addStrip(scene, layout.mountainY, LANDSCAPE.mountainH, mountainKey(theme), -30, 1);
    const ground = addStrip(scene, layout.groundY, LANDSCAPE.groundH, hillKey(theme), -20, 1);

    this.layers.push(
      { image: clouds, factor: 0.12 },
      { image: far, factor: 0.18 },
      { image: mountains, factor: 0.3 },
      { image: ground, factor: 0.45 },
    );
  }

  update(scrollX: number): void {
    for (const layer of this.layers) {
      layer.image.tilePositionX = scrollX * layer.factor;
    }
  }
}
