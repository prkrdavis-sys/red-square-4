import Phaser from 'phaser';
import { TILE } from '../config';
import { paintCanvas, rgba, rng, type Ctx } from './canvas-paint';

export const BR_FLOOR_TOP_KEY = 'br-floor-top';
export const BR_FLOOR_FILL_KEY = 'br-floor-fill';
export const BR_BLOCK_TOP_KEY = 'br-block-top';
export const BR_BLOCK_KEY = 'br-block';
export const BR_CEILING_KEY = 'br-ceiling';
export const BR_CEILING_LIGHT_KEY = 'br-ceiling-light';

export const BR_FAR_KEY = 'br-far';
export const BR_FAR_W = 1024;
export const BR_NEAR_KEY = 'br-near';
export const BR_LIGHTS_KEY = 'br-lights';
export const BR_NEAR_W = 1536;
export const BR_LIGHTS_H = 260;
export const BR_VIEW_H = 720;
/** Screen row where the painted walls meet the carpet; just above the tile floor. */
export const BR_FLOOR_LINE = 572;
const NEAR_CEILING_H = 64;
const FAR_CEILING_H = 104;
/** Fluorescent panels along the near ceiling, as [x, width]. Shared by the glow layer. */
const NEAR_PANELS: Array<[number, number]> = [
  [120, 150],
  [520, 150],
  [900, 150],
  [1290, 150],
];

export const BR_SCANLINES_KEY = 'br-scanlines';
export const BR_GRAIN_KEY = 'br-grain';
export const BR_VIGNETTE_KEY = 'br-vignette';
export const BR_VOID_MOTE_KEY = 'br-void-mote';

const PAPER = 0xd8c46c;
const PAPER_DARK = 0xc2ac56;
const PAPER_LINE = 0xb09848;
const CARPET = 0xb09446;

/**
 * Level 0 wallpaper: pale mustard vertical bands, alternating plain and a faint diamond
 * motif, pinstripes, seams every sheet, and damp stains creeping from ceiling and floor.
 */
function paintWallpaper(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number, haze = 0): void {
  const rand = rng(seed);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = rgba(PAPER);
  ctx.fillRect(x, y, w, h);
  const band = 16;
  for (let bx = Math.floor(x / band) * band; bx < x + w; bx += band) {
    const odd = Math.floor(bx / band) % 2 === 1;
    if (odd) {
      ctx.fillStyle = rgba(PAPER_DARK, 0.35);
      ctx.fillRect(bx, y, band, h);
      ctx.fillStyle = rgba(PAPER_LINE, 0.38);
      for (let my = y + ((bx / band) % 4) * 5; my < y + h; my += 20) {
        ctx.beginPath();
        ctx.moveTo(bx + band / 2, my - 4);
        ctx.lineTo(bx + band / 2 + 3, my);
        ctx.lineTo(bx + band / 2, my + 4);
        ctx.lineTo(bx + band / 2 - 3, my);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.fillStyle = rgba(PAPER_LINE, 0.22);
    ctx.fillRect(bx, y, 1, h);
  }
  for (let sx = Math.floor(x / 128) * 128; sx < x + w; sx += 128) {
    ctx.fillStyle = rgba(0x8a7434, 0.35);
    ctx.fillRect(sx, y, 1, h);
    ctx.fillStyle = rgba(0xfff4c0, 0.25);
    ctx.fillRect(sx + 1, y, 1, h);
  }
  for (let i = 0; i < w * h * 0.02; i += 1) {
    ctx.fillStyle = rand() < 0.5 ? rgba(0xfff0b0, 0.18) : rgba(0x8a7434, 0.14);
    ctx.fillRect(x + Math.floor(rand() * w), y + Math.floor(rand() * h), 1, 1);
  }
  const stains = Math.max(1, Math.round(w / 220));
  for (let i = 0; i < stains; i += 1) {
    const top = rand() < 0.5;
    const cx = x + rand() * w;
    const cy = top ? y + rand() * 30 : y + h - rand() * 40;
    const r = 18 + rand() * 46;
    const stain = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
    stain.addColorStop(0, rgba(0x7a6224, 0.3));
    stain.addColorStop(0.6, rgba(0x8a7030, 0.14));
    stain.addColorStop(0.85, rgba(0x6a5420, 0.2));
    stain.addColorStop(1, rgba(0x6a5420, 0));
    ctx.fillStyle = stain;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.8, r * (top ? 1.4 : 0.9), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const grime = ctx.createLinearGradient(0, y + h - 60, 0, y + h);
  grime.addColorStop(0, rgba(0x6a5420, 0));
  grime.addColorStop(1, rgba(0x6a5420, 0.28));
  ctx.fillStyle = grime;
  ctx.fillRect(x, y + h - 60, w, 60);
  if (haze > 0) {
    ctx.fillStyle = rgba(0xe0d088, haze);
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

function paintCarpetPile(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number, dim = 0): void {
  const rand = rng(seed);
  ctx.fillStyle = rgba(CARPET);
  ctx.fillRect(x, y, w, h);
  const tones = [0x9c8038, 0xa88c40, 0xbca050, 0xc6aa5a, 0x8e7432];
  for (let i = 0; i < w * h * 0.35; i += 1) {
    ctx.fillStyle = rgba(tones[Math.floor(rand() * tones.length)] ?? CARPET, 0.5 + rand() * 0.5);
    ctx.fillRect(x + Math.floor(rand() * w), y + Math.floor(rand() * h), 1, rand() < 0.4 ? 2 : 1);
  }
  for (let i = 0; i < Math.max(1, w / 90); i += 1) {
    const cx = x + rand() * w;
    const cy = y + rand() * h;
    const r = 5 + rand() * 12;
    const damp = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
    damp.addColorStop(0, rgba(0x5e4a1a, 0.3));
    damp.addColorStop(1, rgba(0x5e4a1a, 0));
    ctx.fillStyle = damp;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  if (dim > 0) {
    ctx.fillStyle = `rgba(20,14,4,${dim})`;
    ctx.fillRect(x, y, w, h);
  }
}

function paintBaseboard(ctx: Ctx, x: number, y: number, w: number): void {
  ctx.fillStyle = rgba(0x8a7040);
  ctx.fillRect(x, y, w, 14);
  ctx.fillStyle = rgba(0xc8ae70, 0.8);
  ctx.fillRect(x, y, w, 2);
  ctx.fillStyle = rgba(0x4a3a18, 0.7);
  ctx.fillRect(x, y + 12, w, 2);
}

/** Yellowed drop-ceiling tiles on a grid of grey T-bar. */
function paintDropCeiling(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number, cell = 64): void {
  const rand = rng(seed);
  ctx.fillStyle = rgba(0xe6dca4);
  ctx.fillRect(x, y, w, h);
  for (let i = 0; i < w * h * 0.05; i += 1) {
    ctx.fillStyle = rand() < 0.6 ? rgba(0xb8aa70, 0.4) : rgba(0xfffae0, 0.4);
    ctx.fillRect(x + Math.floor(rand() * w), y + Math.floor(rand() * h), 1, 1);
  }
  ctx.fillStyle = rgba(0x9a9070);
  for (let gx = x; gx <= x + w; gx += cell) {
    ctx.fillRect(gx, y, 2, h);
  }
  for (let gy = y; gy <= y + h; gy += cell / 2) {
    ctx.fillRect(x, gy, w, 2);
  }
  for (let i = 0; i < Math.max(1, w / 180); i += 1) {
    const cx = x + rand() * w;
    const cy = y + rand() * h;
    const r = 6 + rand() * 12;
    const leak = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
    leak.addColorStop(0, rgba(0x8a7030, 0.4));
    leak.addColorStop(0.8, rgba(0x8a7030, 0.2));
    leak.addColorStop(1, rgba(0x8a7030, 0));
    ctx.fillStyle = leak;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
}

function paintPanel(ctx: Ctx, x: number, y: number, w: number, h: number, dead = false): void {
  ctx.fillStyle = rgba(0x8a8468);
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  const tube = ctx.createLinearGradient(0, y, 0, y + h);
  tube.addColorStop(0, rgba(dead ? 0xbab094 : 0xfffff4));
  tube.addColorStop(0.5, rgba(dead ? 0xd0c8a8 : 0xfffbe0));
  tube.addColorStop(1, rgba(dead ? 0xa8a088 : 0xf4ecc0));
  ctx.fillStyle = tube;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(150,140,110,0.35)';
  for (let lx = x + 8; lx < x + w; lx += 10) {
    ctx.fillRect(lx, y, 1, h);
  }
}

function paintTiles(scene: Phaser.Scene): void {
  paintCanvas(scene, BR_FLOOR_TOP_KEY, TILE, TILE, (ctx) => {
    paintCarpetPile(ctx, 0, 0, TILE, 24, 0xf10a);
    ctx.fillStyle = rgba(0xd8c070, 0.6);
    ctx.fillRect(0, 0, TILE, 2);
    ctx.fillStyle = rgba(0x4a3a16);
    ctx.fillRect(0, 24, TILE, 3);
    paintSubfloor(ctx, 27, 0xf10b);
  });
  paintCanvas(scene, BR_FLOOR_FILL_KEY, TILE, TILE, (ctx) => paintSubfloor(ctx, 0, 0xf10c));
  paintCanvas(scene, BR_BLOCK_TOP_KEY, TILE, TILE, (ctx) => {
    paintWallpaper(ctx, 0, 12, TILE, TILE - 12, 0xb10c);
    paintCarpetPile(ctx, 0, 0, TILE, 10, 0xb10d);
    ctx.fillStyle = rgba(0x6a5424);
    ctx.fillRect(0, 10, TILE, 2);
    edgeShade(ctx);
  });
  paintCanvas(scene, BR_BLOCK_KEY, TILE, TILE, (ctx) => {
    paintWallpaper(ctx, 0, 0, TILE, TILE, 0xb10e);
    edgeShade(ctx);
  });
  paintCanvas(scene, BR_CEILING_KEY, TILE, TILE, (ctx) => {
    paintDropCeiling(ctx, 0, 0, TILE, TILE, 0xce11);
    ctx.fillStyle = 'rgba(60,48,20,0.25)';
    ctx.fillRect(0, TILE - 6, TILE, 6);
  });
  paintCanvas(scene, BR_CEILING_LIGHT_KEY, TILE, TILE, (ctx) => {
    paintDropCeiling(ctx, 0, 0, TILE, TILE, 0xce12);
    paintPanel(ctx, 6, 38, TILE - 12, 14);
    ctx.fillStyle = 'rgba(60,48,20,0.25)';
    ctx.fillRect(0, TILE - 6, TILE, 6);
  });
}

/** Grey concrete under the carpet, dimmer the deeper it goes. */
function paintSubfloor(ctx: Ctx, top: number, seed: number): void {
  const rand = rng(seed);
  const h = TILE - top;
  const fade = ctx.createLinearGradient(0, top, 0, TILE);
  fade.addColorStop(0, rgba(0x6e6250));
  fade.addColorStop(1, rgba(0x4e4436));
  ctx.fillStyle = fade;
  ctx.fillRect(0, top, TILE, h);
  for (let i = 0; i < TILE * h * 0.12; i += 1) {
    ctx.fillStyle = rand() < 0.5 ? 'rgba(255,240,200,0.08)' : 'rgba(0,0,0,0.12)';
    ctx.fillRect(Math.floor(rand() * TILE), top + Math.floor(rand() * h), 1 + Math.floor(rand() * 2), 1);
  }
  ctx.strokeStyle = 'rgba(30,24,14,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rand() * TILE, top);
  ctx.lineTo(rand() * TILE, TILE);
  ctx.stroke();
}

function edgeShade(ctx: Ctx): void {
  ctx.fillStyle = 'rgba(70,56,20,0.35)';
  ctx.fillRect(0, 0, 3, TILE);
  ctx.fillRect(TILE - 3, 0, 3, TILE);
}

/** Distant rooms: hazier walls pierced by openings into yet more yellow rooms. */
function paintFar(ctx: Ctx): void {
  const floorY = BR_FLOOR_LINE - 60;
  paintDropCeiling(ctx, 0, 0, BR_FAR_W, FAR_CEILING_H, 0xfa01, 48);
  for (const x of [60, 340, 620, 880]) {
    paintPanel(ctx, x, 60, 90, 12);
  }
  paintWallpaper(ctx, 0, FAR_CEILING_H, BR_FAR_W, floorY - FAR_CEILING_H, 0xfa02, 0.28);
  paintBaseboard(ctx, 0, floorY - 10, BR_FAR_W);
  const openings: Array<[number, number, number]> = [
    [90, 150, 250],
    [430, 110, 300],
    [700, 190, 220],
  ];
  for (const [ox, ow, oh] of openings) {
    paintOpening(ctx, ox, floorY - oh, ow, oh);
  }
  paintCarpetPile(ctx, 0, floorY, BR_FAR_W, BR_VIEW_H - floorY, 0xfa03, 0.08);
  const mist = ctx.createLinearGradient(0, FAR_CEILING_H, 0, floorY);
  mist.addColorStop(0, 'rgba(240,228,170,0.3)');
  mist.addColorStop(1, 'rgba(240,228,170,0.08)');
  ctx.fillStyle = mist;
  ctx.fillRect(0, FAR_CEILING_H, BR_FAR_W, floorY - FAR_CEILING_H);
}

/** A doorway that recedes: two nested frames of darker wallpaper and a light pool. */
function paintOpening(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = rgba(0xb09a4c);
  ctx.fillRect(x, y, w, h);
  const inset = 0.22;
  const ix = x + w * inset;
  const iw = w * (1 - inset * 2);
  const ih = h * 0.62;
  const iy = y + h - ih;
  paintWallpaper(ctx, x, y, w, h - 4, Math.floor(x * 7 + h), 0.1);
  ctx.fillStyle = 'rgba(90,72,24,0.28)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = rgba(0x9a8440);
  ctx.fillRect(ix, iy, iw, ih);
  ctx.fillStyle = rgba(0xe8dc9a, 0.55);
  ctx.fillRect(ix + iw * 0.2, iy + 4, iw * 0.6, 4);
  ctx.fillStyle = 'rgba(60,46,14,0.35)';
  ctx.fillRect(ix + iw * 0.3, iy + ih * 0.4, iw * 0.4, ih * 0.6);
  ctx.fillStyle = rgba(0x7a6630);
  ctx.fillRect(x - 3, y - 4, 3, h + 4);
  ctx.fillRect(x + w, y - 4, 3, h + 4);
  ctx.fillRect(x - 3, y - 4, w + 6, 4);
  const pool = ctx.createRadialGradient(x + w / 2, y + h, 4, x + w / 2, y + h, w * 0.8);
  pool.addColorStop(0, 'rgba(255,246,200,0.35)');
  pool.addColorStop(1, 'rgba(255,246,200,0)');
  ctx.fillStyle = pool;
  ctx.fillRect(x - w * 0.3, y + h - 20, w * 1.6, 40);
}

/**
 * The near wall, cut by wide openings onto the far layer. Some segments carry details the
 * place remembers wrongly: an exit sign that points at the floor, a door onto wallpaper,
 * a crooked outlet halfway up the wall, a clock with no hands.
 */
function paintNear(ctx: Ctx): void {
  const top = NEAR_CEILING_H;
  const floorY = BR_FLOOR_LINE;
  const walls: Array<[number, number]> = [
    [0, 380],
    [640, 460],
    [1280, 256],
  ];
  for (const [wx, ww] of walls) {
    paintWallpaper(ctx, wx, top, ww, floorY - top, 0xae00 + wx);
    paintBaseboard(ctx, wx, floorY - 14, ww);
    const side = ctx.createLinearGradient(wx, 0, wx + 18, 0);
    side.addColorStop(0, 'rgba(80,62,20,0.45)');
    side.addColorStop(1, 'rgba(80,62,20,0)');
    ctx.fillStyle = side;
    if (wx > 0) {
      ctx.fillRect(wx, top, 18, floorY - top);
    }
    const end = wx + ww;
    if (end < BR_NEAR_W) {
      const far = ctx.createLinearGradient(end - 18, 0, end, 0);
      far.addColorStop(0, 'rgba(80,62,20,0)');
      far.addColorStop(1, 'rgba(80,62,20,0.45)');
      ctx.fillStyle = far;
      ctx.fillRect(end - 18, top, 18, floorY - top);
    }
  }
  for (const [ox, ow] of [
    [380, 260],
    [1100, 180],
  ] as Array<[number, number]>) {
    const lintel = ctx.createLinearGradient(0, top, 0, top + 40);
    lintel.addColorStop(0, rgba(PAPER_DARK));
    lintel.addColorStop(1, rgba(0xa89048));
    ctx.fillStyle = lintel;
    ctx.fillRect(ox, top, ow, 40);
    ctx.fillStyle = 'rgba(70,54,18,0.5)';
    ctx.fillRect(ox, top + 38, ow, 3);
  }
  paintDropCeiling(ctx, 0, 0, BR_NEAR_W, top, 0xce00);
  for (const [px, pw] of NEAR_PANELS) {
    paintPanel(ctx, px, 22, pw, 22, px === 900);
  }
  ctx.fillStyle = 'rgba(70,56,20,0.35)';
  ctx.fillRect(0, top - 3, BR_NEAR_W, 3);

  paintExitSign(ctx, 200, 118);
  paintDoorToWall(ctx, 820, floorY - 14);
  paintOutlet(ctx, 1010, 318, 0.2);
  paintOutlet(ctx, 90, floorY - 44, 0);
  paintClock(ctx, 1400, 200);
  paintVent(ctx, 700, top + 18);
  paintSwitch(ctx, 1210 + 150, 360);
}

function paintExitSign(ctx: Ctx, x: number, y: number): void {
  ctx.fillStyle = rgba(0x3a3a34);
  ctx.fillRect(x + 30, y - 16, 4, 16);
  ctx.fillStyle = rgba(0xece8dc);
  ctx.fillRect(x, y, 70, 30);
  ctx.strokeStyle = rgba(0x6a6a60);
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, 70, 30);
  ctx.fillStyle = rgba(0x1ec85a);
  ctx.font = 'bold 17px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('EXIT', x + 8, y + 16);
  ctx.beginPath();
  ctx.moveTo(x + 56, y + 8);
  ctx.lineTo(x + 56, y + 20);
  ctx.lineTo(x + 51, y + 16);
  ctx.moveTo(x + 56, y + 20);
  ctx.lineTo(x + 61, y + 16);
  ctx.strokeStyle = rgba(0x1ec85a);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  const glow = ctx.createRadialGradient(x + 35, y + 15, 4, x + 35, y + 15, 60);
  glow.addColorStop(0, 'rgba(80,255,140,0.18)');
  glow.addColorStop(1, 'rgba(80,255,140,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 30, y - 40, 130, 110);
}

function paintDoorToWall(ctx: Ctx, x: number, bottom: number): void {
  const w = 92;
  const h = 196;
  const y = bottom - h;
  paintWallpaper(ctx, x, y, w, h, 0xd00a);
  ctx.fillStyle = 'rgba(60,46,14,0.3)';
  ctx.fillRect(x, y, w, 14);
  ctx.fillRect(x, y, 10, h);
  ctx.fillStyle = rgba(0x7a5a30);
  ctx.fillRect(x - 8, y - 8, 8, h + 8);
  ctx.fillRect(x + w, y - 8, 8, h + 8);
  ctx.fillRect(x - 8, y - 8, w + 16, 8);
  ctx.fillStyle = rgba(0xa87c48);
  ctx.beginPath();
  ctx.moveTo(x + w + 8, y);
  ctx.lineTo(x + w + 50, y + 16);
  ctx.lineTo(x + w + 50, bottom - 6);
  ctx.lineTo(x + w + 8, bottom);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(0x5a3e1e);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = rgba(0xd8c070);
  ctx.beginPath();
  ctx.arc(x + w + 42, y + h * 0.52, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function paintOutlet(ctx: Ctx, x: number, y: number, tilt: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.fillStyle = rgba(0xf0ead4);
  ctx.fillRect(-10, -15, 20, 30);
  ctx.strokeStyle = rgba(0x9a9078);
  ctx.lineWidth = 1;
  ctx.strokeRect(-10, -15, 20, 30);
  ctx.fillStyle = rgba(0x3a342a);
  for (const oy of [-7, 6]) {
    ctx.fillRect(-4, oy - 2, 2, 5);
    ctx.fillRect(2, oy - 2, 2, 5);
    ctx.fillRect(-1, oy + 4, 2, 2);
  }
  ctx.restore();
}

function paintClock(ctx: Ctx, x: number, y: number): void {
  ctx.fillStyle = rgba(0x3a3428);
  ctx.beginPath();
  ctx.arc(x, y, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba(0xf4efdc);
  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba(0x3a3428);
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    ctx.fillRect(x + Math.cos(a) * 16 - 1, y + Math.sin(a) * 16 - 1, 2, 2);
  }
  ctx.beginPath();
  ctx.arc(x, y, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function paintVent(ctx: Ctx, x: number, y: number): void {
  ctx.fillStyle = rgba(0xcfc6a4);
  ctx.fillRect(x, y, 70, 34);
  ctx.strokeStyle = rgba(0x7a7258);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, 70, 34);
  ctx.fillStyle = rgba(0x3a3428, 0.75);
  for (let vy = y + 5; vy < y + 30; vy += 5) {
    ctx.fillRect(x + 5, vy, 60, 2);
  }
  ctx.fillStyle = 'rgba(40,30,10,0.35)';
  ctx.fillRect(x + 12, y + 34, 2, 30);
}

function paintSwitch(ctx: Ctx, x: number, y: number): void {
  ctx.fillStyle = rgba(0xf0ead4);
  ctx.fillRect(x - 9, y - 14, 18, 28);
  ctx.strokeStyle = rgba(0x9a9078);
  ctx.strokeRect(x - 9, y - 14, 18, 28);
  ctx.fillStyle = rgba(0xd8d0b8);
  ctx.fillRect(x - 3, y + 1, 6, 8);
}

/** Additive pools under each near-ceiling panel, drawn in their own layer so they can flicker. */
function paintLights(ctx: Ctx): void {
  for (const [px, pw] of NEAR_PANELS) {
    if (px === 900) {
      continue;
    }
    const cx = px + pw / 2;
    const cone = ctx.createRadialGradient(cx, 30, 10, cx, 60, 250);
    cone.addColorStop(0, 'rgba(255,252,225,0.75)');
    cone.addColorStop(0.3, 'rgba(255,246,200,0.28)');
    cone.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = cone;
    ctx.fillRect(cx - 260, 0, 520, BR_LIGHTS_H);
  }
}

function paintOverlays(scene: Phaser.Scene): void {
  paintCanvas(scene, BR_SCANLINES_KEY, 4, 4, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.fillRect(0, 0, 4, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 1, 4, 1);
  });
  paintCanvas(scene, BR_GRAIN_KEY, 256, 256, (ctx) => {
    const rand = rng(0x9a17);
    const image = ctx.createImageData(256, 256);
    for (let i = 0; i < image.data.length; i += 4) {
      const v = Math.floor(rand() * 255);
      image.data[i] = v;
      image.data[i + 1] = v;
      image.data[i + 2] = v;
      image.data[i + 3] = rand() < 0.5 ? 255 : 0;
    }
    ctx.putImageData(image, 0, 0);
  });
  paintCanvas(scene, BR_VIGNETTE_KEY, 640, 360, (ctx) => {
    const v = ctx.createRadialGradient(320, 180, 90, 320, 180, 380);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(0.55, 'rgba(10,6,0,0.35)');
    v.addColorStop(1, 'rgba(6,3,0,0.95)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, 640, 360);
  });
  paintCanvas(scene, BR_VOID_MOTE_KEY, 6, 6, (ctx) => {
    const m = ctx.createRadialGradient(3, 3, 0, 3, 3, 3);
    m.addColorStop(0, 'rgba(200,190,160,0.9)');
    m.addColorStop(1, 'rgba(200,190,160,0)');
    ctx.fillStyle = m;
    ctx.fillRect(0, 0, 6, 6);
  });
}

export function drawBackroomsScenery(scene: Phaser.Scene): void {
  paintTiles(scene);
  paintCanvas(scene, BR_FAR_KEY, BR_FAR_W, BR_VIEW_H, paintFar);
  paintCanvas(scene, BR_NEAR_KEY, BR_NEAR_W, BR_VIEW_H, paintNear);
  paintCanvas(scene, BR_LIGHTS_KEY, BR_NEAR_W, BR_LIGHTS_H, paintLights);
  paintOverlays(scene);
}
