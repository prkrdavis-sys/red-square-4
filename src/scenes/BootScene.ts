import Phaser from 'phaser';
import { hydrateSave } from '../data/progress';
import { applySettings } from '../data/settings';
import { dismissBootSplash } from '../systems/boot-splash';
import { CHARACTER_ASSETS } from '../systems/characters';
import { applySkin, createGameTextures } from '../systems/textures';
import { waitForUiFont } from '../ui/font';

interface AssetManifest {
  characterRoot?: string;
  images?: Record<string, string>;
  audio?: Record<string, string>;
}

const ASSET_WAIT_MS = 2500;
const MANIFEST_WAIT_MS = 800;

async function fetchAssetManifest(): Promise<AssetManifest> {
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), MANIFEST_WAIT_MS);
    const res = await fetch('assets/manifest.json', { cache: 'no-store', signal: ctrl.signal });
    window.clearTimeout(timer);
    if (!res.ok) {
      return {};
    }
    return (await res.json()) as AssetManifest;
  } catch {
    return {};
  }
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.on('loaderror', () => undefined);
  }

  create(): void {
    createGameTextures(this);
    applySettings(this);
    const saveReady = hydrateSave();
    let started = false;
    const startTitle = () => {
      if (started) {
        return;
      }
      started = true;
      void Promise.all([saveReady, waitForUiFont()]).then(([save]) => {
        applySkin(this, save.equippedSkin);
        this.scene.start('TitleScene');
        dismissBootSplash();
      });
    };
    this.time.delayedCall(ASSET_WAIT_MS, startTitle);

    void fetchAssetManifest().then((manifest) => {
      if (started) {
        return;
      }
      const images = { ...(manifest.images ?? {}) };
      if (manifest.characterRoot) {
        for (const [key, path] of Object.entries(CHARACTER_ASSETS)) {
          images[key] = `${manifest.characterRoot}/${path}`;
        }
      }
      const audioFiles = manifest.audio ?? {};
      const imageKeys = Object.keys(images);
      const audioKeys = Object.keys(audioFiles);
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
    });
  }
}
