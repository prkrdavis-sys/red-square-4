import Phaser from 'phaser';
import { GROUND_Y, THEMES, TILE, type Theme } from '../config';

/** Foreground dressing may never rise more than three tiles off the floor. */
export const FOREGROUND_MAX_TILES = 3;
export const FOREGROUND_MAX_PX = FOREGROUND_MAX_TILES * TILE;

const LIP_W = 384;
const LIP_H = 72;
const LIP_DEPTH = 26;
const PROP_DEPTH = 28;
const SPAWN_CLEAR_TILES = 6;

type PropMotion = 'still' | 'sway' | 'flicker' | 'bob';
type PropSize = 'small' | 'large';

interface PropSpec {
  id: string;
  w: number;
  h: number;
  motion: PropMotion;
  alpha: number;
  weight: number;
  footprint: number;
  size: PropSize;
}

function css(color: number, alpha = 1): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

function paintCanvas(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
): void {
  if (h > FOREGROUND_MAX_PX || w < 8 || h < 8) {
    return;
  }
  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
  const texture = scene.textures.createCanvas(key, w, h);
  if (!texture) {
    return;
  }
  paint(texture.getContext());
  texture.refresh();
}

function fillEllipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.6, rx), Math.max(0.6, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

function fillCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  fillEllipse(ctx, x, y, r, r);
}

function wrapDraw(x: number, width: number, pad: number, draw: (ox: number) => void): void {
  draw(0);
  if (x < pad) {
    draw(width);
  }
  if (x > width - pad) {
    draw(-width);
  }
}

function propKey(theme: Theme, id: string): string {
  return `fg-${theme}-${id}`;
}

export function foregroundLipKey(theme: Theme): string {
  return `fg-${theme}-lip`;
}

function specsFor(theme: Theme): PropSpec[] {
  switch (theme) {
    case 'grass':
      return [
        { id: 'tuft', w: 58, h: 42, motion: 'sway', alpha: 0.96, weight: 3.4, footprint: 1, size: 'small' },
        { id: 'flowers', w: 74, h: 78, motion: 'sway', alpha: 0.92, weight: 1.7, footprint: 1, size: 'small' },
        { id: 'shroom', w: 46, h: 54, motion: 'still', alpha: 0.96, weight: 0.9, footprint: 1, size: 'small' },
        { id: 'fern', w: 96, h: 118, motion: 'sway', alpha: 0.86, weight: 1.5, footprint: 2, size: 'large' },
        { id: 'bush', w: 124, h: 100, motion: 'still', alpha: 0.84, weight: 1.9, footprint: 2, size: 'large' },
        { id: 'bush-lg', w: 176, h: 148, motion: 'still', alpha: 0.8, weight: 1.1, footprint: 3, size: 'large' },
      ];
    case 'snow':
      return [
        { id: 'tuft', w: 54, h: 38, motion: 'sway', alpha: 0.94, weight: 2.8, footprint: 1, size: 'small' },
        { id: 'mound', w: 110, h: 72, motion: 'still', alpha: 0.9, weight: 2.0, footprint: 2, size: 'small' },
        { id: 'rock', w: 78, h: 52, motion: 'still', alpha: 0.94, weight: 1.2, footprint: 1, size: 'small' },
        { id: 'crystals', w: 70, h: 92, motion: 'flicker', alpha: 0.88, weight: 1.1, footprint: 1, size: 'small' },
        { id: 'snowman', w: 64, h: 96, motion: 'still', alpha: 0.92, weight: 0.7, footprint: 1, size: 'large' },
        { id: 'pine', w: 88, h: 184, motion: 'sway', alpha: 0.82, weight: 1.3, footprint: 2, size: 'large' },
      ];
    case 'desert':
      return [
        { id: 'grass', w: 56, h: 44, motion: 'sway', alpha: 0.94, weight: 2.6, footprint: 1, size: 'small' },
        { id: 'rock', w: 80, h: 46, motion: 'still', alpha: 0.94, weight: 1.5, footprint: 1, size: 'small' },
        { id: 'skull', w: 58, h: 40, motion: 'still', alpha: 0.95, weight: 0.7, footprint: 1, size: 'small' },
        { id: 'pot', w: 48, h: 50, motion: 'still', alpha: 0.94, weight: 0.6, footprint: 1, size: 'small' },
        { id: 'tumble', w: 56, h: 56, motion: 'still', alpha: 0.88, weight: 0.8, footprint: 1, size: 'small' },
        { id: 'pear', w: 78, h: 110, motion: 'still', alpha: 0.86, weight: 1.3, footprint: 2, size: 'large' },
        { id: 'cactus', w: 72, h: 176, motion: 'sway', alpha: 0.84, weight: 1.5, footprint: 2, size: 'large' },
      ];
    case 'ocean':
      return [
        { id: 'grass', w: 60, h: 52, motion: 'sway', alpha: 0.9, weight: 2.8, footprint: 1, size: 'small' },
        { id: 'shell', w: 50, h: 36, motion: 'still', alpha: 0.94, weight: 1.1, footprint: 1, size: 'small' },
        { id: 'star', w: 48, h: 40, motion: 'still', alpha: 0.92, weight: 0.9, footprint: 1, size: 'small' },
        { id: 'anemone', w: 58, h: 78, motion: 'bob', alpha: 0.88, weight: 1.4, footprint: 1, size: 'small' },
        { id: 'fan', w: 92, h: 118, motion: 'sway', alpha: 0.82, weight: 1.3, footprint: 2, size: 'large' },
        { id: 'coral', w: 110, h: 104, motion: 'still', alpha: 0.84, weight: 1.5, footprint: 2, size: 'large' },
        { id: 'kelp', w: 54, h: 168, motion: 'sway', alpha: 0.8, weight: 1.6, footprint: 1, size: 'large' },
      ];
    case 'castle':
      return [
        { id: 'rubble', w: 78, h: 44, motion: 'still', alpha: 0.94, weight: 2.2, footprint: 1, size: 'small' },
        { id: 'bones', w: 62, h: 36, motion: 'still', alpha: 0.94, weight: 0.9, footprint: 1, size: 'small' },
        { id: 'bramble', w: 100, h: 86, motion: 'sway', alpha: 0.84, weight: 1.4, footprint: 2, size: 'large' },
        { id: 'fence', w: 132, h: 112, motion: 'still', alpha: 0.78, weight: 1.2, footprint: 2, size: 'large' },
        { id: 'column', w: 54, h: 120, motion: 'still', alpha: 0.88, weight: 0.9, footprint: 1, size: 'large' },
        { id: 'candelabra', w: 62, h: 148, motion: 'flicker', alpha: 0.9, weight: 1.0, footprint: 1, size: 'large' },
        { id: 'gargoyle', w: 84, h: 92, motion: 'still', alpha: 0.88, weight: 0.7, footprint: 2, size: 'large' },
      ];
    case 'rainforest':
      return [
        { id: 'tuft', w: 64, h: 50, motion: 'sway', alpha: 0.95, weight: 3.2, footprint: 1, size: 'small' },
        { id: 'moss', w: 90, h: 54, motion: 'still', alpha: 0.94, weight: 1.8, footprint: 1, size: 'small' },
        { id: 'shroom', w: 66, h: 64, motion: 'flicker', alpha: 0.92, weight: 1.1, footprint: 1, size: 'small' },
        { id: 'orchid', w: 74, h: 98, motion: 'sway', alpha: 0.9, weight: 1.2, footprint: 1, size: 'small' },
        { id: 'bloom', w: 68, h: 104, motion: 'sway', alpha: 0.9, weight: 1.0, footprint: 1, size: 'small' },
        { id: 'vine', w: 118, h: 88, motion: 'sway', alpha: 0.86, weight: 1.5, footprint: 2, size: 'large' },
        { id: 'fern', w: 132, h: 168, motion: 'sway', alpha: 0.84, weight: 1.7, footprint: 2, size: 'large' },
        { id: 'leaf', w: 148, h: 190, motion: 'sway', alpha: 0.82, weight: 1.3, footprint: 2, size: 'large' },
      ];
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

function paintLip(ctx: CanvasRenderingContext2D, theme: Theme): void {
  switch (theme) {
    case 'grass':
      paintGrassLip(ctx);
      return;
    case 'snow':
      paintSnowLip(ctx);
      return;
    case 'desert':
      paintDesertLip(ctx);
      return;
    case 'ocean':
      paintOceanLip(ctx);
      return;
    case 'castle':
      paintCastleLip(ctx);
      return;
    case 'rainforest':
      paintRainforestLip(ctx);
      return;
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

function paintProp(ctx: CanvasRenderingContext2D, theme: Theme, id: string, w: number, h: number): void {
  switch (theme) {
    case 'grass':
      paintGrassProp(ctx, id, w, h);
      return;
    case 'snow':
      paintSnowProp(ctx, id, w, h);
      return;
    case 'desert':
      paintDesertProp(ctx, id, w, h);
      return;
    case 'ocean':
      paintOceanProp(ctx, id, w, h);
      return;
    case 'castle':
      paintCastleProp(ctx, id, w, h);
      return;
    case 'rainforest':
      paintRainforestProp(ctx, id, w, h);
      return;
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

function stampBush(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  scale: number,
  outline: number,
  body: number,
  highlight: number,
): void {
  const r = 30 * scale;
  ctx.fillStyle = css(outline);
  fillEllipse(ctx, cx + 2, baseY - r * 0.78, r * 1.12, r * 0.92);
  fillEllipse(ctx, cx - r * 0.72, baseY - r * 0.5, r * 0.72, r * 0.6);
  fillEllipse(ctx, cx + r * 0.74, baseY - r * 0.48, r * 0.7, r * 0.58);
  ctx.fillStyle = css(body);
  fillEllipse(ctx, cx, baseY - r * 0.86, r * 1.04, r * 0.86);
  fillEllipse(ctx, cx - r * 0.7, baseY - r * 0.56, r * 0.66, r * 0.54);
  fillEllipse(ctx, cx + r * 0.72, baseY - r * 0.54, r * 0.64, r * 0.52);
  ctx.fillStyle = css(highlight, 0.55);
  fillEllipse(ctx, cx - r * 0.28, baseY - r * 1.18, r * 0.42, r * 0.28);
}

function stampBlades(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  count: number,
  tall: number,
  color: number,
  shade: number,
): void {
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const lean = (t - 0.5) * 16;
    const h = tall * (0.7 + (i % 3) * 0.12);
    ctx.fillStyle = css(i % 2 === 0 ? color : shade);
    ctx.beginPath();
    ctx.moveTo(x + (t - 0.5) * 18, baseY);
    ctx.quadraticCurveTo(x + lean * 0.3, baseY - h * 0.55, x + lean, baseY - h);
    ctx.quadraticCurveTo(x + lean * 0.15 + 2, baseY - h * 0.5, x + (t - 0.5) * 18 + 3.4, baseY);
    ctx.closePath();
    ctx.fill();
  }
}

function paintGrassLip(ctx: CanvasRenderingContext2D): void {
  const clumps = [18, 46, 78, 112, 148, 186, 224, 258, 296, 332, 362];
  for (const x of clumps) {
    wrapDraw( x, LIP_W, 28, (ox) => {
      stampBlades(ctx, x + ox, LIP_H, 5, 28 + (x % 17), 0x3d9e2f, 0x2d7a22);
      stampBlades(ctx, x + ox + 6, LIP_H, 3, 36, 0x58c43c, 0x3d9e2f);
    });
  }
  ctx.fillStyle = css(0xffe066, 0.95);
  for (const flower of [
    { x: 64, y: 38 },
    { x: 190, y: 34 },
    { x: 310, y: 40 },
  ]) {
    wrapDraw( flower.x, LIP_W, 10, (ox) => {
      fillCircle(ctx, flower.x + ox, flower.y, 3.2);
      ctx.fillStyle = css(0xff7aa2, 0.95);
      fillCircle(ctx, flower.x + ox + 22, flower.y + 6, 2.6);
      ctx.fillStyle = css(0xffe066, 0.95);
    });
  }
}

function paintGrassProp(ctx: CanvasRenderingContext2D, id: string, w: number, h: number): void {
  const cx = w / 2;
  switch (id) {
    case 'tuft':
      stampBlades(ctx, cx, h, 6, 34, 0x3d9e2f, 0x246218);
      stampBlades(ctx, cx + 4, h, 4, 40, 0x6bcc3a, 0x4aa028);
      return;
    case 'flowers':
      stampBlades(ctx, cx, h, 5, 46, 0x2d7a22, 0x3d9e2f);
      for (const bloom of [
        { x: cx - 16, y: h - 58, c: 0xfff4c4 },
        { x: cx + 2, y: h - 70, c: 0xff7aa2 },
        { x: cx + 18, y: h - 52, c: 0xffe066 },
      ]) {
        ctx.strokeStyle = css(0x2d7a22);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx + (bloom.x - cx) * 0.2, h);
        ctx.quadraticCurveTo(bloom.x, (bloom.y + h) / 2, bloom.x, bloom.y + 6);
        ctx.stroke();
        ctx.fillStyle = css(bloom.c);
        fillCircle(ctx, bloom.x, bloom.y, 6);
        ctx.fillStyle = css(0xfff8e0);
        fillCircle(ctx, bloom.x - 1, bloom.y - 1, 2.2);
      }
      return;
    case 'shroom':
      ctx.fillStyle = css(0xe8d8b8);
      fillEllipse(ctx, cx, h - 14, 7, 16);
      ctx.fillStyle = css(0xd44a4a);
      fillEllipse(ctx, cx, h - 30, 20, 14);
      ctx.fillStyle = css(0xc03838);
      ctx.fillRect(cx - 20, h - 30, 40, 10);
      ctx.fillStyle = css(0xfff1d8);
      fillCircle(ctx, cx - 8, h - 34, 3);
      fillCircle(ctx, cx + 7, h - 28, 2.4);
      fillCircle(ctx, cx + 2, h - 36, 2);
      return;
    case 'fern':
      for (const frond of [
        { lean: -36, h: 100, shade: 0x245c28 },
        { lean: -12, h: 112, shade: 0x3d8a3a },
        { lean: 18, h: 104, shade: 0x2f6e32 },
        { lean: 38, h: 88, shade: 0x4aa028 },
      ]) {
        ctx.strokeStyle = css(frond.shade);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx, h);
        ctx.quadraticCurveTo(cx + frond.lean * 0.35, h - frond.h * 0.5, cx + frond.lean, h - frond.h);
        ctx.stroke();
        for (let i = 1; i <= 7; i += 1) {
          const t = i / 7;
          const px = cx + frond.lean * t * t;
          const py = h - frond.h * t;
          const leaf = 10 * (1 - t * 0.55);
          ctx.fillStyle = css(i % 2 ? 0x58c43c : frond.shade);
          ctx.beginPath();
          ctx.ellipse(px + (frond.lean > 0 ? leaf : -leaf), py, leaf, 4, frond.lean * 0.02, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      return;
    case 'bush':
      stampBush(ctx, cx, h, 1, 0x245818, 0x3d9e2f, 0x8ee06a);
      ctx.fillStyle = css(0xc43a4a);
      fillCircle(ctx, cx - 18, h - 54, 3);
      fillCircle(ctx, cx + 14, h - 42, 2.6);
      return;
    case 'bush-lg':
      stampBush(ctx, cx - 34, h, 0.92, 0x1e4a14, 0x2d7a22, 0x6bcc3a);
      stampBush(ctx, cx + 28, h, 1.12, 0x245818, 0x3d9e2f, 0x8ee06a);
      ctx.fillStyle = css(0xff7aa2);
      fillCircle(ctx, cx - 8, h - 88, 3.4);
      fillCircle(ctx, cx + 36, h - 70, 3);
      return;
    default:
      return;
  }
}

function paintSnowLip(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = css(0xf4fbff, 0.95);
  ctx.beginPath();
  ctx.moveTo(0, LIP_H);
  for (let x = 0; x <= LIP_W; x += 8) {
    ctx.lineTo(x, LIP_H - 16 - 6 * Math.sin(x * 0.05) - 3 * Math.sin(x * 0.13));
  }
  ctx.lineTo(LIP_W, LIP_H);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css(0xffffff, 0.7);
  for (const spark of [40, 98, 160, 230, 290, 348]) {
    wrapDraw( spark, LIP_W, 8, (ox) => {
      fillCircle(ctx, spark + ox, LIP_H - 22 - (spark % 9), 1.6);
    });
  }
  const tufts = [28, 120, 210, 300, 360];
  for (const x of tufts) {
    wrapDraw( x, LIP_W, 16, (ox) => {
      stampBlades(ctx, x + ox, LIP_H - 8, 3, 18, 0xb7d0c4, 0x8aa8a0);
    });
  }
}

function paintSnowProp(ctx: CanvasRenderingContext2D, id: string, w: number, h: number): void {
  const cx = w / 2;
  switch (id) {
    case 'tuft':
      stampBlades(ctx, cx, h, 5, 30, 0xc5dcd0, 0x8aa8b4);
      ctx.fillStyle = css(0xffffff, 0.8);
      fillEllipse(ctx, cx, h - 6, 18, 5);
      return;
    case 'mound':
      stampBush(ctx, cx, h, 0.86, 0x9bb8c8, 0xe8f4fc, 0xffffff);
      ctx.fillStyle = css(0xffffff, 0.7);
      fillEllipse(ctx, cx - 10, h - 58, 16, 8);
      return;
    case 'rock':
      ctx.fillStyle = css(0x7a9bb4);
      fillEllipse(ctx, cx, h - 16, 28, 16);
      ctx.fillStyle = css(0x5d7c94);
      fillEllipse(ctx, cx + 10, h - 14, 16, 12);
      ctx.fillStyle = css(0xffffff);
      fillEllipse(ctx, cx - 4, h - 26, 22, 8);
      return;
    case 'crystals':
      for (const shard of [
        { x: cx - 14, h: 70, w: 10, c: 0x9ad4f0 },
        { x: cx + 2, h: 86, w: 12, c: 0xc8f0ff },
        { x: cx + 16, h: 58, w: 9, c: 0x7eb8d8 },
      ]) {
        ctx.fillStyle = css(0x4a7a98, 0.85);
        ctx.beginPath();
        ctx.moveTo(shard.x, h);
        ctx.lineTo(shard.x - shard.w / 2, h - shard.h * 0.35);
        ctx.lineTo(shard.x, h - shard.h);
        ctx.lineTo(shard.x + shard.w / 2, h - shard.h * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = css(shard.c, 0.92);
        ctx.beginPath();
        ctx.moveTo(shard.x, h - 4);
        ctx.lineTo(shard.x - shard.w * 0.28, h - shard.h * 0.35);
        ctx.lineTo(shard.x, h - shard.h + 6);
        ctx.lineTo(shard.x + shard.w * 0.18, h - shard.h * 0.4);
        ctx.closePath();
        ctx.fill();
      }
      return;
    case 'snowman':
      ctx.fillStyle = css(0xe8f2fa);
      fillCircle(ctx, cx, h - 22, 20);
      fillCircle(ctx, cx, h - 52, 15);
      ctx.fillStyle = css(0xffffff);
      fillEllipse(ctx, cx - 5, h - 58, 8, 6);
      ctx.fillStyle = css(0x2a2420);
      fillCircle(ctx, cx - 5, h - 54, 1.8);
      fillCircle(ctx, cx + 5, h - 54, 1.8);
      fillCircle(ctx, cx, h - 24, 1.6);
      fillCircle(ctx, cx, h - 18, 1.6);
      ctx.fillStyle = css(0xe07a30);
      ctx.beginPath();
      ctx.moveTo(cx, h - 50);
      ctx.lineTo(cx + 12, h - 48);
      ctx.lineTo(cx, h - 47);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = css(0x5a3a20);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 18, h - 36);
      ctx.lineTo(cx - 30, h - 46);
      ctx.moveTo(cx + 16, h - 36);
      ctx.lineTo(cx + 28, h - 30);
      ctx.stroke();
      return;
    case 'pine':
      ctx.fillStyle = css(0x5a3a20);
      ctx.fillRect(cx - 5, h - 28, 10, 28);
      const tiers = [
        { y: h - 40, hw: 40, hh: 36, c: 0x2a5a3a },
        { y: h - 78, hw: 32, hh: 34, c: 0x347048 },
        { y: h - 114, hw: 24, hh: 32, c: 0x3d8a52 },
        { y: h - 146, hw: 16, hh: 28, c: 0x4aa062 },
      ];
      for (const tier of tiers) {
        ctx.fillStyle = css(tier.c);
        ctx.beginPath();
        ctx.moveTo(cx, tier.y - tier.hh);
        ctx.lineTo(cx + tier.hw, tier.y + 8);
        ctx.lineTo(cx - tier.hw, tier.y + 8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = css(0xffffff, 0.88);
        ctx.beginPath();
        ctx.moveTo(cx, tier.y - tier.hh);
        ctx.lineTo(cx + tier.hw * 0.42, tier.y - tier.hh + 14);
        ctx.lineTo(cx - tier.hw * 0.38, tier.y - tier.hh + 12);
        ctx.closePath();
        ctx.fill();
      }
      return;
    default:
      return;
  }
}

function paintDesertLip(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = css(0xd4a24a, 0.55);
  for (let x = 0; x <= LIP_W; x += 2) {
    const y = LIP_H - 10 - 4 * Math.sin(x * 0.04) - 2 * Math.sin(x * 0.11);
    ctx.fillRect(x, y, 2, LIP_H - y);
  }
  ctx.fillStyle = css(0x8a5a22, 0.8);
  for (const pebble of [36, 88, 150, 214, 270, 328]) {
    wrapDraw( pebble, LIP_W, 10, (ox) => {
      fillEllipse(ctx, pebble + ox, LIP_H - 8, 5 + (pebble % 5), 3);
    });
  }
  for (const x of [54, 170, 248, 350]) {
    wrapDraw( x, LIP_W, 14, (ox) => {
      stampBlades(ctx, x + ox, LIP_H, 3, 20, 0xc4a05a, 0x8a6a30);
    });
  }
}

function paintDesertProp(ctx: CanvasRenderingContext2D, id: string, w: number, h: number): void {
  const cx = w / 2;
  switch (id) {
    case 'grass':
      stampBlades(ctx, cx, h, 5, 36, 0xc4a05a, 0x8a6a30);
      return;
    case 'rock':
      ctx.fillStyle = css(0xb8863a);
      fillEllipse(ctx, cx, h - 14, 30, 14);
      ctx.fillStyle = css(0x8a5a22);
      fillEllipse(ctx, cx + 12, h - 12, 16, 10);
      ctx.fillStyle = css(0xf0d48a, 0.45);
      fillEllipse(ctx, cx - 8, h - 20, 12, 5);
      return;
    case 'skull':
      ctx.fillStyle = css(0xe8d8b0);
      fillEllipse(ctx, cx, h - 20, 16, 12);
      ctx.fillStyle = css(0x3a2a18);
      fillCircle(ctx, cx - 6, h - 22, 3.2);
      fillCircle(ctx, cx + 6, h - 22, 3.2);
      ctx.fillRect(cx - 2, h - 16, 4, 5);
      ctx.fillStyle = css(0xe8d8b0);
      ctx.fillRect(cx - 10, h - 10, 5, 8);
      ctx.fillRect(cx + 5, h - 10, 5, 8);
      return;
    case 'pot':
      ctx.fillStyle = css(0xa45a2a);
      fillEllipse(ctx, cx, h - 16, 16, 14);
      ctx.fillRect(cx - 16, h - 22, 32, 10);
      ctx.fillStyle = css(0xc4783a);
      fillEllipse(ctx, cx, h - 28, 12, 6);
      ctx.fillStyle = css(0x5a3014);
      ctx.beginPath();
      ctx.moveTo(cx + 6, h - 34);
      ctx.lineTo(cx + 18, h - 18);
      ctx.lineTo(cx + 8, h - 14);
      ctx.closePath();
      ctx.fill();
      return;
    case 'tumble':
      ctx.strokeStyle = css(0x8a6a38);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, h - 26, 22, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 7; i += 1) {
        const a = (Math.PI * 2 * i) / 7;
        ctx.beginPath();
        ctx.moveTo(cx, h - 26);
        ctx.lineTo(cx + Math.cos(a) * 20, h - 26 + Math.sin(a) * 20);
        ctx.stroke();
      }
      return;
    case 'pear':
      const pads = [
        { x: cx, y: h - 28, rx: 18, ry: 22 },
        { x: cx - 16, y: h - 58, rx: 16, ry: 20 },
        { x: cx + 14, y: h - 72, rx: 15, ry: 18 },
        { x: cx + 4, y: h - 96, rx: 12, ry: 14 },
      ];
      for (const pad of pads) {
        ctx.fillStyle = css(0x3d7a2a);
        fillEllipse(ctx, pad.x, pad.y, pad.rx, pad.ry);
        ctx.fillStyle = css(0x58a040, 0.55);
        fillEllipse(ctx, pad.x - 4, pad.y - 4, pad.rx * 0.45, pad.ry * 0.4);
        ctx.strokeStyle = css(0xe8d8a0, 0.7);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.x + pad.rx - 2, pad.y);
        ctx.lineTo(pad.x + pad.rx + 5, pad.y - 4);
        ctx.stroke();
      }
      ctx.fillStyle = css(0xe85a7a);
      fillCircle(ctx, cx + 8, h - 108, 3);
      return;
    case 'cactus':
      ctx.fillStyle = css(0x2d6a28);
      fillEllipse(ctx, cx, h - 70, 16, 70);
      fillEllipse(ctx, cx - 22, h - 88, 10, 28);
      fillEllipse(ctx, cx + 20, h - 108, 9, 24);
      ctx.fillStyle = css(0x3d8a34, 0.5);
      ctx.fillRect(cx - 3, h - 130, 3, 110);
      ctx.strokeStyle = css(0xe8d8a8, 0.65);
      ctx.lineWidth = 1;
      for (let y = h - 20; y > h - 140; y -= 14) {
        ctx.beginPath();
        ctx.moveTo(cx + 14, y);
        ctx.lineTo(cx + 20, y - 5);
        ctx.stroke();
      }
      ctx.fillStyle = css(0xf0a0c8);
      fillCircle(ctx, cx, h - 148, 6);
      ctx.fillStyle = css(0xffe066);
      fillCircle(ctx, cx, h - 148, 2.4);
      return;
    default:
      return;
  }
}

function paintOceanLip(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = css(0x1a4050, 0.7);
  ctx.beginPath();
  ctx.moveTo(0, LIP_H);
  for (let x = 0; x <= LIP_W; x += 6) {
    ctx.lineTo(x, LIP_H - 12 - 5 * Math.sin(x * 0.06));
  }
  ctx.lineTo(LIP_W, LIP_H);
  ctx.closePath();
  ctx.fill();
  for (const x of [24, 70, 118, 168, 220, 268, 318, 360]) {
    wrapDraw( x, LIP_W, 16, (ox) => {
      stampBlades(ctx, x + ox, LIP_H, 4, 26, 0x1e8a6a, 0x0a4a40);
    });
  }
  ctx.fillStyle = css(0xe07a6a);
  for (const nug of [50, 200, 340]) {
    wrapDraw( nug, LIP_W, 10, (ox) => {
      fillEllipse(ctx, nug + ox, LIP_H - 10, 8, 6);
    });
  }
}

function paintOceanProp(ctx: CanvasRenderingContext2D, id: string, w: number, h: number): void {
  const cx = w / 2;
  switch (id) {
    case 'grass':
      stampBlades(ctx, cx, h, 6, 44, 0x1e8a6a, 0x0c3a38);
      return;
    case 'shell':
      ctx.fillStyle = css(0xe8c8a0);
      ctx.beginPath();
      ctx.moveTo(cx + 16, h - 6);
      for (let i = 0; i <= 8; i += 1) {
        const a = Math.PI * 1.15 + i * 0.28;
        const r = 6 + i * 1.6;
        ctx.lineTo(cx + Math.cos(a) * r, h - 14 + Math.sin(a) * r * 0.7);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = css(0xc49868, 0.7);
      ctx.lineWidth = 1.4;
      ctx.stroke();
      return;
    case 'star':
      ctx.fillStyle = css(0xf0a04a);
      ctx.beginPath();
      for (let i = 0; i < 5; i += 1) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        const b = a + Math.PI / 5;
        ctx.lineTo(cx + Math.cos(a) * 18, h - 18 + Math.sin(a) * 16);
        ctx.lineTo(cx + Math.cos(b) * 8, h - 18 + Math.sin(b) * 7);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = css(0xffd08a);
      fillCircle(ctx, cx, h - 18, 4);
      return;
    case 'anemone':
      ctx.fillStyle = css(0xa03a58);
      fillEllipse(ctx, cx, h - 14, 16, 12);
      for (let i = 0; i < 9; i += 1) {
        const t = i / 8;
        const lean = (t - 0.5) * 36;
        ctx.strokeStyle = css(i % 2 ? 0xf090b0 : 0xd06088);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx + (t - 0.5) * 14, h - 18);
        ctx.quadraticCurveTo(cx + lean * 0.4, h - 44, cx + lean, h - 68);
        ctx.stroke();
        ctx.fillStyle = css(0xffe0f0);
        fillCircle(ctx, cx + lean, h - 68, 2.4);
      }
      return;
    case 'fan':
      ctx.fillStyle = css(0x8a3a88, 0.9);
      ctx.beginPath();
      ctx.moveTo(cx, h);
      ctx.quadraticCurveTo(cx - 50, h - 40, cx - 40, h - 108);
      ctx.quadraticCurveTo(cx, h - 88, cx + 42, h - 110);
      ctx.quadraticCurveTo(cx + 50, h - 40, cx, h);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = css(0xe8a0e0, 0.55);
      ctx.lineWidth = 1.4;
      for (let i = -3; i <= 3; i += 1) {
        ctx.beginPath();
        ctx.moveTo(cx, h - 4);
        ctx.quadraticCurveTo(cx + i * 6, h - 50, cx + i * 12, h - 104);
        ctx.stroke();
      }
      return;
    case 'coral':
      ctx.fillStyle = css(0xc45a4a);
      fillEllipse(ctx, cx - 16, h - 28, 28, 22);
      fillEllipse(ctx, cx + 18, h - 36, 24, 20);
      fillEllipse(ctx, cx, h - 58, 22, 24);
      ctx.fillStyle = css(0xe87868, 0.5);
      fillEllipse(ctx, cx - 10, h - 64, 10, 8);
      ctx.strokeStyle = css(0xf0a898);
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + 8, h - 70);
      ctx.lineTo(cx + 6, h - 96);
      ctx.moveTo(cx + 6, h - 90);
      ctx.lineTo(cx - 10, h - 100);
      ctx.moveTo(cx + 8, h - 88);
      ctx.lineTo(cx + 22, h - 102);
      ctx.stroke();
      return;
    case 'kelp':
      const steps = 16;
      const left: [number, number][] = [];
      const right: [number, number][] = [];
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const y = h - (h - 8) * t;
        const sway = Math.sin(t * Math.PI * 2.2) * (6 + t * 16);
        const half = Math.max(1.4, 7 - t * 5);
        left.push([cx + sway - half, y]);
        right.push([cx + sway + half, y]);
      }
      ctx.fillStyle = css(0x0a3a38);
      ctx.beginPath();
      ctx.moveTo(left[0][0], left[0][1]);
      for (const p of left) {
        ctx.lineTo(p[0], p[1]);
      }
      for (let i = right.length - 1; i >= 0; i -= 1) {
        ctx.lineTo(right[i][0], right[i][1]);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = css(0x1a7a58, 0.7);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      left.forEach((p, i) => {
        const mid = (p[0] + right[i][0]) * 0.5;
        if (i === 0) {
          ctx.moveTo(mid, p[1]);
        } else {
          ctx.lineTo(mid, p[1]);
        }
      });
      ctx.stroke();
      return;
    default:
      return;
  }
}

function paintCastleLip(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = css(0x1a1018, 0.85);
  ctx.fillRect(0, LIP_H - 18, LIP_W, 18);
  ctx.strokeStyle = css(0x3a2438, 0.9);
  ctx.lineWidth = 2;
  for (let x = 0; x < LIP_W; x += 36) {
    ctx.beginPath();
    ctx.moveTo(x, LIP_H - 18);
    ctx.lineTo(x + 18, LIP_H);
    ctx.stroke();
  }
  ctx.fillStyle = css(0x2a1a28);
  for (const brick of [22, 70, 140, 200, 268, 330]) {
    wrapDraw( brick, LIP_W, 14, (ox) => {
      ctx.fillRect(brick + ox, LIP_H - 16 - (brick % 10), 16, 8);
    });
  }
  ctx.fillStyle = css(0x4a3048, 0.45);
  for (const moss of [48, 160, 250, 356]) {
    wrapDraw( moss, LIP_W, 12, (ox) => {
      fillEllipse(ctx, moss + ox, LIP_H - 8, 12, 4);
    });
  }
}

function paintCastleProp(ctx: CanvasRenderingContext2D, id: string, w: number, h: number): void {
  const cx = w / 2;
  switch (id) {
    case 'rubble':
      ctx.fillStyle = css(0x4e3e5c);
      ctx.fillRect(cx - 28, h - 16, 22, 12);
      ctx.fillStyle = css(0x6a5a78);
      ctx.fillRect(cx - 8, h - 22, 26, 16);
      ctx.fillStyle = css(0x3a2a44);
      ctx.fillRect(cx + 10, h - 12, 18, 10);
      ctx.fillStyle = css(0x9a88a8, 0.4);
      ctx.fillRect(cx - 6, h - 20, 10, 3);
      return;
    case 'bones':
      ctx.fillStyle = css(0xd8c8b0);
      ctx.fillRect(cx - 22, h - 10, 36, 5);
      fillCircle(ctx, cx - 24, h - 8, 5);
      fillCircle(ctx, cx + 16, h - 8, 5);
      ctx.fillRect(cx + 4, h - 22, 4, 18);
      fillCircle(ctx, cx + 6, h - 24, 4);
      return;
    case 'bramble':
      stampBush(ctx, cx, h, 0.78, 0x1a0810, 0x3a1830, 0x6a3048);
      ctx.strokeStyle = css(0x2a1018);
      ctx.lineWidth = 2;
      for (const thorn of [
        { x: cx - 28, y: h - 50 },
        { x: cx + 22, y: h - 62 },
        { x: cx - 6, y: h - 74 },
      ]) {
        ctx.beginPath();
        ctx.moveTo(thorn.x, thorn.y);
        ctx.lineTo(thorn.x + 8, thorn.y - 10);
        ctx.stroke();
      }
      ctx.fillStyle = css(0x8a2030);
      fillCircle(ctx, cx + 10, h - 48, 3);
      return;
    case 'fence':
      ctx.fillStyle = css(0x1a1218);
      ctx.fillRect(8, h - 14, w - 16, 10);
      ctx.strokeStyle = css(0x3a3038);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(12, h - 18);
      ctx.lineTo(w - 12, h - 18);
      ctx.moveTo(12, h - 48);
      ctx.lineTo(w - 12, h - 48);
      ctx.stroke();
      for (let i = 0; i < 6; i += 1) {
        const x = 16 + i * 20;
        ctx.fillStyle = css(0x2a2228);
        ctx.fillRect(x, h - 96, 6, 86);
        ctx.beginPath();
        ctx.moveTo(x - 2, h - 96);
        ctx.lineTo(x + 3, h - 110);
        ctx.lineTo(x + 8, h - 96);
        ctx.closePath();
        ctx.fill();
      }
      return;
    case 'column':
      ctx.fillStyle = css(0x3a2a44);
      ctx.fillRect(cx - 16, h - 18, 32, 18);
      ctx.fillStyle = css(0x5a4a68);
      ctx.fillRect(cx - 11, h - 100, 22, 84);
      ctx.fillStyle = css(0x2a1a32);
      ctx.fillRect(cx - 14, h - 108, 28, 12);
      ctx.fillStyle = css(0x9a88a8, 0.35);
      ctx.fillRect(cx - 8, h - 96, 4, 70);
      ctx.fillStyle = css(0x4e3e5c);
      ctx.beginPath();
      ctx.moveTo(cx + 12, h - 70);
      ctx.lineTo(cx + 22, h - 40);
      ctx.lineTo(cx + 10, h - 40);
      ctx.closePath();
      ctx.fill();
      return;
    case 'candelabra':
      ctx.fillStyle = css(0x2a2228);
      ctx.fillRect(cx - 14, h - 10, 28, 10);
      ctx.fillRect(cx - 3, h - 88, 6, 80);
      ctx.fillRect(cx - 22, h - 92, 44, 5);
      ctx.fillRect(cx - 20, h - 108, 4, 16);
      ctx.fillRect(cx - 2, h - 118, 4, 26);
      ctx.fillRect(cx + 16, h - 108, 4, 16);
      for (const flame of [
        { x: cx - 18, y: h - 118 },
        { x: cx, y: h - 128 },
        { x: cx + 18, y: h - 118 },
      ]) {
        ctx.fillStyle = css(0xff6622);
        fillEllipse(ctx, flame.x, flame.y, 5, 10);
        ctx.fillStyle = css(0xffe08a);
        fillEllipse(ctx, flame.x, flame.y - 3, 2.4, 5);
      }
      return;
    case 'gargoyle':
      ctx.fillStyle = css(0x3a2a40);
      ctx.fillRect(cx - 22, h - 16, 44, 16);
      fillEllipse(ctx, cx, h - 40, 22, 18);
      ctx.fillStyle = css(0x2a1a30);
      fillEllipse(ctx, cx + 4, h - 58, 14, 16);
      ctx.beginPath();
      ctx.moveTo(cx - 8, h - 68);
      ctx.lineTo(cx - 22, h - 86);
      ctx.lineTo(cx - 4, h - 70);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = css(0x1a0810);
      fillCircle(ctx, cx + 8, h - 60, 2.4);
      ctx.fillStyle = css(0x5a4a68, 0.5);
      fillEllipse(ctx, cx - 6, h - 46, 8, 4);
      return;
    default:
      return;
  }
}

function stampElephantEar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rot: number,
  body: number,
  vein: number,
  gloss: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = css(body);
  ctx.beginPath();
  ctx.moveTo(0, ry);
  ctx.quadraticCurveTo(rx * 1.05, ry * 0.42, rx * 0.88, -ry * 0.12);
  ctx.quadraticCurveTo(rx * 0.42, -ry * 1.02, 0, -ry * 0.32);
  ctx.quadraticCurveTo(-rx * 0.42, -ry * 1.02, -rx * 0.88, -ry * 0.12);
  ctx.quadraticCurveTo(-rx * 1.05, ry * 0.42, 0, ry);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css(gloss, 0.38);
  ctx.beginPath();
  ctx.ellipse(-rx * 0.22, -ry * 0.04, rx * 0.3, ry * 0.34, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = css(vein, 0.82);
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, ry * 0.82);
  ctx.quadraticCurveTo(3, ry * 0.1, 0, -ry * 0.22);
  ctx.stroke();
  ctx.lineWidth = 1.15;
  for (const side of [-1, 1]) {
    for (const t of [0.28, 0.5, 0.7]) {
      const py = ry * (0.7 - t * 1.05);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.quadraticCurveTo(side * rx * 0.35, py - 4, side * rx * 0.72, py - ry * 0.08);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function stampMistOrchid(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  petal: number,
  inner: number,
  scale: number,
): void {
  ctx.fillStyle = css(petal);
  for (const a of [-1.15, -0.55, 0, 0.55, 1.15]) {
    fillEllipse(ctx, x + Math.sin(a) * 7.2 * scale, y + Math.cos(a) * 3.4 * scale, 5.6 * scale, 3.6 * scale);
  }
  ctx.fillStyle = css(0x2a6b28, 0.9);
  fillEllipse(ctx, x, y + 5.2 * scale, 3.1 * scale, 4.8 * scale);
  ctx.fillStyle = css(inner);
  fillCircle(ctx, x, y, 2.5 * scale);
}

function paintRainforestLip(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = css(0x0a2818, 0.84);
  ctx.beginPath();
  ctx.moveTo(0, LIP_H);
  for (let x = 0; x <= LIP_W; x += 6) {
    ctx.lineTo(x, LIP_H - 16 - 6 * Math.sin(x * 0.065) - 3 * Math.sin(x * 0.17));
  }
  ctx.lineTo(LIP_W, LIP_H);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css(0x1a4a18, 0.72);
  ctx.beginPath();
  ctx.moveTo(0, LIP_H);
  for (let x = 0; x <= LIP_W; x += 6) {
    ctx.lineTo(x, LIP_H - 10 - 4 * Math.sin(x * 0.09 + 0.6));
  }
  ctx.lineTo(LIP_W, LIP_H);
  ctx.closePath();
  ctx.fill();
  for (const x of [18, 54, 92, 132, 176, 218, 258, 300, 340, 368]) {
    wrapDraw(x, LIP_W, 18, (ox) => {
      stampBlades(ctx, x + ox, LIP_H, 5, 28 + (x % 13), 0x1e5a28, 0x14382c);
      stampBlades(ctx, x + ox + 6, LIP_H, 3, 36, 0x3d8a32, 0x2a6b28);
    });
  }
  ctx.fillStyle = css(0x6a8a32, 0.8);
  for (const moss of [36, 124, 214, 308]) {
    wrapDraw(moss, LIP_W, 14, (ox) => {
      fillEllipse(ctx, moss + ox, LIP_H - 9, 16, 5);
    });
  }
  ctx.fillStyle = css(0x8ab05a, 0.72);
  for (const moss of [70, 168, 252, 348]) {
    wrapDraw(moss, LIP_W, 12, (ox) => {
      fillEllipse(ctx, moss + ox, LIP_H - 11, 11, 4);
    });
  }
  ctx.fillStyle = css(0xc8e8d8, 0.55);
  for (const glint of [48, 150, 240, 332]) {
    wrapDraw(glint, LIP_W, 6, (ox) => {
      fillCircle(ctx, glint + ox, LIP_H - 18 - (glint % 7), 1.5);
    });
  }
  for (const bloom of [
    { x: 88, y: 28, c: 0xc8e8d8, inner: 0x8ee36d },
    { x: 198, y: 24, c: 0xfff4c4, inner: 0x6ad08a },
    { x: 318, y: 30, c: 0x7aaa90, inner: 0xfff4c4 },
  ]) {
    wrapDraw(bloom.x, LIP_W, 10, (ox) => {
      stampMistOrchid(ctx, bloom.x + ox, bloom.y, bloom.c, bloom.inner, 0.72);
    });
  }
}

function paintRainforestProp(ctx: CanvasRenderingContext2D, id: string, w: number, h: number): void {
  const cx = w / 2;
  switch (id) {
    case 'tuft':
      stampBlades(ctx, cx, h, 7, 40, 0x14382c, 0x0a2818);
      stampBlades(ctx, cx + 5, h, 5, 46, 0x2a6b28, 0x1e5a28);
      stampBlades(ctx, cx - 4, h, 3, 34, 0x3d8a32, 0x2a7028);
      return;
    case 'moss':
      ctx.fillStyle = css(0x2a1c10);
      fillEllipse(ctx, cx, h - 18, 34, 18);
      ctx.fillStyle = css(0x3a2814);
      fillEllipse(ctx, cx - 8, h - 22, 22, 14);
      ctx.fillStyle = css(0x4a3420);
      fillEllipse(ctx, cx + 14, h - 14, 18, 12);
      ctx.fillStyle = css(0x1e5a28, 0.92);
      fillEllipse(ctx, cx - 10, h - 30, 20, 10);
      ctx.fillStyle = css(0x6a8a32, 0.88);
      fillEllipse(ctx, cx + 6, h - 28, 16, 8);
      ctx.fillStyle = css(0x8ab05a, 0.75);
      fillEllipse(ctx, cx - 4, h - 34, 10, 5);
      ctx.fillStyle = css(0x6ad08a, 0.82);
      fillCircle(ctx, cx - 12, h - 32, 2.2);
      fillCircle(ctx, cx + 10, h - 26, 1.8);
      fillCircle(ctx, cx + 2, h - 36, 1.6);
      ctx.fillStyle = css(0x8ab0c0, 0.7);
      fillEllipse(ctx, cx + 18, h - 20, 2, 4);
      return;
    case 'shroom':
      for (const cap of [
        { x: cx - 14, y: h - 18, stem: 16, rw: 13, rh: 9, body: 0x4a3420, spot: 0x8ee36d },
        { x: cx + 4, y: h - 30, stem: 24, rw: 17, rh: 11, body: 0x1e5a28, spot: 0x6ad08a },
        { x: cx + 18, y: h - 16, stem: 12, rw: 10, rh: 7, body: 0x6a8a32, spot: 0xfff4c4 },
      ]) {
        ctx.fillStyle = css(0xc8d0a8);
        fillEllipse(ctx, cap.x, cap.y, 4.2, cap.stem);
        ctx.fillStyle = css(cap.body);
        fillEllipse(ctx, cap.x, cap.y - cap.stem + 4, cap.rw, cap.rh);
        ctx.fillStyle = css(0x0a2818, 0.35);
        ctx.fillRect(cap.x - cap.rw, cap.y - cap.stem + 4, cap.rw * 2, 5);
        ctx.fillStyle = css(cap.spot, 0.92);
        fillCircle(ctx, cap.x - 4, cap.y - cap.stem, 2);
        fillCircle(ctx, cap.x + 5, cap.y - cap.stem + 3, 1.5);
        fillCircle(ctx, cap.x, cap.y - cap.stem + 1, 1.2);
      }
      return;
    case 'orchid':
      stampBlades(ctx, cx, h, 3, 42, 0x14382c, 0x1e5a28);
      for (const bloom of [
        { x: cx - 16, y: h - 68, c: 0xc8e8d8, inner: 0x8ee36d },
        { x: cx + 2, y: h - 86, c: 0xfff4c4, inner: 0x6ad08a },
        { x: cx + 18, y: h - 58, c: 0x7aaa90, inner: 0xfff4c4 },
      ]) {
        ctx.strokeStyle = css(0x1a4a18);
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(cx, h);
        ctx.quadraticCurveTo(bloom.x, (bloom.y + h) * 0.55, bloom.x, bloom.y + 8);
        ctx.stroke();
        stampMistOrchid(ctx, bloom.x, bloom.y, bloom.c, bloom.inner, 1);
      }
      return;
    case 'bloom': {
      stampBlades(ctx, cx - 10, h, 3, 28, 0x1e5a28, 0x14382c);
      ctx.fillStyle = css(0x1a4a18);
      ctx.fillRect(cx - 2.4, h - 32, 4.8, 32);
      const bracts = [
        { y: h - 40, rx: 16, ry: 12, c: 0x1e5a28 },
        { y: h - 54, rx: 18, ry: 13, c: 0x2a6b28 },
        { y: h - 70, rx: 16, ry: 12, c: 0x3d8a32 },
        { y: h - 84, rx: 13, ry: 10, c: 0x8ab05a },
        { y: h - 94, rx: 9, ry: 8, c: 0xc8e8d8 },
      ];
      for (const bract of bracts) {
        ctx.fillStyle = css(bract.c);
        fillEllipse(ctx, cx, bract.y, bract.rx, bract.ry);
        ctx.fillStyle = css(0xfff4c4, 0.35);
        fillEllipse(ctx, cx - 4, bract.y - 3, bract.rx * 0.38, bract.ry * 0.4);
      }
      ctx.fillStyle = css(0x8ee36d);
      fillCircle(ctx, cx, h - 100, 3.2);
      ctx.fillStyle = css(0xfff4c4);
      fillCircle(ctx, cx - 1, h - 101, 1.4);
      return;
    }
    case 'vine':
      ctx.strokeStyle = css(0x4a3018);
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 46, h);
      ctx.quadraticCurveTo(cx - 22, h - 44, cx - 2, h - 16);
      ctx.quadraticCurveTo(cx + 22, h - 58, cx + 38, h - 20);
      ctx.quadraticCurveTo(cx + 48, h - 6, cx + 50, h);
      ctx.stroke();
      ctx.strokeStyle = css(0x1e5a28);
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.moveTo(cx - 44, h - 2);
      ctx.quadraticCurveTo(cx - 20, h - 40, cx, h - 14);
      ctx.quadraticCurveTo(cx + 20, h - 52, cx + 36, h - 18);
      ctx.stroke();
      ctx.strokeStyle = css(0x14382c);
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(cx - 18, h);
      ctx.quadraticCurveTo(cx - 4, h - 52, cx + 16, h - 30);
      ctx.quadraticCurveTo(cx + 30, h - 72, cx + 8, h - 78);
      ctx.stroke();
      ctx.fillStyle = css(0x2a6b28);
      fillEllipse(ctx, cx + 10, h - 80, 12, 7);
      fillEllipse(ctx, cx - 8, h - 46, 9, 5);
      ctx.fillStyle = css(0x3d8a32);
      fillEllipse(ctx, cx + 22, h - 36, 8, 5);
      ctx.fillStyle = css(0x8ab05a, 0.8);
      fillEllipse(ctx, cx + 6, h - 54, 7, 3.4);
      ctx.fillStyle = css(0xc8e8d8);
      fillCircle(ctx, cx + 18, h - 62, 2.4);
      ctx.fillStyle = css(0x8ee36d);
      fillCircle(ctx, cx + 18, h - 62, 1.1);
      return;
    case 'fern':
      for (const frond of [
        { lean: -50, h: 142, shade: 0x0a2818, leaflet: 0x1e5a28 },
        { lean: -24, h: 156, shade: 0x14382c, leaflet: 0x2a6b28 },
        { lean: 4, h: 160, shade: 0x1a4a18, leaflet: 0x3d8a32 },
        { lean: 28, h: 148, shade: 0x1e5a28, leaflet: 0x8ab05a },
        { lean: 50, h: 118, shade: 0x14382c, leaflet: 0x2a6b28 },
      ]) {
        ctx.strokeStyle = css(frond.shade);
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(cx, h);
        ctx.quadraticCurveTo(cx + frond.lean * 0.3, h - frond.h * 0.5, cx + frond.lean, h - frond.h);
        ctx.stroke();
        for (let i = 1; i <= 9; i += 1) {
          const t = i / 9;
          const px = cx + frond.lean * t * t;
          const py = h - frond.h * t;
          const leaf = 13 * (1 - t * 0.48);
          ctx.fillStyle = css(i % 2 ? frond.leaflet : frond.shade);
          ctx.beginPath();
          ctx.ellipse(px + (frond.lean > 0 ? leaf : -leaf), py, leaf, 4.4, frond.lean * 0.016, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      return;
    case 'leaf':
      ctx.fillStyle = css(0x4a3018);
      ctx.fillRect(cx - 3, h - 40, 6, 40);
      ctx.fillStyle = css(0x1a4a18);
      ctx.fillRect(cx - 2, h - 40, 2, 40);
      stampElephantEar(ctx, cx - 30, h - 78, 30, 46, -0.38, 0x14382c, 0x0a2818, 0x3d8a32);
      stampElephantEar(ctx, cx + 26, h - 96, 34, 52, 0.3, 0x1e5a28, 0x0a2818, 0x8ab05a);
      stampElephantEar(ctx, cx - 6, h - 128, 26, 40, -0.12, 0x2a6b28, 0x1a4a18, 0x6ad08a);
      stampElephantEar(ctx, cx + 18, h - 150, 22, 34, 0.16, 0x3d8a32, 0x1e5a28, 0xc8e8d8);
      return;
    default:
      return;
  }
}

export function createForegroundTextures(scene: Phaser.Scene): void {
  for (const theme of THEMES) {
    paintCanvas(scene, foregroundLipKey(theme), LIP_W, LIP_H, (ctx) => paintLip(ctx, theme));
    for (const spec of specsFor(theme)) {
      paintCanvas(scene, propKey(theme, spec.id), spec.w, spec.h, (ctx) => {
        paintProp(ctx, theme, spec.id, spec.w, spec.h);
      });
    }
  }
}

function isSolidGround(cell: string): boolean {
  return cell === '#' || cell === '@';
}

interface GroundRun {
  start: number;
  length: number;
  arena: boolean;
}

function groundRuns(row: string): GroundRun[] {
  const runs: GroundRun[] = [];
  let i = 0;
  while (i < row.length) {
    const cell = row[i] ?? '.';
    if (!isSolidGround(cell)) {
      i += 1;
      continue;
    }
    const arena = cell === '@';
    const start = i;
    const match = arena ? '@' : '#';
    while (i < row.length && row[i] === match) {
      i += 1;
    }
    runs.push({ start, length: i - start, arena });
  }
  return runs;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(specs: PropSpec[], roll: number): PropSpec {
  const total = specs.reduce((sum, spec) => sum + spec.weight, 0);
  let cursor = roll * total;
  for (const spec of specs) {
    cursor -= spec.weight;
    if (cursor <= 0) {
      return spec;
    }
  }
  return specs[specs.length - 1] ?? specs[0];
}

function attachMotion(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Image,
  motion: PropMotion,
  salt: number,
): void {
  switch (motion) {
    case 'still':
      return;
    case 'sway':
      scene.tweens.add({
        targets: sprite,
        angle: { from: -2.6, to: 2.6 },
        duration: 1500 + (salt % 900),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: salt % 420,
      });
      return;
    case 'bob':
      scene.tweens.add({
        targets: sprite,
        scaleY: { from: 0.96, to: 1.05 },
        duration: 1300 + (salt % 700),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: salt % 360,
      });
      return;
    case 'flicker':
      scene.tweens.add({
        targets: sprite,
        alpha: { from: sprite.alpha * 0.7, to: sprite.alpha },
        duration: 110 + (salt % 90),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      return;
    default: {
      const neverMotion: never = motion;
      return neverMotion;
    }
  }
}

function plantLip(scene: Phaser.Scene, theme: Theme, run: GroundRun): void {
  const key = foregroundLipKey(theme);
  if (!scene.textures.exists(key) || run.length < 1) {
    return;
  }
  scene.add
    .tileSprite(run.start * TILE, GROUND_Y * TILE + 8, run.length * TILE, LIP_H, key)
    .setOrigin(0, 0.42)
    .setDepth(LIP_DEPTH)
    .setAlpha(0.94);
}

function canFit(row: string, start: number, tiles: number): boolean {
  if (start < 0 || start + tiles > row.length) {
    return false;
  }
  for (let i = 0; i < tiles; i += 1) {
    if (!isSolidGround(row[start + i] ?? '.')) {
      return false;
    }
  }
  return true;
}

export function plantForeground(
  scene: Phaser.Scene,
  rows: string[],
  theme: Theme,
  world: number,
  stage: number,
): void {
  const row = rows[GROUND_Y] ?? '';
  const rand = mulberry32(world * 7919 + stage * 104729 + theme.charCodeAt(0));
  const kit = specsFor(theme);
  const density = stage >= 3 ? 0.7 : 0.58;

  for (const run of groundRuns(row)) {
    plantLip(scene, theme, run);
    if (run.length < 2) {
      continue;
    }

    let x = run.start;
    const end = run.start + run.length;
    while (x < end) {
      if (x < SPAWN_CLEAR_TILES) {
        x += 1;
        continue;
      }
      if (rand() > density) {
        x += 1;
        continue;
      }

      const pool = run.arena ? kit.filter((spec) => spec.size === 'small') : kit;
      if (pool.length === 0) {
        break;
      }
      if (run.arena && rand() > 0.28) {
        x += 1;
        continue;
      }

      const spec = pickWeighted(pool, rand());
      if (!canFit(row, x, spec.footprint)) {
        x += 1;
        continue;
      }

      const key = propKey(theme, spec.id);
      if (!scene.textures.exists(key)) {
        x += spec.footprint;
        continue;
      }

      const px = (x + spec.footprint / 2) * TILE + (rand() - 0.5) * 14;
      const sprite = scene.add
        .image(px, GROUND_Y * TILE + 10, key)
        .setOrigin(0.5, 1)
        .setDepth(spec.size === 'large' ? PROP_DEPTH : PROP_DEPTH - 1)
        .setAlpha(run.arena ? spec.alpha * 0.9 : spec.alpha)
        .setFlipX(rand() > 0.5);
      attachMotion(scene, sprite, spec.motion, Math.floor(rand() * 4000));

      x += spec.footprint + 1 + Math.floor(rand() * (spec.size === 'large' ? 3 : 2));
    }
  }
}
