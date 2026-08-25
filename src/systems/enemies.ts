import Phaser from 'phaser';
import { ENEMY_KINDS, type EnemyKind } from '../config';
import type { CharacterPose } from './characters';

const SIZE = 64;
const INK = 0x2a2420;
const POSES: CharacterPose[] = ['idle', 'move', 'attack', 'hurt', 'dead'];

interface PoseDraw {
  dy: number;
  lean: number;
  squash: number;
}

function poseDraw(pose: CharacterPose): PoseDraw {
  switch (pose) {
    case 'idle':
      return { dy: 0, lean: 0, squash: 1 };
    case 'move':
      return { dy: 2, lean: 4, squash: 0.94 };
    case 'attack':
      return { dy: -3, lean: 6, squash: 1.06 };
    case 'hurt':
      return { dy: 5, lean: -3, squash: 0.86 };
    case 'dead':
      return { dy: 8, lean: 8, squash: 0.78 };
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
  g.fillCircle(x, y, Math.max(1.4, r - 2));
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
  g.fillEllipse(x, y, w + 4, h + 4);
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
  g.fillRoundedRect(x - 1.5, y - 1.5, w + 3, h + 3, r + 1);
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
    x1 + (cx - x1) * 0.16,
    y1 + (cy - y1) * 0.16,
    x2 + (cx - x2) * 0.16,
    y2 + (cy - y2) * 0.16,
    x3 + (cx - x3) * 0.16,
    y3 + (cy - y3) * 0.16,
  );
}

function paintEye(g: Phaser.GameObjects.Graphics, x: number, y: number, pose: CharacterPose, w = 8, h = 9): void {
  g.fillStyle(INK, 1);
  g.fillEllipse(x, y, w + 3, h + 3);
  if (pose === 'dead') {
    g.fillStyle(0xf4efe4, 1);
    g.fillEllipse(x, y, w, h);
    g.lineStyle(1.6, INK, 1);
    g.lineBetween(x - 2.4, y - 2.4, x + 2.4, y + 2.4);
    g.lineBetween(x + 2.4, y - 2.4, x - 2.4, y + 2.4);
    return;
  }
  const eyeH = pose === 'hurt' ? Math.max(3.2, h * 0.42) : pose === 'attack' ? h * 1.12 : h;
  g.fillStyle(0xfff6ea, 1);
  g.fillEllipse(x, y, w, eyeH);
  g.fillStyle(0xff1a1a, 1);
  g.fillEllipse(x + 0.6, y + 0.6, w * 0.55, eyeH * 0.55);
  g.fillStyle(0x140000, 1);
  g.fillCircle(x + 0.6, y + 1.2, Math.max(1.2, w * 0.16));
}

function drawBrambleHopper(g: Phaser.GameObjects.Graphics, pose: CharacterPose): void {
  const p = poseDraw(pose);
  const cx = 32 + p.lean * 0.4;
  const cy = 36 + p.dy;
  const hop = pose === 'move' || pose === 'attack' ? -6 : 0;
  for (const t of [-1, 0, 1]) {
    inkTriangle(g, cx + t * 7, cy - 8, cx + t * 12, cy + 2, cx + t * 18, cy - 18 + hop, t === 0 ? 0x3d8a32 : 0x4aa028);
  }
  inkEllipse(g, cx, cy + hop, 30 * p.squash, 24, 0x6bcc3a);
  g.fillStyle(0x4aa028, 1);
  g.fillEllipse(cx + 4, cy + 4 + hop, 18, 12);
  inkTriangle(g, cx - 8, cy - 6 + hop, cx - 2, cy - 8 + hop, cx - 14, cy - 20 + hop, 0x2a7028);
  inkTriangle(g, cx + 4, cy - 8 + hop, cx + 10, cy - 6 + hop, cx + 16, cy - 20 + hop, 0x2a7028);
  inkRoundRect(g, cx - 16, cy + 8 + hop, 8, 14, 3, 0x3d8a32);
  inkRoundRect(g, cx + 8, cy + 8 + hop, 8, 14, 3, 0x3d8a32);
  inkCircle(g, cx - 12, cy + 22 + hop, 4, 0x6b4423);
  inkCircle(g, cx + 12, cy + 22 + hop, 4, 0x6b4423);
  paintEye(g, cx - 6, cy - 2 + hop, pose, 7, 8);
  paintEye(g, cx + 6, cy - 2 + hop, pose, 7, 8);
}

function drawAcornSlinger(g: Phaser.GameObjects.Graphics, pose: CharacterPose): void {
  const p = poseDraw(pose);
  const cx = 32 + p.lean * 0.35;
  const cy = 34 + p.dy;
  const flap = pose === 'move' || pose === 'attack' ? 6 : 2;
  inkEllipse(g, cx - 16, cy + 2, 16, 10 + flap, 0xfff1a8);
  inkEllipse(g, cx + 16, cy + 2, 16, 10 + flap, 0xfff1a8);
  inkEllipse(g, cx, cy + 6, 26 * p.squash, 24, 0xc68642);
  g.fillStyle(0xa86b32, 1);
  g.fillEllipse(cx + 3, cy + 10, 16, 12);
  inkEllipse(g, cx, cy - 10, 32, 16, 0x4aa028);
  g.fillStyle(0x2a7028, 1);
  g.fillEllipse(cx, cy - 14, 20, 8);
  inkTriangle(g, cx - 4, cy - 16, cx + 4, cy - 16, cx, cy - 24, 0x3d8a32);
  inkRoundRect(g, cx + 10, cy + 2, 14, 4, 2, 0x6b4423);
  if (pose === 'attack') {
    inkCircle(g, cx + 26, cy + 2, 5, 0xc68642);
  }
  paintEye(g, cx - 5, cy + 2, pose, 7, 8);
  paintEye(g, cx + 5, cy + 2, pose, 7, 8);
}

function drawSkatingHare(g: Phaser.GameObjects.Graphics, pose: CharacterPose): void {
  const p = poseDraw(pose);
  const cx = 30 + p.lean * 0.4;
  const cy = 34 + p.dy;
  const slide = pose === 'move' || pose === 'attack' ? 5 : 0;
  inkEllipse(g, cx - 10, cy - 18, 8, 22, 0xf4fbff);
  inkEllipse(g, cx + 2, cy - 20, 8, 24, 0xf4fbff);
  inkEllipse(g, cx - 10, cy - 18, 4, 14, 0xffb6c8);
  inkEllipse(g, cx + 2, cy - 20, 4, 16, 0xffb6c8);
  inkEllipse(g, cx + 16, cy + 8, 12, 10, 0xf4fbff);
  inkEllipse(g, cx, cy + 6, 28 * p.squash, 26, 0xf4fbff);
  g.fillStyle(0xcfe7f7, 1);
  g.fillEllipse(cx + 4, cy + 10, 16, 12);
  inkEllipse(g, cx - 2, cy - 6, 20, 18, 0xf4fbff);
  inkRoundRect(g, cx - 14 - slide, cy + 16, 12, 7, 3, 0xf4fbff);
  inkRoundRect(g, cx + 4 + slide, cy + 16, 14, 8, 3, 0xf4fbff);
  inkRoundRect(g, cx - 16 - slide, cy + 22, 16, 4, 2, 0x5ba3d0);
  inkRoundRect(g, cx + 2 + slide, cy + 23, 18, 4, 2, 0x5ba3d0);
  g.fillStyle(0xb7e4ff, 1);
  g.fillRect(cx - 14 - slide, cy + 23, 12, 1.4);
  g.fillRect(cx + 4 + slide, cy + 24, 14, 1.4);
  paintEye(g, cx - 6, cy - 8, pose, 7, 8);
  paintEye(g, cx + 4, cy - 9, pose, 7, 8);
  if (pose !== 'dead') {
    g.fillStyle(INK, 1);
    g.fillEllipse(cx + 2, cy - 1, 5, 4);
  }
}

function drawSnowballFinch(g: Phaser.GameObjects.Graphics, pose: CharacterPose): void {
  const p = poseDraw(pose);
  const cx = 32 + p.lean * 0.3;
  const cy = 32 + p.dy;
  const flap = pose === 'move' || pose === 'attack' ? 8 : 3;
  inkTriangle(g, cx - 6, cy, cx - 22, cy - flap, cx - 18, cy + 8, 0x5ba3d0);
  inkTriangle(g, cx + 6, cy, cx + 22, cy - flap, cx + 18, cy + 8, 0x5ba3d0);
  inkEllipse(g, cx, cy + 4, 28 * p.squash, 24, 0xf4fbff);
  g.fillStyle(0xcfe7f7, 1);
  g.fillEllipse(cx + 3, cy + 8, 16, 12);
  inkEllipse(g, cx, cy - 8, 18, 16, 0xf4fbff);
  inkTriangle(g, cx + 8, cy - 6, cx + 8, cy + 2, cx + 20, cy - 2, 0xe08a32);
  inkEllipse(g, cx, cy + 18, 14, 12, 0xf4fbff);
  g.fillStyle(0xd9eefc, 1);
  g.fillCircle(cx - 3, cy + 16, 3);
  g.fillCircle(cx + 4, cy + 18, 2.4);
  paintEye(g, cx - 4, cy - 10, pose, 6, 7);
  paintEye(g, cx + 4, cy - 10, pose, 6, 7);
}

function drawDuneScarab(g: Phaser.GameObjects.Graphics, pose: CharacterPose): void {
  const p = poseDraw(pose);
  const cx = 32 + p.lean * 0.25;
  const cy = 34 + p.dy;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i += 1) {
      const legX = side < 0 ? cx - 20 - i : cx + 10 + i;
      inkRoundRect(g, legX, cy + 2 + i * 5, 10, 4, 2, 0x8a5a22);
    }
  }
  inkEllipse(g, cx, cy + 4, 30 * p.squash, 24, 0xe8c36a);
  g.fillStyle(0xc9953f, 1);
  g.fillEllipse(cx + 2, cy + 8, 18, 12);
  g.fillStyle(INK, 1);
  g.fillEllipse(cx, cy + 2, 2, 16);
  g.fillEllipse(cx - 8, cy + 4, 2, 12);
  g.fillEllipse(cx + 8, cy + 4, 2, 12);
  inkTriangle(g, cx - 4, cy - 10, cx + 4, cy - 10, cx, cy - 20, 0x8a5a22);
  inkEllipse(g, cx, cy - 6, 16, 12, 0xe8c36a);
  paintEye(g, cx - 4, cy - 7, pose, 6, 6);
  paintEye(g, cx + 4, cy - 7, pose, 6, 6);
}

function drawCactusImp(g: Phaser.GameObjects.Graphics, pose: CharacterPose): void {
  const p = poseDraw(pose);
  const cx = 32 + p.lean * 0.3;
  const cy = 34 + p.dy;
  const arms = pose === 'attack' ? 8 : 2;
  inkRoundRect(g, cx - 22 - arms, cy + 2, 14, 8, 3, 0x3d8a32);
  inkRoundRect(g, cx + 8 + arms, cy + 2, 14, 8, 3, 0x3d8a32);
  inkRoundRect(g, cx - 11, cy - 16, 22, 40 * p.squash, 8, 0x4aa028);
  g.fillStyle(0x6bcc3a, 1);
  g.fillRoundedRect(cx - 7, cy - 12, 8, 28, 4);
  for (const [x, y] of [
    [-8, -6],
    [8, -2],
    [-6, 8],
    [7, 12],
    [0, -14],
  ] as const) {
    inkTriangle(g, cx + x - 2, cy + y, cx + x + 2, cy + y, cx + x, cy + y - 6, 0x2a7028);
  }
  inkEllipse(g, cx, cy - 4, 16, 14, 0x6bcc3a);
  paintEye(g, cx - 4, cy - 6, pose, 6, 7);
  paintEye(g, cx + 4, cy - 6, pose, 6, 7);
  inkRoundRect(g, cx - 10, cy + 22, 8, 8, 3, 0x8a5a22);
  inkRoundRect(g, cx + 2, cy + 22, 8, 8, 3, 0x8a5a22);
}

function drawReefCrab(g: Phaser.GameObjects.Graphics, pose: CharacterPose): void {
  const p = poseDraw(pose);
  const cx = 32 + p.lean * 0.2;
  const cy = 36 + p.dy;
  const pinch = pose === 'attack' ? -6 : 0;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i += 1) {
      inkRoundRect(g, cx + side * (6 + i * 3) - 2, cy + 8 + i * 2, 5, 10, 2, 0xc45a32);
    }
  }
  inkEllipse(g, cx, cy + 2, 32 * p.squash, 22, 0xe85d4c);
  g.fillStyle(0xc45a32, 1);
  g.fillEllipse(cx + 3, cy + 6, 18, 10);
  inkEllipse(g, cx - 18, cy - 2 + pinch, 16, 12, 0xff8a7a);
  inkEllipse(g, cx + 18, cy - 2 + pinch, 16, 12, 0xff8a7a);
  inkTriangle(g, cx - 24, cy - 6 + pinch, cx - 24, cy + 2 + pinch, cx - 32, cy - 4 + pinch, 0xe85d4c);
  inkTriangle(g, cx + 24, cy - 6 + pinch, cx + 24, cy + 2 + pinch, cx + 32, cy - 4 + pinch, 0xe85d4c);
  inkCircle(g, cx - 6, cy - 10, 4, 0xe85d4c);
  inkCircle(g, cx + 6, cy - 10, 4, 0xe85d4c);
  paintEye(g, cx - 6, cy - 12, pose, 6, 6);
  paintEye(g, cx + 6, cy - 12, pose, 6, 6);
}

function drawBubbleArcherfish(g: Phaser.GameObjects.Graphics, pose: CharacterPose): void {
  const p = poseDraw(pose);
  const cx = 30 + p.lean * 0.2;
  const cy = 32 + p.dy * 0.4;
  inkTriangle(g, cx + 16, cy, cx + 30, cy - 10, cx + 30, cy + 10, 0x1c6a88);
  inkTriangle(g, cx, cy - 8, cx + 10, cy - 8, cx + 6, cy - 18, 0x2a8aaa);
  inkEllipse(g, cx, cy, 32 * p.squash, 20, 0x3cb0c4);
  g.fillStyle(0x1c6a88, 1);
  g.fillEllipse(cx + 4, cy + 3, 18, 10);
  g.fillStyle(0x7ec8c0, 1);
  g.fillEllipse(cx - 4, cy + 4, 16, 8);
  inkEllipse(g, cx - 14, cy + 2, 12, 10, 0x2a8aaa);
  if (pose === 'attack' || pose === 'idle') {
    inkCircle(g, cx - 24, cy - 2, pose === 'attack' ? 7 : 5, 0xb7e4ff);
    g.fillStyle(0xf4fbff, 0.7);
    g.fillCircle(cx - 26, cy - 4, 2);
  }
  paintEye(g, cx - 4, cy - 4, pose, 8, 8);
}

function drawClockworkHound(g: Phaser.GameObjects.Graphics, pose: CharacterPose): void {
  const p = poseDraw(pose);
  const cx = 30 + p.lean * 0.35;
  const cy = 34 + p.dy;
  inkEllipse(g, cx + 16, cy + 6, 12, 10, 0xc4a05a);
  inkEllipse(g, cx, cy + 6, 28 * p.squash, 20, 0xc4a05a);
  g.fillStyle(0x8a5a22, 1);
  g.fillEllipse(cx + 4, cy + 10, 16, 10);
  inkEllipse(g, cx - 10, cy - 2, 18, 16, 0xc4a05a);
  inkTriangle(g, cx - 18, cy + 2, cx - 10, cy + 6, cx - 22, cy + 10, 0x8a5a22);
  inkRoundRect(g, cx - 12, cy + 14, 7, 12, 2, 0x8a5a22);
  inkRoundRect(g, cx + 4, cy + 14, 7, 12, 2, 0x8a5a22);
  inkCircle(g, cx + 4, cy - 10, 7, 0x8a5a22);
  g.fillStyle(0xf0d48a, 1);
  g.fillCircle(cx + 4, cy - 10, 3);
  inkRoundRect(g, cx + 2, cy - 20, 4, 10, 1, 0x8a5a22);
  paintEye(g, cx - 14, cy - 5, pose, 6, 7);
  paintEye(g, cx - 6, cy - 6, pose, 6, 7);
}

function drawGargoylePage(g: Phaser.GameObjects.Graphics, pose: CharacterPose): void {
  const p = poseDraw(pose);
  const cx = 32 + p.lean * 0.25;
  const cy = 34 + p.dy;
  const wing = pose === 'attack' ? 10 : pose === 'move' ? 6 : pose === 'dead' ? -4 : 2;
  inkTriangle(g, cx - 4, cy, cx - 24 - wing, cy + 4, cx - 10, cy + 14, 0x4a4050);
  inkTriangle(g, cx + 4, cy, cx + 24 + wing, cy + 4, cx + 10, cy + 14, 0x4a4050);
  inkEllipse(g, cx, cy + 6, 22 * p.squash, 24, 0x6a6a72);
  g.fillStyle(0x4a4a52, 1);
  g.fillEllipse(cx + 3, cy + 10, 12, 12);
  inkEllipse(g, cx, cy - 8, 18, 16, 0x6a6a72);
  inkTriangle(g, cx - 8, cy - 14, cx - 2, cy - 14, cx - 7, cy - 22, 0x3a3a42);
  inkTriangle(g, cx + 2, cy - 14, cx + 8, cy - 14, cx + 7, cy - 22, 0x3a3a42);
  inkRoundRect(g, cx + 6, cy + 2, 10, 12, 2, 0xf0d48a);
  g.fillStyle(INK, 1);
  g.fillRect(cx + 8, cy + 5, 6, 1);
  g.fillRect(cx + 8, cy + 8, 6, 1);
  inkRoundRect(g, cx - 10, cy + 16, 7, 10, 2, 0x4a4a52);
  inkRoundRect(g, cx + 2, cy + 16, 7, 10, 2, 0x4a4a52);
  paintEye(g, cx - 5, cy - 10, pose, 6, 7);
  paintEye(g, cx + 5, cy - 10, pose, 6, 7);
}

function drawHowlerApe(g: Phaser.GameObjects.Graphics, pose: CharacterPose): void {
  const p = poseDraw(pose);
  const cx = 32 + p.lean * 0.25;
  const cy = 30 + p.dy;
  const reach = pose === 'attack' ? 7 : pose === 'move' ? 4 : pose === 'dead' ? -2 : 0;
  inkRoundRect(g, cx - 26 - reach, cy - 4, 13, 30, 6, 0x5a3418);
  inkRoundRect(g, cx + 13 + reach, cy - 2, 13, 30, 6, 0x5a3418);
  inkCircle(g, cx - 20 - reach, cy + 26, 8, 0xc68642);
  inkCircle(g, cx + 20 + reach, cy + 28, 8, 0xc68642);
  inkEllipse(g, cx, cy + 8, 32 * p.squash, 28, 0x6b4423);
  g.fillStyle(0x4a2e18, 1);
  g.fillEllipse(cx + 4, cy + 14, 16, 12);
  inkEllipse(g, cx, cy + 16, 24, 8, 0x4aa028);
  g.fillStyle(0x2a7028, 1);
  g.fillEllipse(cx + 3, cy + 17, 12, 4);
  inkRoundRect(g, cx - 11, cy + 18, 9, 12, 3, 0x6b4423);
  inkRoundRect(g, cx + 2, cy + 18, 9, 12, 3, 0x6b4423);
  inkCircle(g, cx - 7, cy - 16, 3, 0x5a3418);
  inkCircle(g, cx + 7, cy - 16, 3, 0x5a3418);
  inkEllipse(g, cx, cy - 10, 18, 16, 0x6b4423);
  inkEllipse(g, cx + 1, cy - 3, 16, 12, 0xc68642);
  if (pose === 'attack' || pose === 'dead') {
    inkEllipse(g, cx + 1, cy + 2, 12, 9, 0x6a1020);
  } else {
    g.lineStyle(2, INK, 1);
    g.beginPath();
    g.arc(cx + 1, cy + 1, 4, 0.15 * Math.PI, 0.85 * Math.PI, false);
    g.strokePath();
  }
  paintEye(g, cx - 4, cy - 12, pose, 6, 6);
  paintEye(g, cx + 5, cy - 12, pose, 6, 6);
}

function drawDartMosquito(g: Phaser.GameObjects.Graphics, pose: CharacterPose): void {
  const p = poseDraw(pose);
  const cx = 30 + p.lean * 0.25;
  const cy = 30 + p.dy * 0.5;
  const flap = pose === 'move' || pose === 'attack' ? 7 : 3;
  inkEllipse(g, cx - 2, cy - 8 - flap, 22, 12, 0xcfe7f7);
  inkEllipse(g, cx + 6, cy - 4 - flap, 18, 10, 0xb7e4ff);
  g.fillStyle(0xf4fbff, 0.55);
  g.fillEllipse(cx - 4, cy - 10 - flap, 14, 6);
  inkEllipse(g, cx + 8, cy + 4, 18 * p.squash, 12, 0x4a3420);
  g.fillStyle(0x6a8a32, 1);
  g.fillEllipse(cx + 10, cy + 4, 10, 6);
  inkEllipse(g, cx - 4, cy + 2, 14, 12, 0x3d2a18);
  inkTriangle(g, cx - 10, cy + 2, cx - 10, cy + 6, cx - 26, cy + 8, 0x2a7028);
  for (const side of [-1, 1]) {
    g.lineStyle(2, INK, 1);
    g.beginPath();
    g.moveTo(cx, cy + 8);
    g.lineTo(cx + side * 10, cy + 20);
    g.strokePath();
  }
  paintEye(g, cx - 6, cy - 1, pose, 6, 6);
}

function drawKind(g: Phaser.GameObjects.Graphics, kind: EnemyKind, pose: CharacterPose): void {
  switch (kind) {
    case 'bramble-hopper':
      drawBrambleHopper(g, pose);
      return;
    case 'acorn-slinger':
      drawAcornSlinger(g, pose);
      return;
    case 'skating-hare':
      drawSkatingHare(g, pose);
      return;
    case 'snowball-finch':
      drawSnowballFinch(g, pose);
      return;
    case 'dune-scarab':
      drawDuneScarab(g, pose);
      return;
    case 'cactus-imp':
      drawCactusImp(g, pose);
      return;
    case 'reef-crab':
      drawReefCrab(g, pose);
      return;
    case 'bubble-archerfish':
      drawBubbleArcherfish(g, pose);
      return;
    case 'clockwork-hound':
      drawClockworkHound(g, pose);
      return;
    case 'gargoyle-page':
      drawGargoylePage(g, pose);
      return;
    case 'howler-ape':
      drawHowlerApe(g, pose);
      return;
    case 'dart-mosquito':
      drawDartMosquito(g, pose);
      return;
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

export function enemyTextureKey(kind: EnemyKind, pose: CharacterPose): string {
  return `enemy-${kind}-${pose}`;
}

export function enemyTextureKeys(kind: EnemyKind): readonly string[] {
  return POSES.map((pose) => enemyTextureKey(kind, pose));
}

export function createEnemyTextures(scene: Phaser.Scene): void {
  for (const kind of ENEMY_KINDS) {
    for (const pose of POSES) {
      const g = gfx(scene);
      drawKind(g, kind, pose);
      commit(g, enemyTextureKey(kind, pose));
    }
  }
}
