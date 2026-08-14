import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, type Theme } from '../config';
import { cloudKey, ensureOceanPackTextures, farKey, hillKey, LANDSCAPE, mountainKey, skyKey } from './landscapes';

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
      return { cloudY: 20, farY: 268, mountainY: 118, groundY, cloudAlpha: 0.55 };
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
      scene.add
        .rectangle(GAME_WIDTH / 2, 0, GAME_WIDTH, 110, 0x9af0ff, 0.1)
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(-49);
      scene.add.ellipse(GAME_WIDTH / 2, -8, 420, 70, 0xd8fbff, 0.12).setScrollFactor(0).setDepth(-49);
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

function addOceanPackLayers(scene: Phaser.Scene, layers: ParallaxLayer[]): void {
  const pack = ensureOceanPackTextures(scene);
  if (pack.coral) {
    layers.push({ image: addStrip(scene, 208, 512, pack.coral, -33, 0.92), factor: 0.22 });
  }
  if (pack.reefs) {
    layers.push({ image: addStrip(scene, 96, 420, pack.reefs, -28, 1), factor: 0.27 });
  }
}

export class Parallax {
  private readonly layers: ParallaxLayer[] = [];

  constructor(scene: Phaser.Scene, theme: Theme) {
    const layout = layoutFor(theme);

    if (theme === 'ocean') {
      this.layers.push({ image: addStrip(scene, 0, GAME_HEIGHT, skyKey(theme), -50, 1), factor: 0.05 });
    } else {
      scene.add
        .image(0, 0, skyKey(theme))
        .setOrigin(0, 0)
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
        .setScrollFactor(0)
        .setDepth(-50);
    }

    addSun(scene, theme);

    const clouds = addStrip(scene, layout.cloudY, LANDSCAPE.cloudH, cloudKey(theme), -44, layout.cloudAlpha);
    const far = addStrip(scene, layout.farY, LANDSCAPE.farH, farKey(theme), -40, 1);
    if (theme === 'ocean') {
      addOceanPackLayers(scene, this.layers);
    }
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
