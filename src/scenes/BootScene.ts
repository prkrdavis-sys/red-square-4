import Phaser from 'phaser';
import { hydrateSave } from '../data/progress';
import { applySettings } from '../data/settings';
import { dismissBootSplash } from '../systems/boot-splash';
import { CHARACTER_ASSETS } from '../systems/characters';
import { applySkin, createGameTextures } from '../systems/textures';
import { waitForUiFont } from '../ui/menu';

interface AssetManifest {
  characterRoot?: string;
  images?: Record<string, string>;
  audio?: Record<string, string>;
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.on('loaderror', () => undefined);
    this.load.json('asset-manifest', 'assets/manifest.json');
  }

  create(): void {
    createGameTextures(this);
    applySettings(this);
    const manifest = (this.cache.json.get('asset-manifest') ?? {}) as AssetManifest;
    const images = { ...(manifest.images ?? {}) };
    if (manifest.characterRoot) {
      for (const [key, path] of Object.entries(CHARACTER_ASSETS)) {
        images[key] = `${manifest.characterRoot}/${path}`;
      }
    }
    const audioFiles = manifest.audio ?? {};
    const imageKeys = Object.keys(images);
    const audioKeys = Object.keys(audioFiles);
    const saveReady = hydrateSave();
    const startTitle = () => {
      void Promise.all([saveReady, waitForUiFont()]).then(([save]) => {
        applySkin(this, save.equippedSkin);
        this.scene.start('TitleScene');
        dismissBootSplash();
      });
    };
    if (imageKeys.length === 0 && audioKeys.length === 0) {
      startTitle();
      return;
    }

    for (const key of imageKeys) {
      const path = images[key];
      if (path) {
        this.load.image(key, path);
      }
    }
    for (const key of audioKeys) {
      const path = audioFiles[key];
      if (path) {
        this.load.audio(key, path);
      }
    }
    this.load.once(Phaser.Loader.Events.COMPLETE, startTitle);
    this.load.start();
  }
}
