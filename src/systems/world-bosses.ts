import Phaser from 'phaser';
import { BOSS_KINDS, type BossKind } from '../config';
import type { CharacterPose } from './characters';

const SIZE = 128;
const INK = 0x2a2420;
const POSES: CharacterPose[] = ['idle', 'move', 'attack', 'hurt', 'dead'];

interface PoseDraw {
  dy: number;
  lean: number;
  squash: number;
  jaw: number;
}

function poseDraw(pose: CharacterPose): PoseDraw {
  switch (pose) {
    case 'idle':
      return { dy: 0, lean: 0, squash: 1, jaw: 7 };
    case 'move':
      return { dy: 2, lean: 6, squash: 0.94, jaw: 8 };
    case 'attack':
      return { dy: -4, lean: 8, squash: 1.06, jaw: 16 };
    case 'hurt':
      return { dy: 8, lean: -4, squash: 0.86, jaw: 3 };
    case 'dead':
      return { dy: 12, lean: 12, squash: 0.78, jaw: 10 };
    default: {
      const neverPose: never = pose;
      return neverPose;
    }
  }
}

function gfx(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  return scene.make.graphics({ x: 0, y: 0 });
}

function commit(g: Phaser.GameObjects.Graphics, key: string): void {
  g.generateTexture(key, SIZE, SIZE);
  g.destroy();
}

function inkCircle(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, fill: number): void {
  g.fillStyle(INK, 1);
  g.fillCircle(x, y, r);
  g.fillStyle(fill, 1);
  g.fillCircle(x, y, Math.max(2, r - 3));
}

function inkEllipse(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
): void {
  g.fillStyle(INK, 1);
  g.fillEllipse(x, y, w + 6, h + 6);
  g.fillStyle(fill, 1);
  g.fillEllipse(x, y, w, h);
}

function inkRoundRect(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: number,
): void {
  g.fillStyle(INK, 1);
  g.fillRoundedRect(x - 2, y - 2, w + 4, h + 4, r + 1);
  g.fillStyle(fill, 1);
  g.fillRoundedRect(x, y, w, h, r);
}

function inkTriangle(
  g: Phaser.GameObjects.Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  fill: number,
): void {
  g.fillStyle(INK, 1);
  g.fillTriangle(x1, y1, x2, y2, x3, y3);
  const cx = (x1 + x2 + x3) / 3;
  const cy = (y1 + y2 + y3) / 3;
  g.fillStyle(fill, 1);
  g.fillTriangle(
    x1 + (cx - x1) * 0.14,
    y1 + (cy - y1) * 0.14,
    x2 + (cx - x2) * 0.14,
    y2 + (cy - y2) * 0.14,
    x3 + (cx - x3) * 0.14,
    y3 + (cy - y3) * 0.14,
  );
}

function paintEye(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  pose: CharacterPose,
  w: number,
  h: number,
): void {
  g.fillStyle(INK, 1);
  g.fillEllipse(x, y, w + 4, h + 4);
  if (pose === 'dead') {
    g.fillStyle(0xf4efe4, 1);
    g.fillEllipse(x, y, w, h);
    g.lineStyle(2.4, INK, 1);
    g.lineBetween(x - 4, y - 4, x + 4, y + 4);
    g.lineBetween(x + 4, y - 4, x - 4, y + 4);
    return;
  }
  const squint = pose === 'hurt';
  const wide = pose === 'attack';
  const eyeH = squint ? Math.max(5, h * 0.45) : wide ? h * 1.12 : h;
  g.fillStyle(0xfff6ea, 1);
  g.fillEllipse(x, y, w, eyeH);
  g.fillStyle(0xff1a1a, 1);
  g.fillEllipse(x + 1, y + 1, w * 0.55, eyeH * 0.55);
  g.fillStyle(0x140000, 1);
  g.fillCircle(x + 1, y + 2, Math.max(1.8, w * 0.16));
}

function paintTeeth(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  y: number,
  count: number,
  spread: number,
  drop: number,
  up: boolean,
): void {
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / (count - 1) - 0.5;
    const x = cx + t * spread;
    if (up) {
      inkTriangle(g, x - 4, y, x + 4, y, x, y - drop, 0xfff8e8);
    } else {
      inkTriangle(g, x - 4, y, x + 4, y, x, y + drop, 0xfff8e8);
    }
  }
}

function drawPiranha(g: Phaser.GameObjects.Graphics, pose: CharacterPose): void {
  const p = poseDraw(pose);
  const cx = 64 + p.lean * 0.35;
  const headY = 48 + p.dy;
  const stemTop = 78 + p.dy;
  const wilt = pose === 'dead' ? 10 : 0;
  inkRoundRect(g, cx - 9, stemTop, 18, 38 + wilt, 7, 0x3d8a32);
  g.fillStyle(0x6bcc3a, 1);
  g.fillRoundedRect(cx - 5, stemTop + 4, 7, 30, 3);
  inkTriangle(g, cx - 8, 108 + wilt, cx - 8, 124 + wilt, cx - 38, 118 + wilt, 0x4aa028);
  inkTriangle(g, cx + 8, 108 + wilt, cx + 8, 124 + wilt, cx + 38, 118 + wilt, 0x4aa028);
  inkTriangle(g, cx - 10, 100, cx + 4, 108, cx - 30, 92, 0x6bcc3a);
  inkTriangle(g, cx + 10, 100, cx - 4, 108, cx + 30, 92, 0x3d8a32);
  inkEllipse(g, cx, stemTop + 2, 58, 22, 0x4aa028);
  g.fillStyle(0x6bcc3a, 1);
  g.fillEllipse(cx - 8, stemTop, 28, 12);

  const jaw = p.jaw;
  const upperY = headY - jaw * 0.55;
  const lowerY = headY + jaw * 0.7 + (pose === 'dead' ? 8 : 0);
  inkEllipse(g, cx, lowerY + 8, 70 * p.squash, 28, 0xf2e4c4);
  inkEllipse(g, cx, lowerY + 8, 58 * p.squash, 20, 0x6a1020);
  paintTeeth(g, cx, lowerY + 2, 6, 44, 9, true);

  inkEllipse(g, cx, upperY, 78 * p.squash, 52, 0xe23b3b);
  g.fillStyle(0xc42a2a, 1);
  g.fillEllipse(cx + 8, upperY + 6, 48 * p.squash, 28);
  g.fillStyle(0xf2e4c4, 1);
  g.fillEllipse(cx, upperY + 16, 62 * p.squash, 18);
  paintTeeth(g, cx, upperY + 18, 7, 50, 11, false);
  for (const spot of [
    [-18, -10],
    [16, -12],
    [-6, -18],
    [22, 2],
    [-22, 4],
  ] as const) {
    inkCircle(g, cx + spot[0], upperY + spot[1], 6, 0xfff1a8);
  }
  paintEye(g, cx - 16, upperY - 6, pose, 12, 14);
  paintEye(g, cx + 16, upperY - 6, pose, 12, 14);
  g.fillStyle(INK, 1);
  g.fillTriangle(cx - 22, upperY - 16, cx - 8, upperY - 20, cx - 10, upperY - 12);
  g.fillTriangle(cx + 22, upperY - 16, cx + 8, upperY - 20, cx + 10, upperY - 12);
}

function drawWalrus(g: Phaser.GameObjects.Graphics, pose: CharacterPose): void {
  const p = poseDraw(pose);
  const cx = 64 + p.lean * 0.4;
  const cy = 74 + p.dy;
  const slide = pose === 'move' || pose === 'attack' ? 8 : 0;
  inkEllipse(g, cx + 36, cy + 6, 28, 36, 0x7f9bb0);
  g.fillStyle(0xb7e4ff, 1);
  g.fillEllipse(cx + 38, cy + 2, 16, 22);
  inkEllipse(g, cx - 2, cy + 4, 92 * p.squash, 58, 0x8a6a58);
  g.fillStyle(0x6b5344, 1);
  g.fillEllipse(cx + 10, cy + 12, 58, 32);
  g.fillStyle(0xa88874, 1);
  g.fillEllipse(cx - 16, cy - 6, 36, 22);
  inkRoundRect(g, cx - 40 - slide, cy + 18, 28, 14, 6, 0x6b5344);
  inkRoundRect(g, cx + 14 + slide, cy + 20, 30, 14, 6, 0x6b5344);
  inkEllipse(g, cx - 22, cy - 18, 52, 44, 0x8a6a58);
  g.fillStyle(0x5a4036, 1);
  g.fillEllipse(cx - 28, cy - 8, 18, 14);
  inkTriangle(g, cx - 30, cy - 2, cx - 22, cy - 2, cx - 28, cy + 28, 0xf4efe4);
  inkTriangle(g, cx - 18, cy - 2, cx - 10, cy - 2, cx - 12, cy + 24, 0xf4efe4);
  g.fillStyle(0xf4efe4, 0.9);
  g.fillTriangle(cx - 28, cy + 8, cx - 26, cy + 8, cx - 27, cy + 22);
  g.lineStyle(2.2, INK, 1);
  g.lineBetween(cx - 44, cy - 8, cx - 28, cy - 4);
  g.lineBetween(cx - 44, cy - 2, cx - 28, cy);
  g.lineBetween(cx - 42, cy + 4, cx - 26, cy + 4);
  inkCircle(g, cx - 34, cy - 6, 6, 0x3a2a28);
  paintEye(g, cx - 28, cy - 22, pose, 11, 12);
  paintEye(g, cx - 12, cy - 24, pose, 11, 12);
  inkEllipse(g, cx - 4, cy - 40, 44, 16, 0x5ba3d0);
  inkTriangle(g, cx - 14, cy - 46, cx - 4, cy - 46, cx - 9, cy - 60, 0xd9eefc);
  inkTriangle(g, cx + 2, cy - 44, cx + 12, cy - 44, cx + 7, cy - 56, 0xb7e4ff);
  g.fillStyle(0xf4fbff, 1);
  g.fillCircle(cx - 12, cy - 40, 3.5);
  g.fillCircle(cx + 8, cy - 38, 3);
}

function drawScorpion(g: Phaser.GameObjects.Graphics, pose: CharacterPose): void {
  const p = poseDraw(pose);
  const cx = 58 + p.lean * 0.3;
  const cy = 78 + p.dy;
  const tailLift = pose === 'attack' ? -18 : pose === 'hurt' ? 6 : pose === 'dead' ? 16 : 0;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i += 1) {
      const lx = cx + side * (18 + i * 4);
      const ly = cy + 10 + i * 6;
      inkRoundRect(g, lx - 4, ly, 8, 22, 3, 0x8a5a22);
      inkCircle(g, lx, ly + 22, 5, 0x6b4423);
    }
  }
  inkEllipse(g, cx + 18, cy + 4, 36, 28, 0xc9953f);
  inkEllipse(g, cx, cy, 44 * p.squash, 32, 0xe8c36a);
  g.fillStyle(0xc9953f, 1);
  g.fillEllipse(cx + 6, cy + 6, 26, 18);
  inkEllipse(g, cx - 22, cy - 4, 36, 30, 0xe8c36a);
  const clawY = cy + (pose === 'attack' ? -6 : 2);
  inkEllipse(g, cx - 44, clawY, 28, 20, 0xc9953f);
  inkTriangle(g, cx - 56, clawY - 8, cx - 56, clawY + 2, cx - 72, clawY - 10, 0xe8c36a);
  inkTriangle(g, cx - 56, clawY + 2, cx - 56, clawY + 12, cx - 72, clawY + 14, 0xe8c36a);
  inkEllipse(g, cx - 38, clawY + 18, 24, 16, 0xc9953f);
  inkTriangle(g, cx - 48, clawY + 12, cx - 48, clawY + 22, cx - 64, clawY + 24, 0xe8c36a);
  const tail = [
    [cx + 28, cy - 4],
    [cx + 40, cy - 18 + tailLift * 0.3],
    [cx + 46, cy - 36 + tailLift * 0.6],
    [cx + 36, cy - 52 + tailLift],
  ] as const;
  for (let i = 0; i < tail.length; i += 1) {
    const [tx, ty] = tail[i];
    inkCircle(g, tx, ty, 11 - i, i % 2 === 0 ? 0xc9953f : 0x8a5a22);
  }
  const stinger = tail[tail.length - 1];
  inkTriangle(
    g,
    stinger[0] - 8,
    stinger[1] - 6,
    stinger[0] + 8,
    stinger[1] - 4,
    stinger[0] + 2,
    stinger[1] - 28,
    0x5a2010,
  );
  inkCircle(g, stinger[0] + 2, stinger[1] - 26, 6, 0xe23b3b);
  paintEye(g, cx - 28, cy - 10, pose, 9, 10);
  paintEye(g, cx - 16, cy - 12, pose, 8, 9);
  g.fillStyle(INK, 1);
  g.fillCircle(cx - 30, cy + 2, 2.2);
  g.fillCircle(cx - 24, cy + 4, 2.2);
}

function drawFish(g: Phaser.GameObjects.Graphics, pose: CharacterPose): void {
  const p = poseDraw(pose);
  const cx = 62 + p.lean * 0.2;
  const cy = 64 + p.dy * 0.4;
  const dash = pose === 'attack' ? 6 : 0;
  inkTriangle(g, cx + 36, cy, cx + 64, cy - 22, cx + 64, cy + 22, 0x0e3a50);
  inkTriangle(g, cx + 40, cy, cx + 58, cy - 12, cx + 58, cy + 12, 0x1c6a88);
  inkTriangle(g, cx + 4, cy - 18, cx + 28, cy - 18, cx + 18, cy - 46, 0x0e3a50);
  inkTriangle(g, cx + 8, cy - 18, cx + 24, cy - 18, cx + 16, cy - 38, 0x2a8aaa);
  inkTriangle(g, cx - 4, cy + 16, cx + 22, cy + 16, cx + 10, cy + 38, 0x0e3a50);
  inkEllipse(g, cx, cy, 78 * p.squash, 48, 0x1c6a88);
  g.fillStyle(0x145a78, 1);
  g.fillEllipse(cx + 8, cy + 4, 50, 30);
  g.fillStyle(0x7ec8c0, 1);
  g.fillEllipse(cx - 4, cy + 10, 54, 22);
  g.fillStyle(0x0e3a50, 1);
  g.fillEllipse(cx + 10, cy - 6, 36, 8);
  g.fillEllipse(cx + 6, cy + 8, 28, 6);
  inkTriangle(g, cx - 8, cy + 4, cx + 8, cy + 18, cx - 6, cy + 28, 0x2a8aaa);
  const mouthX = cx - 34 - dash;
  inkEllipse(g, mouthX, cy + 4, 28, 24 + p.jaw * 0.4, 0x145a78);
  g.fillStyle(0x6a1020, 1);
  g.fillEllipse(mouthX - 2, cy + 6, 16, 12 + p.jaw * 0.25);
  paintTeeth(g, mouthX - 2, cy, 4, 16, 8, false);
  paintTeeth(g, mouthX - 2, cy + 10, 4, 16, 7, true);
  inkCircle(g, cx - 10, cy - 8, 14, 0xfff6ea);
  paintEye(g, cx - 10, cy - 8, pose, 13, 15);
  const lureX = cx - 18;
  const lureY = cy - 28;
  g.lineStyle(3, INK, 1);
  g.beginPath();
  g.moveTo(cx - 8, cy - 20);
  g.lineTo(lureX - 8, lureY - 10);
  g.strokePath();
  inkCircle(g, lureX - 10, lureY - 12, 8, 0xfff1a8);
  g.fillStyle(0xffe27a, 1);
  g.fillCircle(lureX - 10, lureY - 12, 4);
}

function drawGargoyle(g: Phaser.GameObjects.Graphics, pose: CharacterPose): void {
  const p = poseDraw(pose);
  const cx = 64 + p.lean * 0.25;
  const cy = 70 + p.dy;
  const wing = pose === 'attack' ? 18 : pose === 'move' ? 10 : pose === 'dead' ? -8 : 4;
  inkTriangle(g, cx - 8, cy - 8, cx - 56 - wing, cy + 8, cx - 20, cy + 28, 0x4a4050);
  inkTriangle(g, cx + 8, cy - 8, cx + 56 + wing, cy + 8, cx + 20, cy + 28, 0x4a4050);
  inkTriangle(g, cx - 12, cy - 4, cx - 48 - wing, cy - 6, cx - 24, cy + 18, 0x6a6a72);
  inkTriangle(g, cx + 12, cy - 4, cx + 48 + wing, cy - 6, cx + 24, cy + 18, 0x6a6a72);
  g.fillStyle(INK, 1);
  g.fillTriangle(cx - 40, cy + 2, cx - 28, cy + 2, cx - 34, cy + 16);
  g.fillTriangle(cx + 28, cy + 2, cx + 40, cy + 2, cx + 34, cy + 16);
  inkEllipse(g, cx, cy + 8, 46 * p.squash, 52, 0x6a6a72);
  g.fillStyle(0x4a4a52, 1);
  g.fillEllipse(cx + 6, cy + 16, 28, 28);
  g.fillStyle(0x8a8a94, 1);
  g.fillEllipse(cx - 10, cy, 18, 14);
  inkRoundRect(g, cx - 22, cy + 28, 16, 18, 4, 0x4a4a52);
  inkRoundRect(g, cx + 6, cy + 28, 16, 18, 4, 0x4a4a52);
  inkTriangle(g, cx - 20, cy + 44, cx - 8, cy + 44, cx - 18, cy + 54, 0x3a3a42);
  inkTriangle(g, cx + 8, cy + 44, cx + 20, cy + 44, cx + 18, cy + 54, 0x3a3a42);
  inkEllipse(g, cx, cy - 16, 40, 36, 0x6a6a72);
  inkTriangle(g, cx - 16, cy - 28, cx - 6, cy - 28, cx - 14, cy - 46, 0x3a3a42);
  inkTriangle(g, cx + 6, cy - 28, cx + 16, cy - 28, cx + 14, cy - 46, 0x3a3a42);
  inkTriangle(g, cx - 4, cy - 8, cx + 4, cy - 8, cx, cy + 6, 0x4a4a52);
  paintEye(g, cx - 10, cy - 18, pose, 10, 11);
  paintEye(g, cx + 10, cy - 18, pose, 10, 11);
  if (pose !== 'dead') {
    g.fillStyle(0xff3030, 0.7);
    g.fillCircle(cx - 10, cy - 17, 3);
    g.fillCircle(cx + 10, cy - 17, 3);
  }
  g.fillStyle(INK, 1);
  g.fillRoundedRect(cx - 8, cy - 6, 16, 4, 1);
  inkRoundRect(g, cx - 18, cy + 2, 12, 10, 3, 0x4a4a52);
  inkRoundRect(g, cx + 6, cy + 2, 12, 10, 3, 0x4a4a52);
}

function drawHowler(g: Phaser.GameObjects.Graphics, pose: CharacterPose): void {
  const p = poseDraw(pose);
  const cx = 64 + p.lean * 0.35;
  const cy = 62 + p.dy;
  const reach = pose === 'attack' ? 14 : pose === 'move' ? 7 : pose === 'dead' ? -4 : 0;
  inkCircle(g, cx - 24, cy + 6, 16, 0x6b4423);
  inkCircle(g, cx + 24, cy + 6, 16, 0x6b4423);
  inkRoundRect(g, cx - 42 - reach, cy + 4, 22, 44, 9, 0x6b4423);
  inkRoundRect(g, cx + 20 + reach, cy + 6, 22, 44, 9, 0x6b4423);
  inkCircle(g, cx - 34 - reach, cy + 48, 11, 0xc68642);
  inkCircle(g, cx + 34 + reach, cy + 48, 11, 0xc68642);
  inkEllipse(g, cx, cy + 8, 52 * p.squash, 58, 0x6b4423);
  g.fillStyle(0x8a5a32, 1);
  g.fillEllipse(cx - 8, cy, 28, 30);
  g.fillStyle(0x4a2e18, 1);
  g.fillEllipse(cx + 8, cy + 16, 24, 22);
  inkRoundRect(g, cx - 18, cy + 32, 14, 22, 5, 0x6b4423);
  inkRoundRect(g, cx + 4, cy + 32, 14, 22, 5, 0x6b4423);
  inkRoundRect(g, cx - 20, cy + 50, 16, 10, 4, 0x4a2e18);
  inkRoundRect(g, cx + 4, cy + 50, 16, 10, 4, 0x4a2e18);
  inkEllipse(g, cx, cy + 22, 40, 14, 0x4aa028);
  g.fillStyle(0x2a7028, 1);
  g.fillEllipse(cx + 4, cy + 24, 22, 8);
  inkCircle(g, cx - 22, cy - 22, 12, 0x6b4423);
  inkCircle(g, cx + 22, cy - 22, 12, 0x6b4423);
  inkEllipse(g, cx, cy - 16, 44, 40, 0x6b4423);
  inkEllipse(g, cx, cy - 8, 32, 30, 0xc68642);
  g.fillStyle(0xa86b32, 1);
  g.fillEllipse(cx + 4, cy - 2, 18, 16);
  const roar = pose === 'attack' || pose === 'dead';
  if (roar) {
    inkEllipse(g, cx, cy + 4, 22, 16 + p.jaw * 0.2, 0x6a1020);
    paintTeeth(g, cx, cy - 2, 5, 16, 6, false);
  } else if (pose === 'hurt') {
    g.fillStyle(INK, 1);
    g.fillRoundedRect(cx - 8, cy + 4, 16, 3, 1);
  } else {
    g.lineStyle(2.6, INK, 1);
    g.beginPath();
    g.arc(cx, cy + 2, 8, 0.15 * Math.PI, 0.85 * Math.PI, false);
    g.strokePath();
  }
  paintEye(g, cx - 10, cy - 18, pose, 10, 11);
  paintEye(g, cx + 10, cy - 18, pose, 10, 11);
}

function drawKind(g: Phaser.GameObjects.Graphics, kind: BossKind, pose: CharacterPose): void {
  switch (kind) {
    case 'piranha':
      drawPiranha(g, pose);
      return;
    case 'walrus':
      drawWalrus(g, pose);
      return;
    case 'scorpion':
      drawScorpion(g, pose);
      return;
    case 'fish':
      drawFish(g, pose);
      return;
    case 'gargoyle':
      drawGargoyle(g, pose);
      return;
    case 'howler':
      drawHowler(g, pose);
      return;
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

export function worldBossTextureKey(kind: BossKind, pose: CharacterPose): string {
  return `world-boss-${kind}-${pose}`;
}

export function createWorldBossTextures(scene: Phaser.Scene): void {
  for (const kind of BOSS_KINDS) {
    for (const pose of POSES) {
      const g = gfx(scene);
      drawKind(g, kind, pose);
      commit(g, worldBossTextureKey(kind, pose));
    }
  }
}
