import Phaser from 'phaser';
import { TILE, type EnemyKind, type Theme } from '../config';
import { createLandscapeTextures } from './landscapes';

function gfx(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  return scene.make.graphics({ x: 0, y: 0 });
}

function commit(g: Phaser.GameObjects.Graphics, key: string, w: number, h: number): void {
  g.generateTexture(key, w, h);
  g.destroy();
}

const HERO_SIZE = 48;

type HeroPose = 'idle' | 'blink' | 'run-a' | 'run-b' | 'jump' | 'fall' | 'dead';

const HERO = {
  ink: 0x1a0808,
  body: 0xff3d42,
  shade: 0xc41c28,
  gloss: 0xff9aa0,
  eye: 0xffffff,
  pupil: 0x140808,
  mouth: 0x1a0808,
  boot: 0x2a1814,
  bootSole: 0x140808,
} as const;

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

function paintHeroMouth(g: Phaser.GameObjects.Graphics, cx: number, cy: number, pose: HeroPose): void {
  switch (pose) {
    case 'idle':
    case 'blink':
      g.lineStyle(3, HERO.mouth, 1);
      g.beginPath();
      g.arc(cx, cy - 1, 6, 0.15 * Math.PI, 0.85 * Math.PI, false);
      g.strokePath();
      break;
    case 'run-a':
    case 'run-b':
      g.fillStyle(HERO.mouth, 1);
      g.fillRoundedRect(cx - 5, cy + 1, 10, 3, 1.5);
      break;
    case 'jump':
      g.fillStyle(HERO.mouth, 1);
      g.fillEllipse(cx, cy + 1, 9, 9);
      g.fillStyle(HERO.shade, 1);
      g.fillEllipse(cx, cy + 1.5, 5, 5);
      break;
    case 'fall':
      g.lineStyle(3, HERO.mouth, 1);
      g.beginPath();
      g.arc(cx, cy + 5, 6, 1.12 * Math.PI, 1.88 * Math.PI, false);
      g.strokePath();
      break;
    case 'dead':
      g.fillStyle(HERO.mouth, 1);
      g.fillEllipse(cx, cy + 1, 10, 6);
      g.fillStyle(HERO.shade, 1);
      g.fillEllipse(cx, cy + 1.5, 6, 3);
      break;
    default: {
      const neverPose: never = pose;
      return neverPose;
    }
  }
}

function paintHeroFeet(g: Phaser.GameObjects.Graphics, pose: HeroPose): void {
  const tucked = pose === 'jump';
  const dangled = pose === 'fall';
  const splayed = pose === 'dead';
  const runShift = pose === 'run-a' ? -3 : pose === 'run-b' ? 3 : 0;
  const y = tucked ? 36 : dangled || splayed ? 41 : 39;
  const h = tucked ? 7 : dangled || splayed ? 8 : 8;
  const w = 13;
  const leftX = splayed ? 2 : 7 + runShift;
  const rightX = splayed ? 33 : 28 - runShift;
  g.fillStyle(HERO.ink, 1);
  g.fillRoundedRect(leftX, y, w, h, 3);
  g.fillRoundedRect(rightX, y, w, h, 3);
  g.fillStyle(HERO.boot, 1);
  g.fillRoundedRect(leftX + 1, y, w - 2, h - 2, 2);
  g.fillRoundedRect(rightX + 1, y, w - 2, h - 2, 2);
  g.fillStyle(HERO.bootSole, 1);
  g.fillRect(leftX + 1, y + h - 3, w - 2, 2);
  g.fillRect(rightX + 1, y + h - 3, w - 2, 2);
}

function paintHeroEye(g: Phaser.GameObjects.Graphics, x: number, y: number, metrics: EyeMetrics): void {
  const outlineW = metrics.w + 4;
  const outlineH = metrics.open <= 0 ? 6 : metrics.h + 4;

  if (metrics.cross) {
    g.fillStyle(HERO.ink, 1);
    g.fillEllipse(x, y, outlineW, outlineH);
    g.fillStyle(HERO.eye, 1);
    g.fillEllipse(x, y, metrics.w, metrics.h);
    g.lineStyle(3, HERO.ink, 1);
    g.beginPath();
    g.moveTo(x - 5, y - 5);
    g.lineTo(x + 5, y + 5);
    g.moveTo(x + 5, y - 5);
    g.lineTo(x - 5, y + 5);
    g.strokePath();
    return;
  }

  if (metrics.open <= 0) {
    g.fillStyle(HERO.ink, 1);
    g.fillRoundedRect(x - metrics.w / 2 - 1, y - 2, metrics.w + 2, 5, 2);
    g.fillStyle(HERO.shade, 1);
    g.fillRoundedRect(x - metrics.w / 2, y - 1, metrics.w, 2, 1);
    return;
  }

  g.fillStyle(HERO.ink, 1);
  g.fillEllipse(x, y, outlineW, outlineH);
  g.fillStyle(HERO.eye, 1);
  g.fillEllipse(x, y, metrics.w, metrics.h);
  g.fillStyle(HERO.pupil, 1);
  g.fillEllipse(x + metrics.lookX, y + metrics.lookY, metrics.w * 0.52, metrics.h * 0.58);
  g.fillStyle(HERO.eye, 1);
  g.fillCircle(x + metrics.lookX - 2.2, y + metrics.lookY - 2.6, 2.2);

  const browY = y - metrics.h * 0.62 + metrics.browLift;
  g.fillStyle(HERO.ink, 1);
  g.fillRoundedRect(x - 6, browY, 12, 2, 1);
}

function paintHeroSquare(g: Phaser.GameObjects.Graphics, pose: HeroPose): void {
  const cx = HERO_SIZE / 2;
  paintHeroFeet(g, pose);

  g.fillStyle(HERO.ink, 1);
  g.fillRoundedRect(1, 1, 46, 40, 8);
  g.fillStyle(HERO.body, 1);
  g.fillRoundedRect(5, 5, 38, 32, 5);
  g.fillStyle(HERO.shade, 1);
  g.fillRoundedRect(5, 24, 38, 13, { tl: 0, tr: 0, bl: 5, br: 5 });
  g.fillStyle(HERO.gloss, 1);
  g.fillRoundedRect(7, 6, 11, 5, { tl: 3, tr: 2, bl: 2, br: 2 });

  const faceY = pose === 'jump' ? 18 : pose === 'fall' || pose === 'dead' ? 21 : 19;
  const eyes = heroEyes(pose);
  paintHeroEye(g, 16, faceY, eyes);
  paintHeroEye(g, 32, faceY, eyes);
  paintHeroMouth(g, cx, faceY + 13, pose);
}

function stampHero(scene: Phaser.Scene, key: string, pose: HeroPose): void {
  const g = gfx(scene);
  paintHeroSquare(g, pose);
  commit(g, key, HERO_SIZE, HERO_SIZE);
}

function drawPlayer(scene: Phaser.Scene): void {
  stampHero(scene, 'player', 'idle');
  stampHero(scene, 'player-blink', 'blink');
  stampHero(scene, 'player-run-a', 'run-a');
  stampHero(scene, 'player-run-b', 'run-b');
  stampHero(scene, 'player-jump', 'jump');
  stampHero(scene, 'player-fall', 'fall');
  stampHero(scene, 'player-dead', 'dead');
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

function drawSpikedBoss(scene: Phaser.Scene, key: string, size: number, body: number, shade: number): void {
  const g = gfx(scene);
  const r = size / 2;
  g.fillStyle(0x1a0505, 1);
  for (let i = 0; i < 8; i += 1) {
    const a = (Math.PI * 2 * i) / 8;
    g.fillTriangle(
      r + Math.cos(a) * r,
      r + Math.sin(a) * r,
      r + Math.cos(a - 0.25) * r * 0.72,
      r + Math.sin(a - 0.25) * r * 0.72,
      r + Math.cos(a + 0.25) * r * 0.72,
      r + Math.sin(a + 0.25) * r * 0.72,
    );
  }
  g.fillStyle(body, 1);
  g.fillCircle(r, r, r * 0.72);
  g.fillStyle(shade, 1);
  g.fillCircle(r - r * 0.16, r - r * 0.18, r * 0.28);
  const eyeY = r - 4;
  g.fillStyle(0xffffff, 1);
  g.fillEllipse(r - 10, eyeY, 8, 12);
  g.fillEllipse(r + 10, eyeY, 8, 12);
  g.fillStyle(0xff1a1a, 1);
  g.fillEllipse(r - 10, eyeY + 1, 4, 7);
  g.fillEllipse(r + 10, eyeY + 1, 4, 7);
  commit(g, key, size, size);
}

function drawFinBoss(scene: Phaser.Scene, key: string, size: number): void {
  const g = gfx(scene);
  const r = size / 2;
  g.fillStyle(0x062033, 1);
  g.fillTriangle(r, 4, r + 18, r, r - 18, r);
  g.fillStyle(0x1c4d66, 1);
  g.fillCircle(r, r + 6, r * 0.7);
  g.fillStyle(0x2f6f88, 1);
  g.fillCircle(r - 8, r, r * 0.28);
  g.fillStyle(0xffffff, 1);
  g.fillEllipse(r - 10, r, 8, 12);
  g.fillEllipse(r + 10, r, 8, 12);
  g.fillStyle(0xff2222, 1);
  g.fillCircle(r - 10, r + 1, 3);
  g.fillCircle(r + 10, r + 1, 3);
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
  const postFill = theme === 'grass' ? a.pole : m.brick;
  const postAlt = theme === 'grass' ? 0x8a5a28 : m.brickAlt;
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

function drawCampaignPickups(scene: Phaser.Scene): void {
  const memory = gfx(scene);
  memory.fillStyle(0x173f2b, 1);
  memory.fillEllipse(16, 20, 22, 18);
  memory.fillStyle(0x65c96d, 1);
  memory.fillEllipse(12, 16, 13, 18);
  memory.fillStyle(0xa8ed83, 1);
  memory.fillEllipse(20, 12, 12, 16);
  memory.fillStyle(0xffe88f, 1);
  memory.fillCircle(17, 17, 4);
  memory.lineStyle(3, 0x3f7f46, 1);
  memory.lineBetween(16, 20, 16, 31);
  commit(memory, 'memory-sprout', 32, 36);

  const shield = gfx(scene);
  shield.fillStyle(0x12233f, 1);
  shield.fillTriangle(24, 2, 45, 10, 38, 38);
  shield.fillTriangle(24, 2, 3, 10, 10, 38);
  shield.fillStyle(0x55c8e8, 1);
  shield.fillTriangle(24, 6, 40, 12, 34, 34);
  shield.fillTriangle(24, 6, 8, 12, 14, 34);
  shield.fillStyle(0xd7fbff, 0.9);
  shield.fillEllipse(19, 14, 10, 6);
  commit(shield, 'shield-pickup', 48, 42);

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

function drawSpecialAnchor(scene: Phaser.Scene, theme: Theme): void {
  const colors: Record<Theme, [number, number]> = {
    grass: [0x2d6e35, 0x9be36e],
    snow: [0x4c8eb8, 0xe7fbff],
    desert: [0x9c6728, 0xf2cf72],
    ocean: [0x146c84, 0x83ebee],
    castle: [0x542e72, 0xc58cef],
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

function projectileColor(kind: EnemyKind): number {
  switch (kind) {
    case 'bramble-hopper':
    case 'acorn-slinger':
    case 'mossback-beetle':
      return 0x77b84d;
    case 'skating-hare':
    case 'snowball-finch':
    case 'frost-mole':
      return 0xc7efff;
    case 'dune-scarab':
    case 'cactus-imp':
    case 'sandwyrm':
      return 0xe0ad45;
    case 'reef-crab':
    case 'bubble-archerfish':
    case 'angler-eel':
      return 0x55d8df;
    case 'clockwork-hound':
    case 'gargoyle-page':
    case 'wall-mimic':
      return 0xbd63e6;
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

function drawEnemyProjectiles(scene: Phaser.Scene): void {
  const kinds: EnemyKind[] = [
    'bramble-hopper',
    'acorn-slinger',
    'mossback-beetle',
    'skating-hare',
    'snowball-finch',
    'frost-mole',
    'dune-scarab',
    'cactus-imp',
    'sandwyrm',
    'reef-crab',
    'bubble-archerfish',
    'angler-eel',
    'clockwork-hound',
    'gargoyle-page',
    'wall-mimic',
  ];
  for (const kind of kinds) {
    const g = gfx(scene);
    const color = projectileColor(kind);
    g.fillStyle(0x17202a, 1);
    g.fillTriangle(16, 1, 31, 18, 2, 25);
    g.fillStyle(color, 1);
    g.fillTriangle(16, 4, 27, 17, 5, 22);
    g.fillStyle(0xffffff, 0.75);
    g.fillEllipse(13, 10, 8, 5);
    commit(g, `projectile-${kind}`, 32, 28);
  }
}

function drawPuzzleTextures(scene: Phaser.Scene): void {
  const definitions: Array<{ key: string; dark: number; bright: number }> = [
    { key: 'vine-bed', dark: 0x28512e, bright: 0x83d46a },
    { key: 'ice-wall', dark: 0x4f87a6, bright: 0xd8f7ff },
    { key: 'sand-wall', dark: 0x8f602b, bright: 0xe7bd61 },
    { key: 'down-current', dark: 0x12546b, bright: 0x65d9e5 },
    { key: 'shadow-wall', dark: 0x3b2350, bright: 0xa96bd2 },
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

function drawHeroShard(scene: Phaser.Scene): void {
  const g = gfx(scene);
  g.fillStyle(HERO.ink, 1);
  g.fillRoundedRect(0, 0, 16, 16, 3);
  g.fillStyle(HERO.body, 1);
  g.fillRoundedRect(2, 2, 12, 12, 2);
  g.fillStyle(HERO.shade, 1);
  g.fillRoundedRect(2, 9, 12, 5, { tl: 0, tr: 0, bl: 2, br: 2 });
  g.fillStyle(HERO.gloss, 1);
  g.fillRect(3, 3, 6, 3);
  commit(g, 'hero-shard', 16, 16);
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

function drawMapToken(scene: Phaser.Scene): void {
  const g = gfx(scene);
  g.fillStyle(HERO.ink, 1);
  g.fillRoundedRect(1, 2, 22, 19, 5);
  g.fillStyle(HERO.body, 1);
  g.fillRoundedRect(3, 4, 18, 15, 3);
  g.fillStyle(HERO.shade, 1);
  g.fillRoundedRect(3, 13, 18, 6, { tl: 0, tr: 0, bl: 3, br: 3 });
  g.fillStyle(HERO.gloss, 1);
  g.fillRoundedRect(5, 5, 8, 4, 2);
  g.fillStyle(HERO.ink, 1);
  g.fillEllipse(8, 10, 6, 7);
  g.fillEllipse(16, 10, 6, 7);
  g.fillStyle(HERO.eye, 1);
  g.fillEllipse(8, 10, 4, 5);
  g.fillEllipse(16, 10, 4, 5);
  g.fillStyle(HERO.pupil, 1);
  g.fillCircle(9, 11, 1.6);
  g.fillCircle(17, 11, 1.6);
  g.fillStyle(HERO.boot, 1);
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
  drawPlayer(scene);
  drawBaddie(scene, 'baddie', 36, 0x2a2a2a, 0x5a5a5a, 0xff2020);
  drawBaddie(scene, 'baddie-alt', 36, 0x3a3a3a, 0x6e6e6e, 0xff3030);
  drawBaddie(scene, 'mini-boss', 56, 0x1f1f1f, 0x4a4a4a, 0xff1515);
  drawBaddie(scene, 'boss-hopper', 88, 0x2b1a1a, 0x5a3030, 0xff1010);
  drawBaddie(scene, 'boss-slider', 88, 0x1a2a3a, 0x4a6a88, 0xff2020);
  drawSpikedBoss(scene, 'boss-slam', 96, 0x5a3a10, 0xc4a05a);
  drawFinBoss(scene, 'boss-swimmer', 96);
  drawSpikedBoss(scene, 'boss-charger', 104, 0x2a1020, 0x6a2040);
  drawLavaTile(scene);
  drawParticle(scene);
  drawCampaignPickups(scene);
  drawEnemyProjectiles(scene);
  drawPuzzleTextures(scene);
  drawBlastCore(scene);
  drawBlastRing(scene);
  drawBlastSmoke(scene);
  drawBlastSpark(scene);
  drawHeroShard(scene);
  drawFlakPieces(scene);
  drawCartoonStar(scene);
  createLandscapeTextures(scene);
  drawMapToken(scene);
  drawNode(scene);
  drawLockedNode(scene);

  const themes: Theme[] = ['grass', 'snow', 'desert', 'ocean', 'castle'];
  for (const theme of themes) {
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

export function bossTextureKey(kind: 'hopper' | 'slider' | 'slam' | 'swimmer' | 'charger'): string {
  switch (kind) {
    case 'hopper':
      return 'boss-hopper';
    case 'slider':
      return 'boss-slider';
    case 'slam':
      return 'boss-slam';
    case 'swimmer':
      return 'boss-swimmer';
    case 'charger':
      return 'boss-charger';
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

