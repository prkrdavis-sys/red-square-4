import Phaser from 'phaser';
import { TERRAIN_HAZARD_KINDS, THEMES, TILE, enemiesForWorld, type BossKind, type TerrainHazardKind, type Theme } from '../config';
import { loadSave } from '../data/progress';
import { projectileStyleForKind, type ProjectileStyle } from './projectile-style';
import {
  CLASSIC_PALETTE,
  DEFAULT_SKIN_ID,
  SKINS,
  skinById,
  type Accessory,
  type HeroPalette,
  type SkinDef,
} from '../data/skins';
import { createEnemyTextures } from './enemies';
import { createForegroundTextures } from './foreground';
import { createLandscapeTextures } from './landscapes';
import { createMiniBossTextures } from './mini-bosses';
import { createWorldBossTextures, worldBossTextureKey } from './world-bosses';

function gfx(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  return scene.make.graphics({ x: 0, y: 0 });
}

function commit(g: Phaser.GameObjects.Graphics, key: string, w: number, h: number): void {
  g.generateTexture(key, w, h);
  g.destroy();
}

const HERO_SIZE = 48;

type HeroPose = 'idle' | 'blink' | 'run-a' | 'run-b' | 'jump' | 'fall' | 'dead';

const HERO_EYE = 0xffffff;
const HERO_PUPIL = 0x140808;

interface EyeMetrics {
  open: number;
  lookX: number;
  lookY: number;
  w: number;
  h: number;
  browLift: number;
  cross?: boolean;
}

function heroEyes(pose: HeroPose): EyeMetrics {
  switch (pose) {
    case 'idle':
      return { open: 1, lookX: 1.6, lookY: 0.4, w: 14, h: 16, browLift: 0 };
    case 'blink':
      return { open: 0, lookX: 1.4, lookY: 0, w: 14, h: 4, browLift: 1 };
    case 'run-a':
      return { open: 1, lookX: 2.2, lookY: 0.2, w: 13, h: 14, browLift: -1 };
    case 'run-b':
      return { open: 1, lookX: 2.4, lookY: -0.2, w: 13, h: 14, browLift: -1 };
    case 'jump':
      return { open: 1, lookX: 1.2, lookY: -2.2, w: 14, h: 17, browLift: -2.4 };
    case 'fall':
      return { open: 1, lookX: 0.4, lookY: 2.8, w: 15, h: 16, browLift: 2.2 };
    case 'dead':
      return { open: 1, lookX: 0, lookY: 0, w: 14, h: 14, browLift: 2, cross: true };
    default: {
      const neverPose: never = pose;
      return neverPose;
    }
  }
}

function paintHeroMouth(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  pose: HeroPose,
  skin: HeroPalette,
): void {
  switch (pose) {
    case 'idle':
    case 'blink':
      g.lineStyle(3, skin.ink, 1);
      g.beginPath();
      g.arc(cx, cy - 1, 6, 0.15 * Math.PI, 0.85 * Math.PI, false);
      g.strokePath();
      break;
    case 'run-a':
    case 'run-b':
      g.fillStyle(skin.ink, 1);
      g.fillRoundedRect(cx - 5, cy + 1, 10, 3, 1.5);
      break;
    case 'jump':
      g.fillStyle(skin.ink, 1);
      g.fillEllipse(cx, cy + 1, 9, 9);
      g.fillStyle(skin.shade, 1);
      g.fillEllipse(cx, cy + 1.5, 5, 5);
      break;
    case 'fall':
      g.lineStyle(3, skin.ink, 1);
      g.beginPath();
      g.arc(cx, cy + 5, 6, 1.12 * Math.PI, 1.88 * Math.PI, false);
      g.strokePath();
      break;
    case 'dead':
      g.fillStyle(skin.ink, 1);
      g.fillEllipse(cx, cy + 1, 10, 6);
      g.fillStyle(skin.shade, 1);
      g.fillEllipse(cx, cy + 1.5, 6, 3);
      break;
    default: {
      const neverPose: never = pose;
      return neverPose;
    }
  }
}

function paintHeroFeet(g: Phaser.GameObjects.Graphics, pose: HeroPose, skin: HeroPalette): void {
  const tucked = pose === 'jump';
  const dangled = pose === 'fall';
  const splayed = pose === 'dead';
  const runShift = pose === 'run-a' ? -3 : pose === 'run-b' ? 3 : 0;
  const y = tucked ? 36 : dangled || splayed ? 41 : 39;
  const h = tucked ? 7 : dangled || splayed ? 8 : 8;
  const w = 13;
  const leftX = splayed ? 2 : 7 + runShift;
  const rightX = splayed ? 33 : 28 - runShift;
  g.fillStyle(skin.ink, 1);
  g.fillRoundedRect(leftX, y, w, h, 3);
  g.fillRoundedRect(rightX, y, w, h, 3);
  g.fillStyle(skin.boot, 1);
  g.fillRoundedRect(leftX + 1, y, w - 2, h - 2, 2);
  g.fillRoundedRect(rightX + 1, y, w - 2, h - 2, 2);
  g.fillStyle(skin.bootSole, 1);
  g.fillRect(leftX + 1, y + h - 3, w - 2, 2);
  g.fillRect(rightX + 1, y + h - 3, w - 2, 2);
}

function paintHeroEye(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  metrics: EyeMetrics,
  skin: HeroPalette,
): void {
  const outlineW = metrics.w + 4;
  const outlineH = metrics.open <= 0 ? 6 : metrics.h + 4;

  if (metrics.cross) {
    g.fillStyle(skin.ink, 1);
    g.fillEllipse(x, y, outlineW, outlineH);
    g.fillStyle(HERO_EYE, 1);
    g.fillEllipse(x, y, metrics.w, metrics.h);
    g.lineStyle(3, skin.ink, 1);
    g.beginPath();
    g.moveTo(x - 5, y - 5);
    g.lineTo(x + 5, y + 5);
    g.moveTo(x + 5, y - 5);
    g.lineTo(x - 5, y + 5);
    g.strokePath();
    return;
  }

  if (metrics.open <= 0) {
    g.fillStyle(skin.ink, 1);
    g.fillRoundedRect(x - metrics.w / 2 - 1, y - 2, metrics.w + 2, 5, 2);
    g.fillStyle(skin.shade, 1);
    g.fillRoundedRect(x - metrics.w / 2, y - 1, metrics.w, 2, 1);
    return;
  }

  g.fillStyle(skin.ink, 1);
  g.fillEllipse(x, y, outlineW, outlineH);
  g.fillStyle(HERO_EYE, 1);
  g.fillEllipse(x, y, metrics.w, metrics.h);
  g.fillStyle(HERO_PUPIL, 1);
  g.fillEllipse(x + metrics.lookX, y + metrics.lookY, metrics.w * 0.52, metrics.h * 0.58);
  g.fillStyle(HERO_EYE, 1);
  g.fillCircle(x + metrics.lookX - 2.2, y + metrics.lookY - 2.6, 2.2);

  const browY = y - metrics.h * 0.62 + metrics.browLift;
  g.fillStyle(skin.ink, 1);
  g.fillRoundedRect(x - 6, browY, 12, 2, 1);
}

/** Accessories sit behind the head band, so anything above the body is drawn before it. */
function paintAccessoryBack(
  g: Phaser.GameObjects.Graphics,
  accessory: Accessory,
  pose: HeroPose,
  skin: HeroPalette,
): void {
  const flutter = pose === 'run-a' ? 4 : pose === 'run-b' ? 7 : pose === 'jump' ? 9 : 5;
  switch (accessory) {
    case 'cape':
      g.fillStyle(skin.ink, 1);
      g.fillRoundedRect(38, 8, 8 + flutter, 30, 4);
      g.fillStyle(skin.shade, 1);
      g.fillRoundedRect(39, 9, 6 + flutter, 27, 3);
      break;
    case 'halo':
      g.fillStyle(0xffe9a8, 1);
      g.fillEllipse(HERO_SIZE / 2, 3, 30, 8);
      g.fillStyle(skin.ink, 1);
      g.fillEllipse(HERO_SIZE / 2, 3, 20, 3);
      break;
    case 'horns':
      g.fillStyle(skin.ink, 1);
      g.fillTriangle(6, 8, 12, 8, 4, -2);
      g.fillTriangle(36, 8, 42, 8, 44, -2);
      g.fillStyle(0xe8dcc0, 1);
      g.fillTriangle(7, 7, 11, 7, 5, 0);
      g.fillTriangle(37, 7, 41, 7, 43, 0);
      break;
    case 'antenna':
      g.fillStyle(skin.ink, 1);
      g.fillRect(15, 0, 2, 7);
      g.fillRect(31, 0, 2, 7);
      g.fillStyle(skin.gloss, 1);
      g.fillCircle(16, 1, 3);
      g.fillCircle(32, 1, 3);
      break;
    case 'none':
    case 'cap':
    case 'visor':
    case 'crown':
    case 'scarf':
    case 'bandana':
      break;
    default: {
      const neverAccessory: never = accessory;
      return neverAccessory;
    }
  }
}

function paintAccessoryFront(
  g: Phaser.GameObjects.Graphics,
  accessory: Accessory,
  pose: HeroPose,
  skin: HeroPalette,
): void {
  const droop = pose === 'dead' ? 3 : 0;
  switch (accessory) {
    case 'cap':
      g.fillStyle(skin.ink, 1);
      g.fillRoundedRect(4, 1 + droop, 40, 11, { tl: 6, tr: 6, bl: 2, br: 2 });
      g.fillStyle(skin.gloss, 1);
      g.fillRoundedRect(7, 3 + droop, 34, 6, { tl: 5, tr: 5, bl: 1, br: 1 });
      g.fillStyle(skin.ink, 1);
      g.fillRoundedRect(0, 10 + droop, 24, 4, 2);
      break;
    case 'visor':
      g.fillStyle(skin.ink, 1);
      g.fillRoundedRect(6, 10 + droop, 36, 7, 3);
      g.fillStyle(0x8ff0ff, 0.85);
      g.fillRoundedRect(8, 11 + droop, 32, 4, 2);
      break;
    case 'crown':
      g.fillStyle(0xffd35c, 1);
      g.fillRect(10, 4 + droop, 28, 6);
      g.fillTriangle(10, 5 + droop, 17, 5 + droop, 13.5, -3 + droop);
      g.fillTriangle(20, 5 + droop, 28, 5 + droop, 24, -4 + droop);
      g.fillTriangle(31, 5 + droop, 38, 5 + droop, 34.5, -3 + droop);
      g.fillStyle(0xff5a6a, 1);
      g.fillCircle(24, 8 + droop, 2.4);
      break;
    case 'scarf':
      g.fillStyle(skin.ink, 1);
      g.fillRoundedRect(6, 30 + droop, 36, 8, 3);
      g.fillStyle(skin.gloss, 1);
      g.fillRoundedRect(8, 31 + droop, 32, 4, 2);
      break;
    case 'bandana':
      g.fillStyle(skin.gloss, 1);
      g.fillRoundedRect(4, 8 + droop, 40, 7, 2);
      g.fillStyle(skin.shade, 1);
      g.fillRoundedRect(4, 12 + droop, 40, 3, 1);
      g.fillStyle(skin.gloss, 1);
      g.fillTriangle(42, 10 + droop, 48, 6 + droop, 48, 18 + droop);
      break;
    case 'none':
    case 'cape':
    case 'halo':
    case 'horns':
    case 'antenna':
      break;
    default: {
      const neverAccessory: never = accessory;
      return neverAccessory;
    }
  }
}

function paintHeroSquare(g: Phaser.GameObjects.Graphics, pose: HeroPose, skin: SkinDef): void {
  const cx = HERO_SIZE / 2;
  const palette = skin.palette;
  paintAccessoryBack(g, skin.accessory, pose, palette);
  paintHeroFeet(g, pose, palette);

  g.fillStyle(palette.ink, 1);
  g.fillRoundedRect(1, 1, 46, 40, 8);
  g.fillStyle(palette.body, 1);
  g.fillRoundedRect(5, 5, 38, 32, 5);
  g.fillStyle(palette.shade, 1);
  g.fillRoundedRect(5, 24, 38, 13, { tl: 0, tr: 0, bl: 5, br: 5 });
  g.fillStyle(palette.gloss, 1);
  g.fillRoundedRect(7, 6, 11, 5, { tl: 3, tr: 2, bl: 2, br: 2 });

  const faceY = pose === 'jump' ? 18 : pose === 'fall' || pose === 'dead' ? 21 : 19;
  const eyes = heroEyes(pose);
  paintHeroEye(g, 16, faceY, eyes, palette);
  paintHeroEye(g, 32, faceY, eyes, palette);
  paintHeroMouth(g, cx, faceY + 13, pose, palette);
  paintAccessoryFront(g, skin.accessory, pose, palette);
}

/**
 * Graphics.generateTexture redraws into an existing canvas texture, so the previous skin has to be
 * wiped first. Reusing the texture keeps sprites that already reference it valid.
 */
function clearCanvasTexture(scene: Phaser.Scene, key: string): void {
  if (!scene.textures.exists(key)) {
    return;
  }
  const existing = scene.textures.get(key) as Partial<Phaser.Textures.CanvasTexture>;
  if (typeof existing.clear === 'function') {
    existing.clear();
  }
}

function stampHero(scene: Phaser.Scene, key: string, pose: HeroPose, skin: SkinDef): void {
  clearCanvasTexture(scene, key);
  const g = gfx(scene);
  paintHeroSquare(g, pose, skin);
  commit(g, key, HERO_SIZE, HERO_SIZE);
}

const HERO_POSE_KEYS: Array<{ key: string; pose: HeroPose }> = [
  { key: 'player', pose: 'idle' },
  { key: 'player-blink', pose: 'blink' },
  { key: 'player-run-a', pose: 'run-a' },
  { key: 'player-run-b', pose: 'run-b' },
  { key: 'player-jump', pose: 'jump' },
  { key: 'player-fall', pose: 'fall' },
  { key: 'player-dead', pose: 'dead' },
];

export function skinThumbKey(skinId: string): string {
  return `skin-thumb-${skinId}`;
}

function defaultSkin(): SkinDef {
  return {
    id: DEFAULT_SKIN_ID,
    name: 'Red Square',
    palette: CLASSIC_PALETTE,
    accessory: 'none',
  };
}

function drawPlayer(scene: Phaser.Scene, skin: SkinDef): void {
  for (const { key, pose } of HERO_POSE_KEYS) {
    stampHero(scene, key, pose, skin);
  }
}

function stampSkinThumbs(scene: Phaser.Scene): void {
  for (const skin of SKINS) {
    stampHero(scene, skinThumbKey(skin.id), 'idle', skin);
  }
}

/** Repaints the shared `player-*` textures so every existing sprite picks up the new look. */
export function applySkin(scene: Phaser.Scene, skinId: string): void {
  const skin = skinById(skinId) ?? defaultSkin();
  drawPlayer(scene, skin);
  drawHeroShard(scene, skin.palette);
  drawMapToken(scene, skin.palette);
}

function drawBaddie(
  scene: Phaser.Scene,
  key: string,
  size: number,
  body: number,
  shade: number,
  eyeRed: number,
): void {
  const g = gfx(scene);
  const r = size / 2;
  g.fillStyle(0x111111, 1);
  g.fillCircle(r, r, r);
  g.fillStyle(body, 1);
  g.fillCircle(r, r, r - 2);
  g.fillStyle(shade, 1);
  g.fillCircle(r - size * 0.12, r - size * 0.14, r * 0.42);
  const eyeY = r - size * 0.08;
  const eyeDx = size * 0.18;
  const eyeW = size * 0.13;
  const eyeH = size * 0.18;
  g.fillStyle(0xffffff, 1);
  g.fillEllipse(r - eyeDx, eyeY, eyeW, eyeH);
  g.fillEllipse(r + eyeDx, eyeY, eyeW, eyeH);
  g.fillStyle(eyeRed, 1);
  g.fillEllipse(r - eyeDx, eyeY + 1, eyeW * 0.55, eyeH * 0.55);
  g.fillEllipse(r + eyeDx, eyeY + 1, eyeW * 0.55, eyeH * 0.55);
  g.fillStyle(0x1a0000, 1);
  g.fillCircle(r - eyeDx, eyeY + 2, Math.max(2, size * 0.04));
  g.fillCircle(r + eyeDx, eyeY + 2, Math.max(2, size * 0.04));
  g.lineStyle(Math.max(2, size * 0.04), 0x220000, 1);
  g.lineBetween(r - eyeDx - eyeW, eyeY - eyeH, r - eyeDx + eyeW * 0.2, eyeY - eyeH * 0.35);
  g.lineBetween(r + eyeDx + eyeW, eyeY - eyeH, r + eyeDx - eyeW * 0.2, eyeY - eyeH * 0.35);
  commit(g, key, size, size);
}

function tileColors(theme: Theme): { top: number; mid: number; dirt: number; dark: number; speck: number } {
  switch (theme) {
    case 'grass':
      return { top: 0x6bcc3a, mid: 0x4aa028, dirt: 0xc68642, dark: 0x6b4423, speck: 0xa86b32 };
    case 'snow':
      return { top: 0xf4fbff, mid: 0xcfe7f7, dirt: 0xd9eefc, dark: 0x7f9bb0, speck: 0xffffff };
    case 'desert':
      return { top: 0xe8c36a, mid: 0xd0a24e, dirt: 0xc9953f, dark: 0x8a5a22, speck: 0xf0d48a };
    case 'ocean':
      return { top: 0x3ecf8e, mid: 0x2a9d6e, dirt: 0x2d6b7a, dark: 0x163b45, speck: 0x49b8c9 };
    case 'castle':
      return { top: 0x5a3d66, mid: 0x3e2948, dirt: 0x2a1c32, dark: 0x120814, speck: 0x6e4a7a };
    case 'rainforest':
      return { top: 0x3a9a3a, mid: 0x2a7028, dirt: 0x4a3420, dark: 0x2a1c10, speck: 0x6a8a32 };
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

function drawSolidTile(scene: Phaser.Scene, theme: Theme): void {
  const c = tileColors(theme);
  const g = gfx(scene);
  g.fillStyle(c.dark, 1);
  g.fillRect(0, 0, TILE, TILE);
  g.fillStyle(c.dirt, 1);
  g.fillRect(2, 18, TILE - 4, TILE - 20);
  g.fillStyle(c.mid, 1);
  g.fillRect(2, 2, TILE - 4, 20);
  g.fillStyle(c.top, 1);
  g.fillRect(4, 4, TILE - 8, 10);
  g.fillStyle(c.speck, 0.45);
  g.fillRect(10, 30, 6, 4);
  g.fillRect(28, 44, 8, 5);
  g.fillRect(46, 26, 5, 5);
  if (theme === 'castle') {
    g.lineStyle(2, 0x1a0c20, 0.8);
    g.lineBetween(2, 40, TILE - 2, 40);
    g.lineBetween(TILE / 2, 18, TILE / 2, TILE - 2);
  } else if (theme === 'rainforest') {
    g.fillStyle(0x1e5a28, 0.7);
    g.fillRect(14, 8, 4, 8);
    g.fillEllipse(16, 8, 10, 6);
    g.fillEllipse(22, 10, 8, 5);
  }
  commit(g, `tile-${theme}-solid`, TILE, TILE);
}

function arenaPalette(theme: Theme): { floor: number; inlay: number; line: number; flag: number; pole: number } {
  switch (theme) {
    case 'grass':
      return { floor: 0x5a3a18, inlay: 0x3d6b1e, line: 0xc4a05a, flag: 0x3d9e2f, pole: 0x6b4423 };
    case 'snow':
      return { floor: 0xb9d7ea, inlay: 0x7eb0d0, line: 0xffffff, flag: 0x4a88b8, pole: 0x8aa7c2 };
    case 'desert':
      return { floor: 0xc9953f, inlay: 0x8a5a22, line: 0xe8c36a, flag: 0xc45a22, pole: 0x8a5a22 };
    case 'ocean':
      return { floor: 0x1b4a58, inlay: 0x2a8aaa, line: 0x49b8c9, flag: 0x2f6f88, pole: 0x163b45 };
    case 'castle':
      return { floor: 0x2a1c32, inlay: 0x6e4a7a, line: 0x8a3048, flag: 0x8a2030, pole: 0x3e2948 };
    case 'rainforest':
      return { floor: 0x3a2814, inlay: 0x1e5a28, line: 0x8ab05a, flag: 0x2d8a3a, pole: 0x4a3018 };
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

function masonryColors(theme: Theme): { brick: number; brickAlt: number; mortar: number; highlight: number } {
  switch (theme) {
    case 'grass':
      return { brick: 0xb56a38, brickAlt: 0x9a552c, mortar: 0x3a2418, highlight: 0xd4a06a };
    case 'snow':
      return { brick: 0x9eb4c6, brickAlt: 0x7f96aa, mortar: 0x4a5c6c, highlight: 0xd8e6f0 };
    case 'desert':
      return { brick: 0xc47a3a, brickAlt: 0xa86228, mortar: 0x5a3014, highlight: 0xe8b878 };
    case 'ocean':
      return { brick: 0x5a7a88, brickAlt: 0x3e5e6c, mortar: 0x1a3038, highlight: 0x8ab0bc };
    case 'castle':
      return { brick: 0x6a5a78, brickAlt: 0x4e3e5c, mortar: 0x241828, highlight: 0x9a88a8 };
    case 'rainforest':
      return { brick: 0x4a6a32, brickAlt: 0x3a5428, mortar: 0x1a2810, highlight: 0x7aaa4a };
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

function drawArenaTile(scene: Phaser.Scene, theme: Theme): void {
  const c = tileColors(theme);
  const a = arenaPalette(theme);
  const g = gfx(scene);
  g.fillStyle(c.dark, 1);
  g.fillRect(0, 0, TILE, TILE);
  g.fillStyle(a.floor, 1);
  g.fillRect(2, 2, TILE - 4, TILE - 4);
  g.fillStyle(c.dirt, 1);
  g.fillRect(4, 22, TILE - 8, TILE - 26);
  g.fillStyle(a.inlay, 1);
  g.fillRect(8, 8, TILE - 16, 10);
  g.lineStyle(2, a.line, 0.7);
  g.strokeRect(6, 6, TILE - 12, TILE - 12);
  if (theme === 'castle') {
    g.fillStyle(0x6a1828, 0.85);
    g.fillRect(2, 28, TILE - 4, 10);
  } else if (theme === 'snow') {
    g.lineStyle(1, 0xffffff, 0.55);
    g.lineBetween(10, 18, 22, 40);
    g.lineBetween(40, 14, 52, 36);
  } else if (theme === 'ocean') {
    g.fillStyle(0x49b8c9, 0.35);
    g.fillEllipse(TILE / 2, 38, 28, 10);
  } else if (theme === 'rainforest') {
    g.fillStyle(0x3d8a32, 0.45);
    g.fillEllipse(TILE / 2, 40, 26, 9);
    g.fillStyle(0x8ab05a, 0.5);
    g.fillCircle(18, 16, 4);
    g.fillCircle(46, 18, 3);
  }
  commit(g, `tile-${theme}-arena`, TILE, TILE);
}

function drawArenaRing(scene: Phaser.Scene, theme: Theme): void {
  const a = arenaPalette(theme);
  const w = 420;
  const h = 72;
  const g = gfx(scene);
  g.lineStyle(6, a.line, 0.95);
  g.strokeEllipse(w / 2, h / 2, 390, 52);
  g.lineStyle(3, a.inlay, 0.8);
  g.strokeEllipse(w / 2, h / 2, 360, 38);
  g.lineStyle(2, a.flag, 0.55);
  g.strokeEllipse(w / 2, h / 2, 240, 22);
  commit(g, `arena-ring-${theme}`, w, h);
}

function drawArenaGateTile(scene: Phaser.Scene, theme: Theme): void {
  const m = masonryColors(theme);
  const g = gfx(scene);
  g.fillStyle(m.mortar, 1);
  g.fillRect(0, 0, TILE, TILE);
  g.fillStyle(m.brick, 1);
  g.fillRect(3, 3, TILE - 6, 26);
  g.fillStyle(m.brickAlt, 1);
  g.fillRect(3, 35, 28, 26);
  g.fillRect(33, 35, TILE - 36, 26);
  g.fillStyle(m.highlight, 0.45);
  g.fillRect(5, 5, TILE - 14, 4);
  g.fillRect(5, 37, 18, 3);
  commit(g, `tile-${theme}-gate`, TILE, TILE);
}

function drawArenaWallTile(scene: Phaser.Scene, theme: Theme): void {
  const m = masonryColors(theme);
  const g = gfx(scene);
  g.fillStyle(m.mortar, 1);
  g.fillRect(0, 0, TILE, TILE);
  g.fillStyle(m.brick, 1);
  g.fillRect(4, 4, 26, 26);
  g.fillRect(34, 4, 26, 18);
  g.fillStyle(m.brickAlt, 1);
  g.fillRect(4, 34, 18, 26);
  g.fillRect(26, 26, 34, 34);
  g.fillStyle(m.highlight, 0.35);
  g.fillRect(6, 6, 14, 4);
  g.fillRect(36, 6, 16, 3);
  commit(g, `tile-${theme}-wall`, TILE, TILE);
}

function drawArenaBanner(scene: Phaser.Scene, theme: Theme): void {
  const a = arenaPalette(theme);
  const m = masonryColors(theme);
  const w = 56;
  const h = 328;
  const g = gfx(scene);
  g.fillStyle(m.mortar, 1);
  g.fillRect(8, h - 28, 40, 22);
  g.fillStyle(m.brick, 1);
  g.fillRect(10, h - 26, 36, 16);
  g.fillStyle(m.highlight, 0.5);
  g.fillRect(12, h - 24, 20, 4);
  g.fillStyle(0x1a1010, 1);
  g.fillRect(25, h - 30, 6, 8);
  g.fillStyle(a.pole, 1);
  g.fillRect(26, 8, 5, h - 36);
  g.fillStyle(0x2a1810, 1);
  g.fillRect(25, 6, 7, 6);
  g.fillStyle(a.line, 1);
  g.fillCircle(28.5, 8, 4);
  g.fillStyle(a.flag, 1);
  g.fillTriangle(31, 14, 54, 32, 31, 58);
  g.fillStyle(a.line, 1);
  g.fillTriangle(31, 20, 46, 32, 31, 48);
  commit(g, `arena-banner-${theme}`, w, h);
}

function drawArenaTorch(scene: Phaser.Scene, theme: Theme): void {
  const m = masonryColors(theme);
  const g = gfx(scene);
  g.fillStyle(m.mortar, 1);
  g.fillRoundedRect(4, 22, 20, 28, 4);
  g.fillStyle(m.brick, 1);
  g.fillRoundedRect(6, 24, 16, 24, 3);
  g.fillStyle(0x6a6a72, 1);
  g.fillRect(8, 30, 12, 5);
  g.fillRect(8, 38, 12, 5);
  g.fillStyle(0x3a2418, 1);
  g.fillRect(11, 42, 6, 18);
  g.fillStyle(0xffcc33, 1);
  g.fillEllipse(14, 20, 14, 20);
  g.fillStyle(0xff6622, 1);
  g.fillEllipse(14, 18, 8, 14);
  g.fillStyle(0xfff1a8, 0.9);
  g.fillCircle(14, 12, 3);
  commit(g, `arena-torch-${theme}`, 28, 64);
}

function drawArenaGate(scene: Phaser.Scene, theme: Theme): void {
  const m = masonryColors(theme);
  const a = arenaPalette(theme);
  const w = TILE * 7;
  const h = TILE * 8;
  const g = gfx(scene);
  const postW = 46;
  const inset = 20;
  const plinthH = 30;
  const postTop = 172;
  const leftX = inset;
  const rightX = w - inset - postW;
  const postFill = theme === 'grass' || theme === 'rainforest' ? a.pole : m.brick;
  const postAlt = theme === 'grass' || theme === 'rainforest' ? 0x8a5a28 : m.brickAlt;
  const leftCenter = leftX + postW / 2;
  const rightCenter = rightX + postW / 2;
  const cx = w / 2;
  const cy = postTop + 10;
  const radius = (rightCenter - leftCenter) / 2;

  g.fillStyle(m.mortar, 1);
  g.fillRect(leftCenter - 32, h - plinthH, 64, plinthH);
  g.fillRect(rightCenter - 32, h - plinthH, 64, plinthH);
  g.fillStyle(postFill, 1);
  g.fillRect(leftCenter - 28, h - plinthH + 4, 56, plinthH - 8);
  g.fillRect(rightCenter - 28, h - plinthH + 4, 56, plinthH - 8);

  g.fillStyle(m.mortar, 1);
  g.fillRect(leftX - 2, postTop, postW + 4, h - plinthH - postTop);
  g.fillRect(rightX - 2, postTop, postW + 4, h - plinthH - postTop);
  g.fillStyle(postFill, 1);
  g.fillRect(leftX, postTop, postW, h - plinthH - postTop);
  g.fillRect(rightX, postTop, postW, h - plinthH - postTop);
  g.fillStyle(postAlt, 1);
  g.fillRect(leftX + 8, postTop + 8, 8, h - plinthH - postTop - 16);
  g.fillRect(rightX + postW - 16, postTop + 8, 8, h - plinthH - postTop - 16);
  g.fillStyle(m.highlight, 0.4);
  g.fillRect(leftX + 6, postTop + 6, 6, h - plinthH - postTop - 20);
  g.fillRect(rightX + 6, postTop + 6, 6, h - plinthH - postTop - 20);

  g.fillStyle(m.mortar, 1);
  g.fillRect(leftX - 8, postTop - 18, postW + 16, 20);
  g.fillRect(rightX - 8, postTop - 18, postW + 16, 20);
  g.fillStyle(m.highlight, 1);
  g.fillRect(leftX - 6, postTop - 16, postW + 12, 6);
  g.fillRect(rightX - 6, postTop - 16, postW + 12, 6);

  g.lineStyle(40, m.mortar, 1);
  g.beginPath();
  g.arc(cx, cy, radius, Math.PI, 0, true);
  g.strokePath();
  g.lineStyle(30, postFill, 1);
  g.beginPath();
  g.arc(cx, cy, radius, Math.PI, 0, true);
  g.strokePath();
  g.lineStyle(6, m.highlight, 0.55);
  g.beginPath();
  g.arc(cx, cy, radius - 8, Math.PI, 0, true);
  g.strokePath();

  const keyY = cy - radius;
  g.fillStyle(m.mortar, 1);
  g.fillRect(cx - 16, keyY - 6, 32, 38);
  g.fillStyle(a.line, 1);
  g.fillRect(cx - 12, keyY - 2, 24, 30);

  g.fillStyle(a.line, 1);
  g.fillTriangle(leftCenter, postTop - 40, leftCenter - 14, postTop - 18, leftCenter + 14, postTop - 18);
  g.fillTriangle(rightCenter, postTop - 40, rightCenter - 14, postTop - 18, rightCenter + 14, postTop - 18);
  g.fillCircle(cx, keyY - 10, 6);

  g.lineStyle(4, 0x6a6a72, 1);
  for (const hangX of [cx - 48, cx, cx + 48]) {
    g.lineBetween(hangX, cy + 8, hangX, cy + 86);
    g.strokeCircle(hangX, cy + 28, 6);
    g.strokeCircle(hangX, cy + 52, 6);
    g.strokeCircle(hangX, cy + 76, 6);
  }

  commit(g, `arena-gate-${theme}`, w, h);
}

function drawOnewayTile(scene: Phaser.Scene, theme: Theme): void {
  const c = tileColors(theme);
  const g = gfx(scene);
  g.fillStyle(c.dark, 1);
  g.fillRect(0, 0, TILE, 22);
  g.fillStyle(c.mid, 1);
  g.fillRect(2, 2, TILE - 4, 16);
  g.fillStyle(c.top, 1);
  g.fillRect(4, 3, TILE - 8, 8);
  g.fillStyle(0x000000, 0.18);
  g.fillRect(4, 14, TILE - 8, 4);
  commit(g, `tile-${theme}-oneway`, TILE, 22);
}

function drawTerrainHazards(scene: Phaser.Scene): void {
  for (const kind of TERRAIN_HAZARD_KINDS) {
    const g = gfx(scene);
    paintHazardSocket(g, kind);
    commit(g, `hazard-${kind}`, TILE, 80);
  }
  drawIceBeam(scene);
  drawSonarBeam(scene);
  drawFlameBeam(scene);
}

function paintHazardSocket(g: Phaser.GameObjects.Graphics, kind: TerrainHazardKind): void {
  switch (kind) {
    case 'bramble-vent':
      g.fillStyle(0x2d4a1c, 1);
      g.fillRoundedRect(10, 28, 44, 48, 10);
      g.fillStyle(0x4d7a2e, 1);
      g.fillRoundedRect(14, 32, 36, 40, 8);
      g.fillStyle(0x1a2e10, 1);
      g.fillEllipse(32, 44, 22, 16);
      g.fillStyle(0x7bc24a, 1);
      g.fillTriangle(18, 36, 12, 18, 26, 30);
      g.fillTriangle(46, 36, 52, 16, 38, 30);
      g.fillTriangle(32, 30, 28, 12, 38, 28);
      g.fillStyle(0x3e5c22, 1);
      g.fillRect(16, 62, 32, 12);
      return;
    case 'glacier-bore':
      g.fillStyle(0x6a93a8, 1);
      g.fillRoundedRect(8, 22, 48, 50, 8);
      g.fillStyle(0xc7efff, 1);
      g.fillRoundedRect(12, 26, 40, 42, 6);
      g.fillStyle(0x8ec8de, 1);
      g.fillRect(18, 36, 28, 22);
      g.fillStyle(0xffffff, 0.85);
      g.fillTriangle(20, 36, 32, 16, 44, 36);
      g.fillStyle(0x4f87a6, 1);
      g.fillEllipse(32, 48, 16, 10);
      return;
    case 'needle-mortar':
      g.fillStyle(0x8f602b, 1);
      g.fillRoundedRect(12, 30, 40, 46, 8);
      g.fillStyle(0xc4894a, 1);
      g.fillRoundedRect(16, 34, 32, 38, 6);
      g.fillStyle(0x3a5c22, 1);
      g.fillRect(26, 14, 12, 28);
      g.fillStyle(0x6ad08a, 1);
      g.fillTriangle(26, 18, 20, 8, 28, 16);
      g.fillTriangle(38, 18, 44, 6, 36, 16);
      g.fillStyle(0x5a3816, 1);
      g.fillEllipse(32, 48, 14, 10);
      return;
    case 'sonar-well':
      g.fillStyle(0x145a78, 1);
      g.fillCircle(32, 48, 26);
      g.fillStyle(0x2aa0b4, 1);
      g.fillCircle(32, 48, 20);
      g.fillStyle(0x0c3a44, 1);
      g.fillCircle(32, 48, 12);
      g.fillStyle(0x7eeaf2, 0.7);
      g.fillCircle(24, 40, 5);
      g.lineStyle(3, 0x55d8df, 0.8);
      g.strokeCircle(32, 48, 22);
      return;
    case 'keep-burner':
      g.fillStyle(0x2a1a22, 1);
      g.fillRoundedRect(8, 20, 48, 52, 6);
      g.fillStyle(0x5a3a48, 1);
      g.fillRoundedRect(12, 24, 40, 44, 4);
      g.fillStyle(0x1a1014, 1);
      g.fillEllipse(32, 46, 20, 14);
      g.fillStyle(0xff6a3a, 1);
      g.fillTriangle(22, 46, 32, 30, 42, 46);
      g.fillStyle(0xffcc33, 0.85);
      g.fillCircle(32, 44, 5);
      return;
    case 'pitcher-snare':
      g.fillStyle(0x1a3a1c, 1);
      g.fillEllipse(32, 62, 26, 12);
      g.fillStyle(0x2d6b3a, 1);
      g.fillRoundedRect(24, 36, 16, 28, 8);
      g.fillStyle(0x4d8a3e, 1);
      g.fillCircle(32, 30, 18);
      g.fillStyle(0x3b2350, 1);
      g.fillEllipse(32, 28, 16, 12);
      g.fillStyle(0x6ad08a, 1);
      g.fillTriangle(18, 34, 10, 22, 24, 30);
      g.fillTriangle(46, 34, 54, 20, 40, 30);
      return;
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

function drawIceBeam(scene: Phaser.Scene): void {
  const g = gfx(scene);
  g.fillStyle(0x9de8ff, 0.95);
  g.fillRoundedRect(0, 2, 64, 8, 3);
  g.fillStyle(0xffffff, 0.7);
  g.fillRoundedRect(4, 4, 56, 4, 2);
  commit(g, 'beam-ice', 64, 12);
}

function drawSonarBeam(scene: Phaser.Scene): void {
  const g = gfx(scene);
  g.fillStyle(0x55d8df, 0.55);
  g.fillRoundedRect(4, 0, 12, 64, 6);
  g.fillStyle(0xd8fbff, 0.45);
  g.fillRoundedRect(7, 4, 6, 56, 3);
  commit(g, 'beam-sonar', 20, 64);
}

function drawFlameBeam(scene: Phaser.Scene): void {
  const g = gfx(scene);
  g.fillStyle(0xc42618, 1);
  g.fillRoundedRect(0, 2, 64, 16, 6);
  g.fillStyle(0xff7a20, 1);
  g.fillRoundedRect(4, 5, 56, 10, 4);
  g.fillStyle(0xfff2a0, 0.9);
  g.fillRoundedRect(12, 8, 36, 4, 2);
  commit(g, 'beam-flame', 64, 20);
}

function drawLavaTile(scene: Phaser.Scene): void {
  const g = gfx(scene);
  g.fillStyle(0x4a0a0a, 1);
  g.fillRect(0, 0, TILE, TILE);
  g.fillStyle(0xe25822, 1);
  g.fillRect(0, 18, TILE, TILE - 18);
  g.fillStyle(0xffcc33, 1);
  g.fillEllipse(18, 28, 16, 10);
  g.fillEllipse(44, 40, 18, 12);
  g.fillStyle(0xfff1a8, 0.7);
  g.fillCircle(30, 24, 4);
  commit(g, 'tile-lava', TILE, TILE);
}

function drawParticle(scene: Phaser.Scene): void {
  const g = gfx(scene);
  g.fillStyle(0xdedede, 1);
  g.fillCircle(8, 8, 8);
  g.fillStyle(0x9a9a9a, 1);
  g.fillCircle(6, 6, 3);
  commit(g, 'poof-particle', 16, 16);
}

function drawFireworkSpark(scene: Phaser.Scene): void {
  const g = gfx(scene);
  g.fillStyle(0xfff4c0, 1);
  g.fillCircle(4, 4, 4);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(3, 3, 1.6);
  commit(g, 'firework-spark', 8, 8);
}

function starPoints(cx: number, cy: number, outer: number, inner: number): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
  }
  return points;
}

function drawStarRays(scene: Phaser.Scene): void {
  const g = gfx(scene);
  const cx = 64;
  const cy = 64;
  g.fillStyle(0xfff4b0, 0.22);
  g.fillCircle(cx, cy, 28);
  const rayCount = 12;
  for (let i = 0; i < rayCount; i += 1) {
    const long = i % 2 === 0;
    const angle = (i / rayCount) * Math.PI * 2;
    const inner = 18;
    const outer = long ? 62 : 44;
    const spread = long ? 0.1 : 0.065;
    g.fillStyle(long ? 0xfff6c0 : 0xffe066, long ? 0.8 : 0.48);
    g.fillTriangle(
      cx + Math.cos(angle) * inner,
      cy + Math.sin(angle) * inner,
      cx + Math.cos(angle - spread) * outer,
      cy + Math.sin(angle - spread) * outer,
      cx + Math.cos(angle + spread) * outer,
      cy + Math.sin(angle + spread) * outer,
    );
  }
  commit(g, 'star-rays', 128, 128);
}

function drawCampaignPickups(scene: Phaser.Scene): void {
  const star = gfx(scene);
  const cx = 36;
  const cy = 38;
  star.fillStyle(0xfff4b0, 0.32);
  star.fillCircle(cx, cy, 34);
  star.fillStyle(0x4a2408, 1);
  fillPoly(star, starPoints(cx, cy, 32, 13));
  star.fillStyle(0xf0c75a, 1);
  fillPoly(star, starPoints(cx, cy, 28, 11.5));
  star.fillStyle(0xffe88a, 1);
  fillPoly(star, starPoints(cx, cy, 18, 7.6));
  star.fillStyle(0xfffef0, 0.95);
  star.fillEllipse(cx - 7, cy - 8, 12, 7);
  star.fillCircle(cx + 8, cy + 2, 2.6);
  commit(star, 'star', 72, 72);
  drawStarRays(scene);

  const shield = gfx(scene);
  const sx = 32;
  const outline = heaterShieldPoints(sx, 4, 54, 66);
  const rim = heaterShieldPoints(sx, 8, 46, 58);
  const face = heaterShieldPoints(sx, 12, 38, 50);
  const panel = heaterShieldPoints(sx, 17, 28, 38);
  shield.fillStyle(0x55c8e8, 0.28);
  shield.fillEllipse(sx, 36, 56, 62);
  shield.fillStyle(0x0b1a30, 1);
  fillPoly(shield, outline);
  shield.fillStyle(0x2f7fa8, 1);
  fillPoly(shield, rim);
  shield.fillStyle(0x6ee4ff, 1);
  fillPoly(shield, face);
  shield.fillStyle(0x2bb4d8, 1);
  fillPoly(shield, panel);
  shield.fillStyle(0xd7fbff, 0.92);
  fillPoly(shield, [
    { x: sx - 10, y: 16 },
    { x: sx - 2, y: 15 },
    { x: sx - 4, y: 34 },
    { x: sx - 12, y: 32 },
  ]);
  shield.fillStyle(0x0b1a30, 1);
  shield.fillRect(sx - 4, 22, 8, 28);
  shield.fillRect(sx - 13, 32, 26, 8);
  shield.fillStyle(0xf7fdff, 1);
  shield.fillRect(sx - 2.4, 24, 4.8, 24);
  shield.fillRect(sx - 11, 34, 22, 4.4);
  const rivets = [
    { x: sx - 11, y: 22 },
    { x: sx + 11, y: 22 },
    { x: sx - 9, y: 48 },
    { x: sx + 9, y: 48 },
  ];
  for (const rivet of rivets) {
    shield.fillStyle(0x0b1a30, 1);
    shield.fillCircle(rivet.x, rivet.y, 2.4);
    shield.fillStyle(0xf0c75a, 1);
    shield.fillCircle(rivet.x, rivet.y, 1.5);
  }
  shield.fillStyle(0xfffef0, 0.95);
  shield.fillEllipse(sx - 8, 20, 12, 7);
  commit(shield, 'shield-pickup', 64, 74);
  drawHeldShield(scene);
  drawBossCrownGuard(scene);

  const checkpoint = gfx(scene);
  checkpoint.fillStyle(0x4b2e1f, 1);
  checkpoint.fillRect(5, 4, 5, 52);
  checkpoint.fillStyle(0xf2cc62, 1);
  checkpoint.fillTriangle(10, 6, 38, 15, 10, 27);
  checkpoint.fillStyle(0xfff0a8, 1);
  checkpoint.fillTriangle(12, 9, 30, 15, 12, 22);
  checkpoint.fillStyle(0x6b4b2a, 1);
  checkpoint.fillEllipse(8, 57, 18, 7);
  commit(checkpoint, 'checkpoint', 42, 62);
}

function drawSpecialBubble(scene: Phaser.Scene): void {
  const g = gfx(scene);
  const cx = 64;
  const cy = 64;
  const r = 60;
  g.fillStyle(0x7ae7f2, 0.2);
  g.fillCircle(cx, cy, r);
  g.fillStyle(0x2bb8d0, 0.14);
  g.fillCircle(cx + 2, cy + 6, r - 10);
  g.lineStyle(5, 0xe7fdff, 0.88);
  g.strokeCircle(cx, cy, r - 1.5);
  g.lineStyle(2.4, 0x5ad4e8, 0.5);
  g.strokeCircle(cx, cy, r - 7);
  g.fillStyle(0xffffff, 0.78);
  g.fillEllipse(cx - 18, cy - 22, 24, 15);
  g.fillStyle(0xffffff, 0.42);
  g.fillEllipse(cx - 28, cy - 6, 11, 7);
  g.fillStyle(0xffffff, 0.34);
  g.fillCircle(cx + 24, cy + 20, 5.5);
  commit(g, 'special-bubble', 128, 128);
}

function drawSpecialAnchor(scene: Phaser.Scene, theme: Theme): void {
  const colors: Record<Theme, [number, number]> = {
    grass: [0x2d6e35, 0x9be36e],
    snow: [0x4c8eb8, 0xe7fbff],
    desert: [0x9c6728, 0xf2cf72],
    ocean: [0x146c84, 0x83ebee],
    castle: [0x542e72, 0xc58cef],
    rainforest: [0x1e5a28, 0x8ee36d],
  };
  const [dark, bright] = colors[theme];
  const g = gfx(scene);
  g.fillStyle(dark, 0.95);
  g.fillEllipse(24, 30, 40, 16);
  g.fillStyle(bright, 0.95);
  g.fillTriangle(24, 4, 38, 30, 10, 30);
  g.fillStyle(0xffffff, 0.75);
  g.fillCircle(24, 20, 5);
  commit(g, `special-anchor-${theme}`, 48, 40);
}

function paintProjectile(g: Phaser.GameObjects.Graphics, style: ProjectileStyle): { w: number; h: number } {
  switch (style) {
    case 'thorn':
      return paintThornProjectile(g);
    case 'icicle':
      return paintIcicleProjectile(g);
    case 'cactus':
      return paintCactusProjectile(g);
    case 'bubble':
      return paintBubbleProjectile(g);
    case 'fireball':
      return paintFireballProjectile(g);
    case 'boomerang':
      return paintBoomerangProjectile(g);
    default: {
      const neverStyle: never = style;
      return neverStyle;
    }
  }
}

function paintThornProjectile(g: Phaser.GameObjects.Graphics): { w: number; h: number } {
  fillPoly(g.fillStyle(0x1c2414, 1), [
    { x: 2, y: 8 },
    { x: 12, y: 4 },
    { x: 28, y: 5 },
    { x: 40, y: 8 },
    { x: 44, y: 10 },
    { x: 40, y: 12 },
    { x: 26, y: 16 },
    { x: 11, y: 16 },
    { x: 2, y: 12 },
  ]);
  fillPoly(g.fillStyle(0x4a6b28, 1), [
    { x: 5, y: 9 },
    { x: 13, y: 6 },
    { x: 28, y: 7 },
    { x: 39, y: 9 },
    { x: 41, y: 10 },
    { x: 37, y: 12 },
    { x: 25, y: 14 },
    { x: 12, y: 14 },
    { x: 5, y: 11 },
  ]);
  fillPoly(g.fillStyle(0x86b84f, 1), [
    { x: 8, y: 9 },
    { x: 16, y: 7 },
    { x: 30, y: 8 },
    { x: 38, y: 10 },
    { x: 28, y: 12 },
    { x: 14, y: 12 },
  ]);
  g.fillStyle(0xe8f6c4, 0.9);
  g.fillEllipse(18, 8.5, 12, 3);
  fillPoly(g.fillStyle(0x2d4418, 1), [
    { x: 11, y: 13 },
    { x: 18, y: 14 },
    { x: 13, y: 20 },
  ]);
  fillPoly(g.fillStyle(0x6a9a3a, 1), [
    { x: 12, y: 13.5 },
    { x: 16, y: 14.2 },
    { x: 13, y: 18 },
  ]);
  g.fillStyle(0x1c2414, 1);
  g.fillCircle(9, 10, 1.2);
  return { w: 46, h: 22 };
}

function paintIcicleProjectile(g: Phaser.GameObjects.Graphics): { w: number; h: number } {
  fillPoly(g.fillStyle(0x1a3a52, 1), [
    { x: 1, y: 8 },
    { x: 10, y: 2 },
    { x: 28, y: 3 },
    { x: 44, y: 8 },
    { x: 46, y: 9 },
    { x: 30, y: 16 },
    { x: 12, y: 16 },
    { x: 2, y: 12 },
  ]);
  fillPoly(g.fillStyle(0x6ec4e0, 1), [
    { x: 4, y: 9 },
    { x: 12, y: 4 },
    { x: 28, y: 5 },
    { x: 42, y: 9 },
    { x: 29, y: 14 },
    { x: 12, y: 14 },
    { x: 5, y: 11 },
  ]);
  fillPoly(g.fillStyle(0xd8f6ff, 1), [
    { x: 8, y: 8 },
    { x: 16, y: 5 },
    { x: 30, y: 6 },
    { x: 38, y: 9 },
    { x: 24, y: 11 },
    { x: 10, y: 10 },
  ]);
  fillPoly(g.fillStyle(0x3d7fa0, 0.85), [
    { x: 14, y: 11 },
    { x: 28, y: 10 },
    { x: 32, y: 13 },
    { x: 16, y: 14 },
  ]);
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(11, 7, 1.6);
  g.fillEllipse(22, 7, 8, 2.4);
  return { w: 48, h: 18 };
}

function paintCactusProjectile(g: Phaser.GameObjects.Graphics): { w: number; h: number } {
  const cx = 21;
  const cy = 21;
  const spikes = 10;
  for (let i = 0; i < spikes; i += 1) {
    const angle = (i / spikes) * Math.PI * 2 - Math.PI / 2;
    const inner = 11;
    const outer = 19;
    const tipX = cx + Math.cos(angle) * outer;
    const tipY = cy + Math.sin(angle) * outer;
    const left = angle - 0.16;
    const right = angle + 0.16;
    g.fillStyle(0x2a2410, 1);
    g.fillTriangle(
      tipX,
      tipY,
      cx + Math.cos(left) * inner,
      cy + Math.sin(left) * inner,
      cx + Math.cos(right) * inner,
      cy + Math.sin(right) * inner,
    );
    g.fillStyle(0xf0d48a, 1);
    g.fillTriangle(
      cx + Math.cos(angle) * (outer - 2),
      cy + Math.sin(angle) * (outer - 2),
      cx + Math.cos(left) * (inner + 1),
      cy + Math.sin(left) * (inner + 1),
      cx + Math.cos(right) * (inner + 1),
      cy + Math.sin(right) * (inner + 1),
    );
  }
  g.fillStyle(0x1f2e12, 1);
  g.fillCircle(cx, cy, 12);
  g.fillStyle(0x4f8a2e, 1);
  g.fillCircle(cx, cy, 10);
  g.fillStyle(0x7cbc4a, 1);
  g.fillCircle(cx - 1, cy - 1, 7.5);
  g.fillStyle(0xd8f3a8, 0.85);
  g.fillEllipse(cx - 3, cy - 4, 6, 4);
  g.fillStyle(0x8a2a4a, 1);
  g.fillCircle(cx + 3, cy + 2, 2.4);
  g.fillStyle(0xf4a0c0, 1);
  g.fillCircle(cx + 3, cy + 2, 1.5);
  g.fillStyle(0xfff4c8, 1);
  g.fillCircle(cx + 3, cy + 2, 0.6);
  return { w: 42, h: 42 };
}

function paintBubbleProjectile(g: Phaser.GameObjects.Graphics): { w: number; h: number } {
  const cx = 19;
  const cy = 19;
  g.fillStyle(0x0c3a44, 0.35);
  g.fillCircle(cx, cy, 18);
  g.fillStyle(0x2aa0b4, 0.42);
  g.fillCircle(cx, cy, 16);
  g.fillStyle(0x7eeaf2, 0.5);
  g.fillCircle(cx, cy, 13);
  g.fillStyle(0xd8fbff, 0.28);
  g.fillCircle(cx + 1, cy + 2, 8);
  g.lineStyle(2, 0xb8f7ff, 0.7);
  g.strokeCircle(cx, cy, 15);
  g.fillStyle(0xffffff, 0.85);
  g.fillEllipse(cx - 5, cy - 6, 7, 4.5);
  g.fillCircle(cx + 6, cy - 2, 1.6);
  g.lineStyle(1.4, 0xffffff, 0.45);
  g.beginPath();
  g.arc(cx + 2, cy + 4, 6, 0.15 * Math.PI, 0.85 * Math.PI, false);
  g.strokePath();
  return { w: 38, h: 38 };
}

function paintFireballProjectile(g: Phaser.GameObjects.Graphics): { w: number; h: number } {
  const cx = 20;
  const cy = 20;
  g.fillStyle(0x4a0a08, 0.9);
  g.fillCircle(cx, cy, 18);
  g.fillStyle(0xc42618, 1);
  g.fillCircle(cx, cy, 15);
  g.fillStyle(0xf05a1a, 1);
  g.fillCircle(cx - 1, cy - 1, 12);
  g.fillStyle(0xffb024, 1);
  g.fillCircle(cx - 2, cy - 2, 8);
  g.fillStyle(0xfff2a0, 1);
  g.fillCircle(cx - 3, cy - 3, 4.2);
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(cx - 4, cy - 4, 1.8);
  g.fillStyle(0xff7a20, 1);
  g.fillCircle(cx + 11, cy + 4, 2.4);
  g.fillCircle(cx + 8, cy + 11, 1.8);
  g.fillStyle(0xffe080, 0.85);
  g.fillCircle(cx + 11, cy + 4, 1.1);
  return { w: 40, h: 40 };
}

function paintBoomerangProjectile(g: Phaser.GameObjects.Graphics): { w: number; h: number } {
  fillPoly(g.fillStyle(0x1c140c, 1), [
    { x: 3, y: 8 },
    { x: 16, y: 2 },
    { x: 30, y: 6 },
    { x: 36, y: 16 },
    { x: 44, y: 20 },
    { x: 42, y: 28 },
    { x: 32, y: 26 },
    { x: 24, y: 18 },
    { x: 16, y: 14 },
    { x: 6, y: 16 },
  ]);
  fillPoly(g.fillStyle(0x8a5a28, 1), [
    { x: 6, y: 9 },
    { x: 16, y: 5 },
    { x: 28, y: 8 },
    { x: 34, y: 16 },
    { x: 40, y: 21 },
    { x: 39, y: 25 },
    { x: 32, y: 23 },
    { x: 24, y: 16 },
    { x: 16, y: 13 },
    { x: 8, y: 14 },
  ]);
  fillPoly(g.fillStyle(0xc4894a, 1), [
    { x: 8, y: 9 },
    { x: 16, y: 6 },
    { x: 26, y: 9 },
    { x: 30, y: 14 },
    { x: 22, y: 14 },
    { x: 14, y: 11 },
  ]);
  g.lineStyle(1.2, 0x5a3816, 0.8);
  g.beginPath();
  g.moveTo(10, 10);
  g.lineTo(24, 10);
  g.moveTo(22, 12);
  g.lineTo(34, 20);
  g.strokePath();
  g.lineStyle(1.6, 0x2d6b3a, 1);
  g.beginPath();
  g.moveTo(12, 11);
  g.lineTo(18, 9);
  g.lineTo(24, 11);
  g.lineTo(30, 16);
  g.strokePath();
  g.fillStyle(0x6ad08a, 1);
  g.fillCircle(18, 9, 1.3);
  g.fillCircle(26, 12, 1.1);
  fillPoly(g.fillStyle(0xe8d9b8, 1), [
    { x: 3, y: 8 },
    { x: 9, y: 6 },
    { x: 8, y: 14 },
    { x: 4, y: 14 },
  ]);
  fillPoly(g.fillStyle(0xe8d9b8, 1), [
    { x: 40, y: 20 },
    { x: 45, y: 20 },
    { x: 44, y: 28 },
    { x: 38, y: 26 },
  ]);
  g.fillStyle(0xfff6e0, 0.85);
  g.fillCircle(6, 9, 1.2);
  g.fillCircle(42, 22, 1.2);
  return { w: 46, h: 32 };
}

function drawEnemyProjectiles(scene: Phaser.Scene): void {
  for (let world = 1; world <= 6; world += 1) {
    for (const kind of enemiesForWorld(world)) {
      const g = gfx(scene);
      const size = paintProjectile(g, projectileStyleForKind(kind));
      commit(g, `projectile-${kind}`, size.w, size.h);
    }
  }
}

function drawPuzzleTextures(scene: Phaser.Scene): void {
  const definitions: Array<{ key: string; dark: number; bright: number }> = [
    { key: 'vine-bed', dark: 0x28512e, bright: 0x83d46a },
    { key: 'ice-wall', dark: 0x4f87a6, bright: 0xd8f7ff },
    { key: 'sand-wall', dark: 0x8f602b, bright: 0xe7bd61 },
    { key: 'shadow-wall', dark: 0x3b2350, bright: 0xa96bd2 },
    { key: 'moss-curtain', dark: 0x1a3a1c, bright: 0x6ad08a },
  ];
  for (const definition of definitions) {
    const g = gfx(scene);
    g.fillStyle(definition.dark, 0.95);
    g.fillRoundedRect(3, 3, 58, 58, 8);
    g.fillStyle(definition.bright, 0.9);
    g.fillTriangle(32, 5, 54, 52, 10, 52);
    g.fillStyle(0xffffff, 0.45);
    g.fillEllipse(24, 22, 15, 8);
    g.lineStyle(3, definition.bright, 0.8);
    g.strokeRoundedRect(7, 7, 50, 50, 7);
    commit(g, `puzzle-${definition.key}`, 64, 64);
  }
  drawNoJumpZoneTextures(scene);
}

function drawNoJumpZoneTextures(scene: Phaser.Scene): void {
  const flow = gfx(scene);
  flow.fillStyle(0x063040, 1);
  flow.fillRect(0, 0, 64, 64);
  flow.fillStyle(0x0c5568, 0.95);
  flow.fillRect(10, 0, 14, 64);
  flow.fillRect(40, 0, 14, 64);
  flow.fillStyle(0x147888, 0.4);
  flow.fillRect(0, 0, 64, 64);
  const chevron = (cx: number, cy: number, spread: number, drop: number, color: number, alpha: number): void => {
    flow.fillStyle(color, alpha);
    flow.fillTriangle(cx, cy + drop, cx - spread, cy, cx + spread, cy);
  };
  for (const y of [2, 34]) {
    chevron(32, y, 22, 16, 0x9af6ff, 0.55);
    chevron(12, y + 16, 12, 11, 0x4ed4e4, 0.62);
    chevron(52, y + 16, 12, 11, 0x4ed4e4, 0.62);
  }
  flow.fillStyle(0xc4fbff, 0.4);
  flow.fillCircle(20, 12, 2.4);
  flow.fillCircle(48, 30, 2);
  flow.fillCircle(30, 52, 2.6);
  commit(flow, 'puzzle-down-current', 64, 64);

  const badge = gfx(scene);
  const c = 48;
  badge.fillStyle(0x071018, 0.45);
  badge.fillCircle(c + 3, c + 5, 43);
  badge.fillStyle(0xf7fcff, 1);
  badge.fillCircle(c, c, 41);
  badge.lineStyle(11, 0xc41c1c, 1);
  badge.strokeCircle(c, c, 35);

  badge.fillStyle(0x6a0810, 1);
  badge.fillRoundedRect(c - 14, c - 8, 28, 28, 5);
  badge.fillStyle(0xe23b3b, 1);
  badge.fillRoundedRect(c - 13, c - 10, 26, 26, 5);
  badge.fillStyle(0xff6a5a, 1);
  badge.fillRect(c - 13, c - 10, 26, 7);
  badge.fillStyle(0xffffff, 1);
  badge.fillCircle(c - 5, c - 1, 4.2);
  badge.fillCircle(c + 6, c - 1, 4.2);
  badge.fillStyle(0x140808, 1);
  badge.fillCircle(c - 4.2, c - 0.4, 2);
  badge.fillCircle(c + 6.8, c - 0.4, 2);

  badge.lineStyle(3.2, 0x1a1a1a, 0.9);
  badge.beginPath();
  badge.arc(c, c + 16, 20, Math.PI * 1.12, Math.PI * 1.82, false);
  badge.strokePath();
  badge.fillStyle(0x1a1a1a, 0.9);
  badge.fillTriangle(c + 14, c, c + 20, c + 8, c + 8, c + 6);

  badge.lineStyle(9, 0xc41c1c, 1);
  badge.lineBetween(c - 23, c + 20, c + 23, c - 18);
  badge.lineStyle(3, 0xfff6f2, 0.92);
  badge.lineBetween(c - 21, c + 18, c + 21, c - 16);
  commit(badge, 'puzzle-no-jump', 96, 96);
}

function drawBlastCore(scene: Phaser.Scene): void {
  const g = gfx(scene);
  const c = 48;
  g.fillStyle(0x6a0810, 0.95);
  g.fillCircle(c, c, 47);
  g.fillStyle(0xe23b3b, 1);
  g.fillCircle(c - 2, c + 1, 40);
  g.fillStyle(0xff4a1a, 1);
  g.fillCircle(c + 16, c - 12, 16);
  g.fillCircle(c - 18, c + 14, 15);
  g.fillCircle(c + 10, c + 20, 14);
  g.fillStyle(0xff6622, 1);
  g.fillCircle(c - 3, c - 2, 30);
  g.fillStyle(0xffcc33, 1);
  g.fillCircle(c - 6, c - 5, 20);
  g.fillStyle(0xfff4c8, 1);
  g.fillCircle(c - 9, c - 8, 11);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(c - 11, c - 10, 5);
  commit(g, 'blast-core', 96, 96);
}

function drawBlastRing(scene: Phaser.Scene): void {
  const g = gfx(scene);
  g.lineStyle(10, 0xfff1a8, 1);
  g.strokeCircle(48, 48, 38);
  g.lineStyle(6, 0xff6622, 0.95);
  g.strokeCircle(48, 48, 32);
  g.lineStyle(3, 0xe23b3b, 0.85);
  g.strokeCircle(48, 48, 26);
  commit(g, 'blast-ring', 96, 96);
}

function drawBlastSmoke(scene: Phaser.Scene): void {
  const g = gfx(scene);
  g.fillStyle(0x2a2018, 0.95);
  g.fillCircle(32, 38, 24);
  g.fillCircle(46, 28, 20);
  g.fillCircle(18, 26, 18);
  g.fillCircle(38, 18, 16);
  g.fillStyle(0x6a5a4a, 0.92);
  g.fillCircle(30, 30, 16);
  g.fillCircle(42, 24, 12);
  g.fillStyle(0xb8a090, 0.7);
  g.fillCircle(26, 22, 8);
  commit(g, 'blast-smoke', 64, 64);
}

function drawBlastSpark(scene: Phaser.Scene): void {
  const g = gfx(scene);
  g.fillStyle(0xfff8d0, 1);
  g.fillTriangle(6, 0, 10, 16, 2, 16);
  g.fillStyle(0xffcc33, 1);
  g.fillTriangle(6, 6, 9, 28, 3, 28);
  g.fillStyle(0xffffff, 1);
  g.fillRect(5, 2, 2, 10);
  commit(g, 'blast-spark', 12, 28);
}

function drawHeroShard(scene: Phaser.Scene, skin: HeroPalette): void {
  clearCanvasTexture(scene, 'hero-shard');
  const g = gfx(scene);
  g.fillStyle(skin.ink, 1);
  g.fillRoundedRect(0, 0, 16, 16, 3);
  g.fillStyle(skin.body, 1);
  g.fillRoundedRect(2, 2, 12, 12, 2);
  g.fillStyle(skin.shade, 1);
  g.fillRoundedRect(2, 9, 12, 5, { tl: 0, tr: 0, bl: 2, br: 2 });
  g.fillStyle(skin.gloss, 1);
  g.fillRect(3, 3, 6, 3);
  commit(g, 'hero-shard', 16, 16);
}

function drawHeldShield(scene: Phaser.Scene): void {
  const g = gfx(scene);
  const sx = 22;
  const outline = heaterShieldPoints(sx, 2, 40, 50);
  const rim = heaterShieldPoints(sx, 6, 32, 42);
  const face = heaterShieldPoints(sx, 9, 26, 36);
  g.fillStyle(0x6ee4ff, 0.2);
  g.fillEllipse(sx, 26, 40, 46);
  g.fillStyle(0x0b1a30, 0.55);
  fillPoly(g, outline);
  g.fillStyle(0x2f7fa8, 0.72);
  fillPoly(g, rim);
  g.fillStyle(0x8df2ff, 0.58);
  fillPoly(g, face);
  g.fillStyle(0xf7fdff, 0.92);
  g.fillRect(sx - 2, 14, 4, 22);
  g.fillRect(sx - 9, 23, 18, 4);
  g.fillStyle(0xfffef0, 0.8);
  g.fillEllipse(sx - 6, 12, 10, 6);
  commit(g, 'player-shield', 44, 54);
}

function drawBossCrownGuard(scene: Phaser.Scene): void {
  const g = gfx(scene);
  const cx = 40;
  g.fillStyle(0xffe08a, 0.2);
  g.fillEllipse(cx, 36, 76, 64);
  const outline = heaterShieldPoints(cx, 4, 70, 64);
  const rim = heaterShieldPoints(cx, 8, 60, 56);
  const face = heaterShieldPoints(cx, 12, 50, 48);
  g.fillStyle(0x3a1808, 0.55);
  fillPoly(g, outline);
  g.fillStyle(0xf0c75a, 0.72);
  fillPoly(g, rim);
  g.fillStyle(0xffe08a, 0.38);
  fillPoly(g, face);
  g.fillStyle(0xfff8d0, 0.7);
  g.fillRect(cx - 2.2, 18, 4.4, 30);
  g.fillRect(cx - 12, 30, 24, 4.4);
  g.fillStyle(0xfffef0, 0.5);
  g.fillEllipse(cx - 10, 18, 16, 9);
  commit(g, 'boss-crown-guard', 80, 72);
}

function heaterShieldPoints(
  cx: number,
  top: number,
  width: number,
  height: number,
): Array<{ x: number; y: number }> {
  const half = width / 2;
  return [
    { x: cx - half * 0.62, y: top },
    { x: cx + half * 0.62, y: top },
    { x: cx + half * 0.96, y: top + height * 0.1 },
    { x: cx + half, y: top + height * 0.22 },
    { x: cx + half * 0.96, y: top + height * 0.4 },
    { x: cx + half * 0.7, y: top + height * 0.62 },
    { x: cx + half * 0.38, y: top + height * 0.82 },
    { x: cx, y: top + height },
    { x: cx - half * 0.38, y: top + height * 0.82 },
    { x: cx - half * 0.7, y: top + height * 0.62 },
    { x: cx - half * 0.96, y: top + height * 0.4 },
    { x: cx - half, y: top + height * 0.22 },
    { x: cx - half * 0.96, y: top + height * 0.1 },
  ];
}

function fillPoly(g: Phaser.GameObjects.Graphics, points: Array<{ x: number; y: number }>): void {
  const first = points[0];
  if (!first) {
    return;
  }
  g.beginPath();
  g.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i += 1) {
    const point = points[i];
    if (!point) {
      continue;
    }
    g.lineTo(point.x, point.y);
  }
  g.closePath();
  g.fillPath();
}

function drawFlakChunk(scene: Phaser.Scene): void {
  const g = gfx(scene);
  g.fillStyle(0x3a070a, 1);
  fillPoly(g, [
    { x: 2, y: 7 },
    { x: 9, y: 1 },
    { x: 23, y: 3 },
    { x: 26, y: 16 },
    { x: 18, y: 25 },
    { x: 4, y: 22 },
  ]);
  g.fillStyle(0xa61a22, 1);
  fillPoly(g, [
    { x: 4, y: 8 },
    { x: 10, y: 3 },
    { x: 21, y: 5 },
    { x: 24, y: 15 },
    { x: 17, y: 23 },
    { x: 5, y: 20 },
  ]);
  g.fillStyle(0xe23b3b, 1);
  fillPoly(g, [
    { x: 6, y: 9 },
    { x: 11, y: 5 },
    { x: 20, y: 7 },
    { x: 22, y: 15 },
    { x: 16, y: 21 },
    { x: 7, y: 18 },
  ]);
  g.fillStyle(0xffc2c4, 0.92);
  fillPoly(g, [
    { x: 8, y: 8 },
    { x: 14, y: 6 },
    { x: 16, y: 11 },
    { x: 10, y: 12 },
  ]);
  g.fillStyle(0xf0c75a, 1);
  g.fillCircle(9, 10, 2.2);
  g.fillStyle(0xfff6e8, 0.9);
  g.fillCircle(8.3, 9.3, 0.8);
  commit(g, 'flak-chunk', 28, 26);
}

function drawFlakShard(scene: Phaser.Scene): void {
  const g = gfx(scene);
  g.fillStyle(0x3a070a, 1);
  fillPoly(g, [
    { x: 10, y: 1 },
    { x: 21, y: 14 },
    { x: 12, y: 23 },
    { x: 1, y: 16 },
  ]);
  g.fillStyle(0xc42c32, 1);
  fillPoly(g, [
    { x: 10, y: 3 },
    { x: 19, y: 14 },
    { x: 12, y: 21 },
    { x: 3, y: 16 },
  ]);
  g.fillStyle(0xe23b3b, 1);
  fillPoly(g, [
    { x: 10, y: 5 },
    { x: 17, y: 14 },
    { x: 12, y: 19 },
    { x: 5, y: 15 },
  ]);
  g.fillStyle(0xff8a90, 0.9);
  fillPoly(g, [
    { x: 10, y: 6 },
    { x: 14, y: 12 },
    { x: 9, y: 13 },
  ]);
  commit(g, 'flak-shard', 22, 24);
}

function drawFlakSliver(scene: Phaser.Scene): void {
  const g = gfx(scene);
  g.fillStyle(0x3a070a, 1);
  fillPoly(g, [
    { x: 5, y: 1 },
    { x: 11, y: 3 },
    { x: 8, y: 27 },
    { x: 2, y: 24 },
  ]);
  g.fillStyle(0xa61a22, 1);
  fillPoly(g, [
    { x: 6, y: 2 },
    { x: 10, y: 4 },
    { x: 7, y: 25 },
    { x: 3, y: 23 },
  ]);
  g.fillStyle(0xe23b3b, 1);
  fillPoly(g, [
    { x: 6.5, y: 4 },
    { x: 9, y: 6 },
    { x: 7, y: 23 },
    { x: 4.5, y: 21 },
  ]);
  g.fillStyle(0xffc2c4, 0.85);
  g.fillRect(6, 5, 3, 6);
  commit(g, 'flak-sliver', 12, 28);
}

function drawFlakChar(scene: Phaser.Scene): void {
  const g = gfx(scene);
  g.fillStyle(0x140808, 1);
  fillPoly(g, [
    { x: 2, y: 6 },
    { x: 12, y: 1 },
    { x: 21, y: 8 },
    { x: 18, y: 18 },
    { x: 4, y: 17 },
  ]);
  g.fillStyle(0x4a1014, 1);
  fillPoly(g, [
    { x: 4, y: 7 },
    { x: 12, y: 3 },
    { x: 19, y: 9 },
    { x: 16, y: 16 },
    { x: 5, y: 15 },
  ]);
  g.fillStyle(0x8e1a20, 1);
  fillPoly(g, [
    { x: 6, y: 8 },
    { x: 12, y: 5 },
    { x: 17, y: 10 },
    { x: 14, y: 14 },
    { x: 7, y: 13 },
  ]);
  g.fillStyle(0x2a0c10, 0.8);
  g.fillCircle(9, 11, 2.4);
  g.fillCircle(14, 8, 1.6);
  commit(g, 'flak-char', 22, 20);
}

function drawFlakGold(scene: Phaser.Scene): void {
  const g = gfx(scene);
  g.fillStyle(0x3a070a, 1);
  g.fillCircle(8, 8, 7.5);
  g.fillStyle(0xb07a22, 1);
  g.fillCircle(8, 8, 6.2);
  g.fillStyle(0xf0c75a, 1);
  g.fillCircle(8, 8, 4.6);
  g.fillStyle(0xfff6e8, 0.95);
  g.fillCircle(6.4, 6.2, 1.6);
  g.fillStyle(0x5a0c12, 1);
  g.fillRect(7, 6, 2, 4);
  g.fillRect(6, 8, 4, 1);
  commit(g, 'flak-gold', 16, 16);
}

function drawFlakPieces(scene: Phaser.Scene): void {
  drawFlakChunk(scene);
  drawFlakShard(scene);
  drawFlakSliver(scene);
  drawFlakChar(scene);
  drawFlakGold(scene);
}

function drawCartoonStar(scene: Phaser.Scene): void {
  const g = gfx(scene);
  const c = 12;
  g.fillStyle(0xf0c75a, 1);
  g.fillTriangle(c, 0, c + 4, c, c - 4, c);
  g.fillTriangle(c, 24, c + 4, c, c - 4, c);
  g.fillTriangle(0, c, c, c - 4, c, c + 4);
  g.fillTriangle(24, c, c, c - 4, c, c + 4);
  g.fillStyle(0xfff8d0, 1);
  g.fillCircle(c, c, 4);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(c - 1, c - 1, 1.4);
  commit(g, 'cartoon-star', 24, 24);
}

function drawMapToken(scene: Phaser.Scene, skin: HeroPalette): void {
  clearCanvasTexture(scene, 'map-token');
  const g = gfx(scene);
  g.fillStyle(skin.ink, 1);
  g.fillRoundedRect(1, 2, 22, 19, 5);
  g.fillStyle(skin.body, 1);
  g.fillRoundedRect(3, 4, 18, 15, 3);
  g.fillStyle(skin.shade, 1);
  g.fillRoundedRect(3, 13, 18, 6, { tl: 0, tr: 0, bl: 3, br: 3 });
  g.fillStyle(skin.gloss, 1);
  g.fillRoundedRect(5, 5, 8, 4, 2);
  g.fillStyle(skin.ink, 1);
  g.fillEllipse(8, 10, 6, 7);
  g.fillEllipse(16, 10, 6, 7);
  g.fillStyle(HERO_EYE, 1);
  g.fillEllipse(8, 10, 4, 5);
  g.fillEllipse(16, 10, 4, 5);
  g.fillStyle(HERO_PUPIL, 1);
  g.fillCircle(9, 11, 1.6);
  g.fillCircle(17, 11, 1.6);
  g.fillStyle(skin.boot, 1);
  g.fillRoundedRect(5, 20, 6, 3, 1);
  g.fillRoundedRect(13, 20, 6, 3, 1);
  commit(g, 'map-token', 24, 24);
}

function drawNode(scene: Phaser.Scene): void {
  const g = gfx(scene);
  g.fillStyle(0x222222, 1);
  g.fillCircle(16, 16, 16);
  g.fillStyle(0xf5e6c8, 1);
  g.fillCircle(16, 16, 13);
  commit(g, 'map-node', 32, 32);
}

function drawLockedNode(scene: Phaser.Scene): void {
  const g = gfx(scene);
  g.fillStyle(0x111111, 1);
  g.fillCircle(16, 16, 16);
  g.fillStyle(0x666666, 1);
  g.fillCircle(16, 16, 13);
  commit(g, 'map-node-locked', 32, 32);
}

export function createGameTextures(scene: Phaser.Scene): void {
  applySkin(scene, loadSave().equippedSkin);
  stampSkinThumbs(scene);
  drawBaddie(scene, 'baddie', 36, 0x2a2a2a, 0x5a5a5a, 0xff2020);
  drawBaddie(scene, 'baddie-alt', 36, 0x3a3a3a, 0x6e6e6e, 0xff3030);
  drawBaddie(scene, 'mini-boss', 56, 0x1f1f1f, 0x4a4a4a, 0xff1515);
  createEnemyTextures(scene);
  createMiniBossTextures(scene);
  createWorldBossTextures(scene);
  drawLavaTile(scene);
  drawTerrainHazards(scene);
  drawParticle(scene);
  drawFireworkSpark(scene);
  drawCampaignPickups(scene);
  drawEnemyProjectiles(scene);
  drawPuzzleTextures(scene);
  drawBlastCore(scene);
  drawBlastRing(scene);
  drawBlastSmoke(scene);
  drawBlastSpark(scene);
  drawFlakPieces(scene);
  drawCartoonStar(scene);
  drawSpecialBubble(scene);
  createLandscapeTextures(scene);
  createForegroundTextures(scene);
  drawNode(scene);
  drawLockedNode(scene);

  for (const theme of THEMES) {
    drawSpecialAnchor(scene, theme);
    drawSolidTile(scene, theme);
    drawOnewayTile(scene, theme);
    drawArenaTile(scene, theme);
    drawArenaGateTile(scene, theme);
    drawArenaWallTile(scene, theme);
    drawArenaRing(scene, theme);
    drawArenaBanner(scene, theme);
    drawArenaTorch(scene, theme);
    drawArenaGate(scene, theme);
  }
}

export function solidTileKey(theme: Theme): string {
  return `tile-${theme}-solid`;
}

export function onewayTileKey(theme: Theme): string {
  return `tile-${theme}-oneway`;
}

export function arenaTileKey(theme: Theme): string {
  return `tile-${theme}-arena`;
}

export function arenaGateTileKey(theme: Theme): string {
  return `tile-${theme}-gate`;
}

export function arenaWallTileKey(theme: Theme): string {
  return `tile-${theme}-wall`;
}

export function arenaRingKey(theme: Theme): string {
  return `arena-ring-${theme}`;
}

export function arenaBannerKey(theme: Theme): string {
  return `arena-banner-${theme}`;
}

export function arenaTorchKey(theme: Theme): string {
  return `arena-torch-${theme}`;
}

export function arenaGateKey(theme: Theme): string {
  return `arena-gate-${theme}`;
}

export function kenneyArenaGateKey(theme: Theme): string {
  switch (theme) {
    case 'grass':
    case 'desert':
    case 'rainforest':
      return 'kenney-brick-brown';
    case 'snow':
    case 'ocean':
    case 'castle':
      return 'kenney-brick-grey';
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

export function kenneyArenaWallKey(theme: Theme): string {
  switch (theme) {
    case 'grass':
    case 'desert':
    case 'rainforest':
      return 'kenney-bricks-brown';
    case 'snow':
    case 'ocean':
    case 'castle':
      return 'kenney-bricks-grey';
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

export type ArenaFlagColor = 'red' | 'green' | 'blue' | 'yellow';

export function arenaFlagColor(theme: Theme): ArenaFlagColor {
  switch (theme) {
    case 'grass':
    case 'rainforest':
      return 'green';
    case 'snow':
    case 'ocean':
      return 'blue';
    case 'desert':
      return 'yellow';
    case 'castle':
      return 'red';
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

export function kenneyArenaFlagKeys(theme: Theme): { a: string; b: string } {
  const color = arenaFlagColor(theme);
  return { a: `kenney-flag-${color}-a`, b: `kenney-flag-${color}-b` };
}

export function kenneyTorchKeys(): { a: string; b: string } {
  return { a: 'kenney-torch-a', b: 'kenney-torch-b' };
}

export function kenneyWindowKey(): string {
  return 'kenney-window';
}

export function bossTextureKey(kind: BossKind): string {
  return worldBossTextureKey(kind, 'idle');
}

