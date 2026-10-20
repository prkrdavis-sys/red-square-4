import type Phaser from 'phaser';
import { CHARACTER_ASSETS } from './characters';

interface AssetManifest {
  characterRoot?: string;
  images?: Record<string, string>;
  audio?: Record<string, string>;
}

const MANIFEST_WAIT_MS = 800;

let started = false;

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

function queueAssets(scene: Phaser.Scene, manifest: AssetManifest): void {
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
    return;
  }
  scene.load.on('loaderror', () => undefined);
  for (const key of imageKeys) {
    const path = images[key];
    if (path) {
      scene.load.image(key, path);
    }
  }
  for (const key of audioKeys) {
    const path = audioFiles[key];
    if (path) {
      scene.load.audio(key, path);
    }
  }
  scene.load.start();
}

export function preloadOptionalAssets(scene: Phaser.Scene): void {
  if (started) {
    return;
  }
  started = true;
  void fetchAssetManifest().then((manifest) => {
    const active = scene.scene.isActive() ? scene : scene.game.scene.getScenes(true)[0];
    if (!active) {
      return;
    }
    queueAssets(active, manifest);
  });
}
