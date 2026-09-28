import Phaser from 'phaser';
import { TILE } from '../config';

export const NOCLIP_TILE_KEY = 'noclip-tile';
export const NOCLIP_TILE_GLITCH_KEY = 'noclip-tile-glitch';
export const NOCLIP_GLOW_KEY = 'noclip-glow';
export const NOCLIP_SHARD_KEY = 'noclip-shard';

type Ctx = CanvasRenderingContext2D;

function paintCanvas(scene: Phaser.Scene, key: string, w: number, h: number, paint: (ctx: Ctx) => void): void {
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

/** Deterministic noise so every boot paints the same carpet. */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rgba(color: number, alpha = 1): string {
  return `rgba(${(color >> 16) & 0xff},${(color >> 8) & 0xff},${color & 0xff},${alpha})`;
}

/** Damp, mustard office carpet: mottled pile, loops of fibre and a few water stains. */
function paintCarpet(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number): void {
  const rand = rng(seed);
  ctx.fillStyle = rgba(0xb09446);
  ctx.fillRect(x, y, w, h);
  const tones = [0x9c8038, 0xa88c40, 0xbca050, 0xc6aa5a, 0x8e7432];
  for (let i = 0; i < w * h * 0.32; i += 1) {
    ctx.fillStyle = rgba(tones[Math.floor(rand() * tones.length)] ?? 0xb09446, 0.55 + rand() * 0.45);
    ctx.fillRect(x + Math.floor(rand() * w), y + Math.floor(rand() * h), 1, rand() < 0.4 ? 2 : 1);
  }
  for (let i = 0; i < 3; i += 1) {
    const cx = x + rand() * w;
    const cy = y + h * 0.3 + rand() * h * 0.7;
    const r = 6 + rand() * 12;
    const stain = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
    stain.addColorStop(0, rgba(0x6a5420, 0.32));
    stain.addColorStop(0.7, rgba(0x6a5420, 0.16));
    stain.addColorStop(1, rgba(0x6a5420, 0));
    ctx.fillStyle = stain;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 1.3, r * 0.8, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintNoclipBase(ctx: Ctx): void {
  paintCarpet(ctx, 0, 0, TILE, TILE, 0x0c1a9);
  const seep = ctx.createLinearGradient(0, 0, 0, 10);
  seep.addColorStop(0, rgba(0xfff6c8, 0.75));
  seep.addColorStop(1, rgba(0xfff6c8, 0));
  ctx.fillStyle = seep;
  ctx.fillRect(0, 0, TILE, 10);
  ctx.strokeStyle = rgba(0x4a3c14, 0.9);
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, TILE - 2, TILE - 2);
  ctx.strokeStyle = rgba(0xfff0a0, 0.55);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(3, 3.5);
  ctx.lineTo(TILE - 3, 3.5);
  ctx.stroke();
  ctx.fillStyle = rgba(0xff2a8a, 0.4);
  ctx.fillRect(0, 0, 2, TILE);
  ctx.fillStyle = rgba(0x29e5ff, 0.4);
  ctx.fillRect(TILE - 2, 0, 2, TILE);
  ctx.fillStyle = rgba(0x141208, 0.9);
  ctx.fillRect(44, 22, 4, 2);
  ctx.fillRect(12, 46, 2, 2);
  for (let cy = 0; cy < 2; cy += 1) {
    for (let cx = 0; cx < 2; cx += 1) {
      ctx.fillStyle = (cx + cy) % 2 === 0 ? rgba(0xff00dc) : rgba(0x0a0a0a);
      ctx.fillRect(54 + cx * 2, 54 + cy * 2, 2, 2);
    }
  }
}

function drawNoclipTiles(scene: Phaser.Scene): void {
  paintCanvas(scene, NOCLIP_TILE_KEY, TILE, TILE, paintNoclipBase);
  paintCanvas(scene, NOCLIP_TILE_GLITCH_KEY, TILE, TILE, (ctx) => {
    paintNoclipBase(ctx);
    const rand = rng(0x9117c4);
    for (let band = 0; band < 6; band += 1) {
      const y = Math.floor(rand() * (TILE - 6));
      const h = 2 + Math.floor(rand() * 5);
      const shift = Math.round((rand() - 0.5) * 18);
      const slice = ctx.getImageData(0, y, TILE, h);
      ctx.putImageData(slice, shift, y);
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(0xff2a8a, 0.3);
    ctx.fillRect(3, 0, 4, TILE);
    ctx.fillStyle = rgba(0x29e5ff, 0.3);
    ctx.fillRect(TILE - 7, 0, 4, TILE);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = rgba(0x000000, 0.85);
    ctx.fillRect(18, 30, 14, 3);
    ctx.fillRect(38, 12, 6, 6);
  });
  paintCanvas(scene, NOCLIP_GLOW_KEY, 112, 72, (ctx) => {
    const glow = ctx.createRadialGradient(56, 72, 2, 56, 72, 64);
    glow.addColorStop(0, rgba(0xfff4b0, 0.7));
    glow.addColorStop(0.5, rgba(0xffe98a, 0.22));
    glow.addColorStop(1, rgba(0xffe98a, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 112, 72);
  });
  paintCanvas(scene, NOCLIP_SHARD_KEY, 8, 8, (ctx) => {
    ctx.fillStyle = rgba(0xd8c070);
    ctx.fillRect(0, 0, 8, 8);
    ctx.fillStyle = rgba(0xff2a8a, 0.8);
    ctx.fillRect(0, 0, 2, 8);
    ctx.fillStyle = rgba(0x29e5ff, 0.8);
    ctx.fillRect(6, 0, 2, 8);
  });
}

export function createBackroomsTextures(scene: Phaser.Scene): void {
  drawNoclipTiles(scene);
}
