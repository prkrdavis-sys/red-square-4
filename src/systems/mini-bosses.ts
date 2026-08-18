import Phaser from 'phaser';
import { THEMES, type MiniBossVariant, type Theme } from '../config';
import type { CharacterPose } from './characters';

const SIZE = 128;
const INK = 0x2a2420;
const POSES: CharacterPose[] = ['idle', 'move', 'attack', 'hurt', 'dead'];
const VARIANTS: MiniBossVariant[] = [1, 2, 3];

interface PoseDraw {
  dy: number;
  lean: number;
  squash: number;
  eye: 'angry' | 'wide' | 'squint' | 'x';
  mouth: 'grin' | 'open' | 'flat' | 'none';
}

function poseDraw(pose: CharacterPose): PoseDraw {
  switch (pose) {
    case 'idle':
      return { dy: 0, lean: 0, squash: 1, eye: 'angry', mouth: 'grin' };
    case 'move':
      return { dy: 3, lean: 5, squash: 0.94, eye: 'angry', mouth: 'grin' };
    case 'attack':
      return { dy: -5, lean: 7, squash: 1.05, eye: 'wide', mouth: 'open' };
    case 'hurt':
      return { dy: 7, lean: -3, squash: 0.88, eye: 'squint', mouth: 'flat' };
    case 'dead':
      return { dy: 11, lean: 10, squash: 0.8, eye: 'x', mouth: 'none' };
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

function inkCircle(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  r: number,
  fill: number,
): void {
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

function paintFace(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  pose: CharacterPose,
  spread = 15,
): void {
  const look = poseDraw(pose);
  const eyeH = look.eye === 'squint' ? 6 : look.eye === 'wide' ? 18 : 14;
  const eyeW = look.eye === 'wide' ? 13 : 11;
  for (const side of [-1, 1]) {
    const x = cx + side * spread;
    g.fillStyle(INK, 1);
    g.fillEllipse(x, cy, eyeW + 4, eyeH + 4);
    if (look.eye === 'x') {
      g.fillStyle(0xf4efe4, 1);
      g.fillEllipse(x, cy, eyeW, eyeH);
      g.lineStyle(2.4, INK, 1);
      g.lineBetween(x - 4, cy - 4, x + 4, cy + 4);
      g.lineBetween(x + 4, cy - 4, x - 4, cy + 4);
      continue;
    }
    g.fillStyle(0xfff6ea, 1);
    g.fillEllipse(x, cy, eyeW, eyeH);
    g.fillStyle(0xff1a1a, 1);
    g.fillEllipse(x + side, cy + 1, eyeW * 0.55, eyeH * 0.55);
    g.fillStyle(0x140000, 1);
    g.fillCircle(x + side, cy + 2, 2.2);
    g.fillStyle(INK, 1);
    const browY = cy - eyeH * 0.62;
    g.fillTriangle(x - 7, browY + 1, x + 7, browY - 4, x + 6, browY + 3);
  }
  switch (look.mouth) {
    case 'grin':
      g.lineStyle(2.6, INK, 1);
      g.beginPath();
      g.arc(cx, cy + 9, 7, 0.12 * Math.PI, 0.88 * Math.PI, false);
      g.strokePath();
      break;
    case 'open':
      g.fillStyle(INK, 1);
      g.fillEllipse(cx, cy + 12, 14, 12);
      g.fillStyle(0x6a1020, 1);
      g.fillEllipse(cx, cy + 12, 9, 8);
      break;
    case 'flat':
      g.fillStyle(INK, 1);
      g.fillRoundedRect(cx - 7, cy + 9, 14, 3, 1);
      break;
    case 'none':
      break;
    default: {
      const neverMouth: never = look.mouth;
      return neverMouth;
    }
  }
}

function paintFeet(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  y: number,
  pose: CharacterPose,
  fill: number,
  width = 16,
): void {
  const run = pose === 'move' ? 5 : pose === 'attack' ? 7 : 0;
  const dead = pose === 'dead' ? 8 : 0;
  inkRoundRect(g, cx - 22 - run, y + dead, width, 11, 4, fill);
  inkRoundRect(g, cx + 6 + run, y + dead, width, 11, 4, fill);
}

function drawGrass(g: Phaser.GameObjects.Graphics, variant: MiniBossVariant, pose: CharacterPose): void {
  const p = poseDraw(pose);
  const cx = 64 + p.lean;
  const cy = 70 + p.dy;
  const r = 30 * p.squash;
  const leafN = variant === 3 ? 5 : 4;
  for (let i = 0; i < leafN; i += 1) {
    const t = (i / (leafN - 1) - 0.5) * 1.15;
    const tipX = cx + t * 38;
    const tipY = cy - r - 28 - Math.abs(t) * 6 - (i === Math.floor(leafN / 2) ? 8 : 0);
    inkTriangle(g, cx + t * 8, cy - r + 4, cx + t * 18, cy - r + 10, tipX, tipY, i % 2 === 0 ? 0x4aa028 : 0x6bcc3a);
  }
  if (variant >= 2) {
    inkEllipse(g, cx, cy - r + 6, 54, 16, 0x3d8a32);
  }
  inkEllipse(g, cx, cy, r * 2.05, r * 2.35, 0xf2e4c4);
  g.fillStyle(0xd7c49a, 1);
  g.fillEllipse(cx + 4, cy + r * 0.35, r * 1.5, r * 1.05);
  g.fillStyle(0xc9a0d4, 0.85);
  g.fillEllipse(cx - 10, cy + 2, 12, 10);
  g.fillStyle(0xfff8e8, 0.7);
  g.fillEllipse(cx - 10, cy - 10, 16, 10);
  if (variant === 3) {
    inkCircle(g, cx + 2, cy - r - 30, 8, 0xe23b3b);
    g.fillStyle(0xfff1a8, 1);
    g.fillCircle(cx + 2, cy - r - 30, 3);
  }
  paintFace(g, cx, cy - 4, pose, 13);
  paintFeet(g, cx, cy + r + 2, pose, 0x6b4423, 15);
}

function drawSnow(g: Phaser.GameObjects.Graphics, variant: MiniBossVariant, pose: CharacterPose): void {
  const p = poseDraw(pose);
  const cx = 64 + p.lean;
  const cy = 78 + p.dy;
  const bodyR = 32 * p.squash;
  const headR = 20 * p.squash;
  const capY = cy - bodyR - headR + 8;
  if (variant >= 2) {
    for (const x of [-22, -8, 8, 22]) {
      inkTriangle(g, cx + x - 4, capY + 6, cx + x + 4, capY + 6, cx + x, capY + 22, 0xb7e4ff);
    }
  }
  inkEllipse(g, cx, cy, bodyR * 2.1, bodyR * 1.9, 0xf4fbff);
  g.fillStyle(0xcfe7f7, 1);
  g.fillEllipse(cx + 6, cy + 8, bodyR * 1.2, bodyR);
  inkCircle(g, cx, cy - bodyR + 4, headR, 0xf4fbff);
  g.fillStyle(INK, 1);
  g.fillCircle(cx, cy - 4, 3.2);
  g.fillCircle(cx, cy + 8, 3.2);
  g.fillCircle(cx, cy + 20, 3.2);
  inkRoundRect(g, cx - 40, cy - 18, 18, 5, 2, 0x6b4423);
  inkRoundRect(g, cx + 22, cy - 18, 18, 5, 2, 0x6b4423);
  inkEllipse(g, cx, capY, variant === 3 ? 92 : 84, 34, 0x5ba3d0);
  g.fillStyle(0x8ec8e8, 1);
  g.fillEllipse(cx - 10, capY - 4, 36, 14);
  g.fillStyle(0xf4fbff, 1);
  g.fillCircle(cx - 16, capY, 5);
  g.fillCircle(cx + 10, capY + 2, 4);
  if (variant === 3) {
    inkTriangle(g, cx - 10, capY - 14, cx + 10, capY - 14, cx, capY - 32, 0xd9eefc);
    inkTriangle(g, cx - 22, capY - 10, cx - 8, capY - 10, cx - 15, capY - 24, 0xb7e4ff);
    inkTriangle(g, cx + 8, capY - 10, cx + 22, capY - 10, cx + 15, capY - 24, 0xb7e4ff);
  }
  paintFace(g, cx, cy - bodyR + 2, pose, 11);
  paintFeet(g, cx, cy + bodyR - 2, pose, 0x7f9bb0, 16);
}

function drawDesert(g: Phaser.GameObjects.Graphics, variant: MiniBossVariant, pose: CharacterPose): void {
  const p = poseDraw(pose);
  const cx = 64 + p.lean;
  const cy = 80 + p.dy;
  const r = 28 * p.squash;
  inkEllipse(g, cx, cy + 8, r * 2.15, r * 2.05, 0xe8c36a);
  g.fillStyle(0xc9953f, 1);
  g.fillEllipse(cx + 6, cy + 16, r * 1.4, r);
  inkEllipse(g, cx - 22, cy + 2, 28, 18, 0xb8860b);
  inkEllipse(g, cx + 22, cy + 2, 28, 18, 0xb8860b);
  const hatW = variant === 3 ? 54 : 48;
  inkRoundRect(g, cx - hatW, cy - r - 28, hatW * 2, 26, 4, 0xf0d48a);
  g.fillStyle(0x8a5a22, 1);
  for (let i = 0; i < 6; i += 1) {
    g.fillRect(cx - hatW + 6 + i * 16, cy - r - 24, 6, 18);
  }
  inkRoundRect(g, cx - hatW + 4, cy - r - 8, 16, 36, 3, 0xe8c36a);
  inkRoundRect(g, cx + hatW - 20, cy - r - 8, 16, 36, 3, 0xe8c36a);
  inkEllipse(g, cx, cy - r + 6, 40, 36, 0x2a9d8f);
  g.fillStyle(0x1d7a70, 1);
  g.fillEllipse(cx + 4, cy - r + 12, 22, 18);
  if (variant >= 2) {
    inkTriangle(g, cx - 6, cy - r - 28, cx + 6, cy - r - 28, cx, cy - r - 46, 0x2a9d8f);
  }
  if (variant === 3) {
    inkCircle(g, cx, cy - r - 38, 8, 0xf0c75a);
    g.fillStyle(0xfff1a8, 1);
    g.fillCircle(cx, cy - r - 38, 3.4);
  }
  paintFace(g, cx, cy - r + 4, pose, 12);
  paintFeet(g, cx, cy + r + 6, pose, 0x8a5a22, 17);
}

function drawOcean(g: Phaser.GameObjects.Graphics, variant: MiniBossVariant, pose: CharacterPose): void {
  const p = poseDraw(pose);
  const cx = 58 + p.lean;
  const cy = 70 + p.dy;
  const r = 30 * p.squash;
  inkTriangle(g, cx + r - 4, cy, cx + r + 28, cy - 16, cx + r + 28, cy + 16, 0xe85d4c);
  inkEllipse(g, cx - r + 4, cy + 4, 22, 16, 0xff8a7a);
  inkCircle(g, cx, cy, r, 0xff6b6b);
  g.fillStyle(0xe85d4c, 1);
  g.fillEllipse(cx + 6, cy + 10, r * 1.15, r * 0.9);
  g.fillStyle(0xffc4b8, 0.8);
  g.fillEllipse(cx - 10, cy - 8, 18, 12);
  inkEllipse(g, cx, cy + r - 4, 56, 18, 0xf0c75a);
  const branches = variant === 3 ? 5 : variant === 2 ? 4 : 3;
  for (let i = 0; i < branches; i += 1) {
    const t = (i / Math.max(1, branches - 1) - 0.5) * 1.2;
    const baseX = cx + t * 16;
    const baseY = cy - r + 4;
    const tipX = cx + t * 42;
    const tipY = cy - r - 26 - (1 - Math.abs(t)) * 10;
    inkTriangle(g, baseX - 6, baseY, baseX + 6, baseY, tipX, tipY, i % 2 === 0 ? 0xff8a7a : 0xf0c75a);
    if (variant >= 2) {
      inkCircle(g, tipX, tipY, 5, 0xfff1a8);
    }
  }
  if (variant === 3) {
    inkCircle(g, cx + 18, cy - 6, 7, 0xf4fbff);
  }
  paintFace(g, cx - 2, cy - 4, pose, 13);
}

function drawCastle(g: Phaser.GameObjects.Graphics, variant: MiniBossVariant, pose: CharacterPose): void {
  const p = poseDraw(pose);
  const cx = 64 + p.lean;
  const cy = 68 + p.dy;
  const r = 30 * p.squash;
  const teeth = variant === 3 ? 10 : 8;
  const outer = r + (variant === 3 ? 16 : 12);
  g.fillStyle(INK, 1);
  for (let i = 0; i < teeth; i += 1) {
    const a = (Math.PI * 2 * i) / teeth;
    g.fillTriangle(
      cx + Math.cos(a) * outer,
      cy + Math.sin(a) * outer,
      cx + Math.cos(a - 0.2) * r,
      cy + Math.sin(a - 0.2) * r,
      cx + Math.cos(a + 0.2) * r,
      cy + Math.sin(a + 0.2) * r,
    );
  }
  g.fillStyle(0xc4a05a, 1);
  for (let i = 0; i < teeth; i += 1) {
    const a = (Math.PI * 2 * i) / teeth;
    g.fillTriangle(
      cx + Math.cos(a) * (outer - 3),
      cy + Math.sin(a) * (outer - 3),
      cx + Math.cos(a - 0.16) * (r - 1),
      cy + Math.sin(a - 0.16) * (r - 1),
      cx + Math.cos(a + 0.16) * (r - 1),
      cy + Math.sin(a + 0.16) * (r - 1),
    );
  }
  inkCircle(g, cx, cy, r, 0xc4a05a);
  g.fillStyle(0x8a5a22, 1);
  g.fillCircle(cx + 6, cy + 10, r * 0.38);
  inkRoundRect(g, cx - 24, cy - 22, 48, 10, 4, 0x2a1c18);
  g.fillStyle(0xff3030, 0.85);
  g.fillRoundedRect(cx - 20, cy - 20, 40, 6, 2);
  g.fillStyle(0x3a2a18, 1);
  g.fillCircle(cx, cy + 18, 8);
  g.fillStyle(0xf0d48a, 1);
  g.fillCircle(cx, cy + 18, 4);
  const keyH = variant === 3 ? 26 : 16;
  inkRoundRect(g, cx - 4, cy - r - keyH, 8, keyH + 4, 2, 0x8a5a22);
  inkCircle(g, cx, cy - r - keyH, variant >= 2 ? 10 : 8, 0xc4a05a);
  if (variant >= 2) {
    inkCircle(g, cx - r - 2, cy + 8, 10, 0x8a5a22);
    inkCircle(g, cx + r + 2, cy + 8, 10, 0x8a5a22);
  }
  paintFace(g, cx, cy - 4, pose, 11);
  paintFeet(g, cx, cy + r + 4, pose, 0x4a3420, 14);
}

function drawRainforest(g: Phaser.GameObjects.Graphics, variant: MiniBossVariant, pose: CharacterPose): void {
  const p = poseDraw(pose);
  const cx = 64 + p.lean;
  const cy = 66 + p.dy;
  const hw = 52 + (variant === 3 ? 6 : 0);
  const hh = 54 * p.squash;
  g.fillStyle(INK, 1);
  g.fillTriangle(cx, cy - hh - 4, cx - hw - 4, cy, cx + hw + 4, cy);
  g.fillTriangle(cx, cy + hh + 4, cx - hw - 4, cy, cx + hw + 4, cy);
  g.fillStyle(0x2a7028, 1);
  g.fillTriangle(cx, cy - hh, cx - hw, cy, cx + hw, cy);
  g.fillTriangle(cx, cy + hh, cx - hw, cy, cx + hw, cy);
  g.fillStyle(0x3a9a3a, 1);
  g.fillTriangle(cx, cy - hh + 8, cx - hw + 12, cy, cx + 8, cy);
  g.fillStyle(0x6a8a32, 1);
  g.fillTriangle(cx + 4, cy - 8, cx + hw - 8, cy, cx, cy + hh - 10);
  inkEllipse(g, cx, cy + 8, 42, 36, 0xc68642);
  g.fillStyle(0xa86b32, 1);
  g.fillEllipse(cx + 5, cy + 14, 24, 18);
  if (variant >= 2) {
    inkRoundRect(g, cx - 36, cy + 18, 8, 28, 3, 0x4aa028);
    inkRoundRect(g, cx + 28, cy + 18, 8, 28, 3, 0x4aa028);
    inkCircle(g, cx - 32, cy + 48, 6, 0x3a9a3a);
    inkCircle(g, cx + 32, cy + 48, 6, 0x3a9a3a);
  }
  if (variant === 3) {
    inkCircle(g, cx + 18, cy - hh + 18, 9, 0xe23b3b);
    g.fillStyle(0xfff1a8, 1);
    g.fillCircle(cx + 18, cy - hh + 18, 3);
  }
  paintFace(g, cx, cy + 2, pose, 12);
  paintFeet(g, cx, cy + hh - 8, pose, 0x4a3420, 16);
}

function drawTheme(
  g: Phaser.GameObjects.Graphics,
  theme: Theme,
  variant: MiniBossVariant,
  pose: CharacterPose,
): void {
  switch (theme) {
    case 'grass':
      drawGrass(g, variant, pose);
      return;
    case 'snow':
      drawSnow(g, variant, pose);
      return;
    case 'desert':
      drawDesert(g, variant, pose);
      return;
    case 'ocean':
      drawOcean(g, variant, pose);
      return;
    case 'castle':
      drawCastle(g, variant, pose);
      return;
    case 'rainforest':
      drawRainforest(g, variant, pose);
      return;
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

export function miniBossTextureKey(theme: Theme, variant: MiniBossVariant, pose: CharacterPose): string {
  return `mini-${theme}-${variant}-${pose}`;
}

export function createMiniBossTextures(scene: Phaser.Scene): void {
  for (const theme of THEMES) {
    for (const variant of VARIANTS) {
      for (const pose of POSES) {
        const g = gfx(scene);
        drawTheme(g, theme, variant, pose);
        commit(g, miniBossTextureKey(theme, variant, pose));
      }
    }
  }
}
