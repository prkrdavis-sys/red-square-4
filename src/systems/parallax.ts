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
      return { cloudY: 4, farY: 128, mountainY: 176, groundY, cloudAlpha: 0.96 };
    case 'snow':
      return { cloudY: 8, farY: 118, mountainY: 166, groundY, cloudAlpha: 0.82 };
    case 'desert':
      return { cloudY: 6, farY: 132, mountainY: 186, groundY, cloudAlpha: 0.78 };
    case 'ocean':
      return { cloudY: 20, farY: 268, mountainY: 118, groundY, cloudAlpha: 0.55 };
    case 'castle':
      return { cloudY: 12, farY: 140, mountainY: 190, groundY, cloudAlpha: 0.34 };
    case 'rainforest':
      return { cloudY: 10, farY: 126, mountainY: 172, groundY, cloudAlpha: 0.7 };
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
      scene.add.circle(1020, 92, 118, 0xffd878, 0.12).setScrollFactor(0).setDepth(-48);
      scene.add.circle(1020, 92, 72, 0xffc84a, 0.22).setScrollFactor(0).setDepth(-48);
      scene.add.circle(1020, 92, 34, 0xffe066, 1).setScrollFactor(0).setDepth(-48);
      scene.add.circle(1014, 86, 9, 0xfff4c4, 0.55).setScrollFactor(0).setDepth(-48);
      for (const ray of [
        { a: -26, w: 18, h: 300, al: 0.06 },
        { a: -8, w: 11, h: 250, al: 0.042 },
        { a: 12, w: 15, h: 270, al: 0.05 },
        { a: 30, w: 9, h: 210, al: 0.034 },
      ]) {
        scene.add
          .rectangle(1020, 92, ray.w, ray.h, 0xffe08a, ray.al)
          .setOrigin(0.5, 0)
          .setScrollFactor(0)
          .setDepth(-47)
          .setAngle(ray.a);
      }
      break;
    case 'snow':
      scene.add.circle(210, 78, 36, 0xfff8e8, 0.22).setScrollFactor(0).setDepth(-48);
      scene.add.circle(210, 78, 24, 0xfffdf6, 1).setScrollFactor(0).setDepth(-48);
      break;
    case 'desert':
      scene.add.circle(1088, 78, 140, 0xffb050, 0.14).setScrollFactor(0).setDepth(-48);
      scene.add.circle(1088, 78, 86, 0xffc060, 0.26).setScrollFactor(0).setDepth(-48);
      scene.add.circle(1088, 78, 42, 0xffd060, 1).setScrollFactor(0).setDepth(-48);
      scene.add.circle(1080, 70, 12, 0xfff0c0, 0.5).setScrollFactor(0).setDepth(-48);
      for (const ray of [
        { a: -22, w: 22, h: 320, al: 0.07 },
        { a: -6, w: 12, h: 260, al: 0.048 },
        { a: 10, w: 16, h: 290, al: 0.055 },
        { a: 26, w: 10, h: 220, al: 0.038 },
      ]) {
        scene.add
          .rectangle(1088, 78, ray.w, ray.h, 0xffd878, ray.al)
          .setOrigin(0.5, 0)
          .setScrollFactor(0)
          .setDepth(-47)
          .setAngle(ray.a);
      }
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
    case 'rainforest':
      scene.add.circle(980, 70, 46, 0xffe08a, 0.16).setScrollFactor(0).setDepth(-48);
      scene.add.circle(980, 70, 22, 0xfff4c4, 0.7).setScrollFactor(0).setDepth(-48);
      scene.add
        .rectangle(GAME_WIDTH / 2, 0, 18, 220, 0xfff4c4, 0.06)
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(-47)
        .setAngle(-12);
      scene.add
        .rectangle(GAME_WIDTH / 2 + 90, 0, 14, 260, 0xfff4c4, 0.05)
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(-47)
        .setAngle(8);
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

    if (theme === 'ocean' || theme === 'grass' || theme === 'desert') {
      const skyFactor = theme === 'ocean' ? 0.05 : theme === 'desert' ? 0.03 : 0.035;
      this.layers.push({
        image: addStrip(scene, 0, GAME_HEIGHT, skyKey(theme), -50, 1),
        factor: skyFactor,
      });
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
