import Phaser from 'phaser';
import { themeName, type Theme } from '../config';
import type { SaveData } from '../data/progress';
import {
  MAP_HEIGHT,
  MAP_ISLANDS,
  MAP_WIDTH,
  boatRoutes,
  ferryControl,
  isIslandFogged,
  quadBezier,
  type IslandDef,
  type MapPoint,
} from './world-map-layout';

const OCEAN_KEY = 'map-ocean';

interface IslandPalette {
  shore: number;
  grass: number;
  shade: number;
  highlight: number;
  accent: number;
  dark: number;
}

function css(color: number, alpha = 1): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

function islandKey(world: number): string {
  return `map-island-${world}`;
}

function islandPalette(theme: Theme): IslandPalette {
  switch (theme) {
    case 'grass':
      return { shore: 0xc68642, grass: 0x4aa028, shade: 0x27661c, highlight: 0x64d046, accent: 0x8fb86a, dark: 0x315a32 };
    case 'snow':
      return { shore: 0xb4d0e2, grass: 0xd8ecf8, shade: 0x7a9bb4, highlight: 0xf4fbff, accent: 0xffffff, dark: 0x5d7c94 };
    case 'desert':
      return { shore: 0xc9953f, grass: 0xe0b05a, shade: 0xa06e24, highlight: 0xf4d890, accent: 0xf2d28a, dark: 0x8a5a22 };
    case 'ocean':
      return { shore: 0x2d6b7a, grass: 0x2a9d6e, shade: 0x0c4844, highlight: 0x3ecf8e, accent: 0x7bebf3, dark: 0x072e32 };
    case 'castle':
      return { shore: 0x2a1c32, grass: 0x3e2948, shade: 0x140814, highlight: 0x5a3d66, accent: 0x6e4a7a, dark: 0x08060e };
    case 'rainforest':
      return { shore: 0x4a3420, grass: 0x2a7028, shade: 0x0f3a24, highlight: 0x3d8a32, accent: 0x4a8a3a, dark: 0x0a2818 };
    case 'beach':
      return { shore: 0xe0b05a, grass: 0xf4d890, shade: 0xb88632, highlight: 0xffe08a, accent: 0xffffff, dark: 0x1a6a88 };
    case 'rainy-city':
      return { shore: 0x29344b, grass: 0x46536c, shade: 0x0d1526, highlight: 0x71809a, accent: 0x63e8ff, dark: 0x080d1d };
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

function paintCanvas(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
): void {
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

function islandSize(island: IslandDef): { w: number; h: number } {
  return { w: Math.ceil(island.rx * 2.3) + 48, h: Math.ceil(island.ry * 2.3) + 48 };
}

function traceIsland(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, seed: number): void {
  const steps = 56;
  ctx.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    const wobble = 1 + 0.07 * (0.5 + 0.5 * Math.sin(t * 3 + seed) + 0.4 * Math.sin(t * 5 + seed * 1.7));
    const x = cx + Math.cos(t) * rx * wobble;
    const y = cy + Math.sin(t) * ry * wobble;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, canopy: number, trunk: number, scale: number): void {
  ctx.fillStyle = css(trunk);
  ctx.fillRect(x - 3 * scale, y, 6 * scale, 12 * scale);
  ctx.fillStyle = css(canopy);
  ctx.beginPath();
  ctx.ellipse(x, y - 2 * scale, 12 * scale, 10 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + 7 * scale, y + 2 * scale, 8 * scale, 7 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPeak(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: number, cap: number): void {
  ctx.fillStyle = css(fill);
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.lineTo(x, y - h);
  ctx.lineTo(x + w, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css(cap);
  ctx.beginPath();
  ctx.moveTo(x - w * 0.28, y - h * 0.55);
  ctx.lineTo(x, y - h);
  ctx.lineTo(x + w * 0.28, y - h * 0.55);
  ctx.closePath();
  ctx.fill();
}

function drawPalm(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.strokeStyle = css(0x8a5a22);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, y + 18);
  ctx.quadraticCurveTo(x + 6, y + 8, x + 2, y - 8);
  ctx.stroke();
  ctx.fillStyle = css(0x3a9a3a);
  for (const angle of [-1.1, -0.4, 0.3, 1.0]) {
    ctx.beginPath();
    ctx.ellipse(x + 2 + Math.cos(angle) * 14, y - 8 + Math.sin(angle) * 6, 12, 5, angle, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawKeep(ctx: CanvasRenderingContext2D, x: number, y: number, palette: IslandPalette): void {
  ctx.fillStyle = css(palette.dark);
  ctx.fillRect(x - 28, y - 40, 56, 52);
  ctx.fillStyle = css(palette.highlight);
  ctx.fillRect(x - 24, y - 36, 16, 14);
  ctx.fillRect(x + 8, y - 36, 16, 14);
  ctx.fillStyle = css(palette.accent);
  ctx.fillRect(x - 6, y - 18, 12, 22);
  ctx.fillStyle = css(0x3a1020);
  for (let i = -2; i <= 2; i += 1) {
    ctx.fillRect(x + i * 12 - 4, y - 48, 8, 10);
  }
  ctx.fillRect(x - 38, y - 62, 14, 74);
  ctx.fillRect(x + 24, y - 56, 12, 68);
}

function drawCityBlock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, neon: number): void {
  ctx.fillStyle = css(0x1a2438);
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = css(neon, 0.85);
  ctx.fillRect(x + 3, y + 6, 4, 8);
  ctx.fillRect(x + w - 9, y + 14, 4, 8);
  ctx.fillStyle = css(0x55dff2, 0.35);
  ctx.fillRect(x + 2, y + 2, w - 4, 3);
}

function paintThemeProps(ctx: CanvasRenderingContext2D, island: IslandDef, cx: number, cy: number, palette: IslandPalette): void {
  switch (island.theme) {
    case 'grass':
      drawTree(ctx, cx - 90, cy - 40, palette.accent, palette.shore, 1.2);
      drawTree(ctx, cx + 70, cy + 20, palette.highlight, palette.shore, 1);
      drawTree(ctx, cx + 150, cy - 70, palette.accent, palette.shore, 0.85);
      ctx.fillStyle = css(0xe070a0);
      ctx.beginPath();
      ctx.arc(cx - 40, cy + 70, 4, 0, Math.PI * 2);
      ctx.arc(cx + 20, cy + 90, 3, 0, Math.PI * 2);
      ctx.arc(cx - 120, cy + 30, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'snow':
      drawPeak(ctx, cx - 40, cy + 40, 90, 170, palette.shade, palette.accent);
      drawPeak(ctx, cx + 70, cy + 50, 70, 140, palette.dark, palette.highlight);
      drawPeak(ctx, cx - 130, cy + 60, 50, 90, palette.shade, palette.accent);
      break;
    case 'desert':
      ctx.fillStyle = css(palette.highlight);
      ctx.beginPath();
      ctx.ellipse(cx - 80, cy + 40, 90, 36, -0.2, 0, Math.PI * 2);
      ctx.ellipse(cx + 70, cy + 10, 110, 40, 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = css(palette.shade);
      ctx.fillRect(cx + 40, cy - 50, 70, 36);
      ctx.fillRect(cx + 52, cy - 68, 46, 18);
      ctx.fillStyle = css(0x2a7028);
      ctx.fillRect(cx - 130, cy + 20, 4, 22);
      ctx.beginPath();
      ctx.ellipse(cx - 130, cy + 16, 10, 4, 0.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'ocean':
      ctx.fillStyle = css(0x145a78, 0.55);
      ctx.beginPath();
      ctx.ellipse(cx, cy + 10, island.rx * 0.34, island.ry * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = css(palette.accent, 0.7);
      ctx.beginPath();
      ctx.ellipse(cx - 100, cy + 50, 18, 10, 0.4, 0, Math.PI * 2);
      ctx.ellipse(cx + 120, cy - 20, 16, 9, -0.3, 0, Math.PI * 2);
      ctx.ellipse(cx + 40, cy + 80, 14, 8, 0.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'castle':
      drawKeep(ctx, cx + 20, cy + 10, palette);
      ctx.fillStyle = css(0x6a1820, 0.7);
      ctx.beginPath();
      ctx.moveTo(cx - 120, cy + 80);
      ctx.lineTo(cx - 40, cy + 20);
      ctx.lineTo(cx + 20, cy + 90);
      ctx.closePath();
      ctx.fill();
      break;
    case 'rainforest':
      for (const [tx, ty, s] of [
        [-120, -20, 1.4],
        [-40, 40, 1.6],
        [80, -50, 1.3],
        [140, 30, 1.1],
        [20, 80, 1.5],
        [-150, 70, 1],
      ] as const) {
        drawTree(ctx, cx + tx, cy + ty, palette.highlight, palette.shore, s);
      }
      ctx.strokeStyle = css(0x6bcc3a, 0.65);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 80, cy - 80);
      ctx.quadraticCurveTo(cx - 20, cy, cx + 40, cy - 40);
      ctx.stroke();
      break;
    case 'beach':
      ctx.fillStyle = css(0x5eb8fc, 0.35);
      ctx.beginPath();
      ctx.ellipse(cx + 40, cy + 70, island.rx * 0.7, island.ry * 0.28, 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = css(palette.highlight);
      ctx.beginPath();
      ctx.ellipse(cx, cy + 20, island.rx * 0.72, island.ry * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      drawPalm(ctx, cx - 90, cy - 10);
      drawPalm(ctx, cx + 110, cy + 8);
      drawPalm(ctx, cx + 20, cy - 40);
      break;
    case 'rainy-city':
      drawCityBlock(ctx, cx - 140, cy - 20, 48, 90, palette.accent);
      drawCityBlock(ctx, cx - 80, cy - 50, 40, 120, 0xff5ad5);
      drawCityBlock(ctx, cx - 20, cy - 10, 56, 80, palette.accent);
      drawCityBlock(ctx, cx + 50, cy - 40, 44, 110, 0xff5ad5);
      drawCityBlock(ctx, cx + 110, cy, 52, 70, palette.accent);
      ctx.strokeStyle = css(0x9ad4ff, 0.28);
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i += 1) {
        const x = cx - 150 + i * 42;
        ctx.beginPath();
        ctx.moveTo(x, cy - 90);
        ctx.lineTo(x + 8, cy + 80);
        ctx.stroke();
      }
      break;
    default: {
      const neverTheme: never = island.theme;
      return neverTheme;
    }
  }
}

function paintOcean(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.fillStyle = css(0x0c4a80);
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = css(0x7ec8ff, 0.16);
  ctx.lineWidth = 2;
  for (let row = 0; row < 8; row += 1) {
    const y = 16 + row * 32;
    ctx.beginPath();
    for (let x = 0; x <= size; x += 4) {
      const yy = y + Math.sin((x / size) * Math.PI * 2 + row * 0.7) * 5;
      if (x === 0) {
        ctx.moveTo(x, yy);
      } else {
        ctx.lineTo(x, yy);
      }
    }
    ctx.stroke();
  }
}

function paintIslandTexture(ctx: CanvasRenderingContext2D, island: IslandDef, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const palette = islandPalette(island.theme);
  ctx.fillStyle = css(palette.dark, 0.45);
  traceIsland(ctx, cx + 10, cy + 16, island.rx, island.ry, island.world);
  ctx.fill();
  ctx.fillStyle = css(palette.shore);
  traceIsland(ctx, cx, cy + 8, island.rx, island.ry, island.world);
  ctx.fill();
  ctx.fillStyle = css(palette.grass);
  traceIsland(ctx, cx, cy, island.rx * 0.92, island.ry * 0.9, island.world + 1);
  ctx.fill();
  ctx.fillStyle = css(palette.highlight, 0.35);
  traceIsland(ctx, cx - 18, cy - 22, island.rx * 0.55, island.ry * 0.48, island.world + 2);
  ctx.fill();
  paintThemeProps(ctx, island, cx, cy, palette);
}

export function createWorldMapTextures(scene: Phaser.Scene): void {
  paintCanvas(scene, OCEAN_KEY, 256, 256, (ctx) => paintOcean(ctx, 256));
  for (const island of MAP_ISLANDS) {
    const { w, h } = islandSize(island);
    paintCanvas(scene, islandKey(island.world), w, h, (ctx) => paintIslandTexture(ctx, island, w, h));
  }
}

function drawDashed(gfx: Phaser.GameObjects.Graphics, from: MapPoint, to: MapPoint, dash = 10, gap = 8): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) {
    return;
  }
  const ux = dx / len;
  const uy = dy / len;
  let d = 0;
  while (d < len) {
    const a = d;
    const b = Math.min(len, d + dash);
    gfx.lineBetween(from.x + ux * a, from.y + uy * a, from.x + ux * b, from.y + uy * b);
    d += dash + gap;
  }
}

export function drawBoatLanes(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const gfx = scene.add.graphics().setDepth(2);
  gfx.lineStyle(3, 0xf5d76e, 0.35);
  for (const route of boatRoutes()) {
    const control = ferryControl(route.from, route.to);
    let prev: MapPoint = route.from;
    for (let i = 1; i <= 12; i += 1) {
      const next = quadBezier(route.from, control, route.to, i / 12);
      drawDashed(gfx, prev, next, 8, 10);
      prev = next;
    }
  }
  return gfx;
}

export function placeWorldMapArt(scene: Phaser.Scene, save: SaveData): { ocean: Phaser.GameObjects.TileSprite; fogs: Phaser.GameObjects.Image[] } {
  const ocean = scene.add.tileSprite(0, 0, MAP_WIDTH, MAP_HEIGHT, OCEAN_KEY).setOrigin(0, 0).setDepth(0);
  const fogs: Phaser.GameObjects.Image[] = [];
  for (const island of MAP_ISLANDS) {
    const img = scene.add.image(island.cx, island.cy, islandKey(island.world)).setDepth(1);
    const label = scene.add
      .text(island.cx, island.cy - island.ry + 22, `WORLD ${island.world}`, {
        fontFamily: 'Nunito, Trebuchet MS, sans-serif',
        fontSize: '18px',
        color: '#ffffff',
        stroke: '#12080a',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(6);
    scene.add
      .text(island.cx, island.cy - island.ry + 42, themeName(island.theme), {
        fontFamily: 'Nunito, Trebuchet MS, sans-serif',
        fontSize: '14px',
        color: '#fff4d0',
        stroke: '#12080a',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(6)
      .setAlpha(isIslandFogged(island.world, save.cleared) ? 0.55 : 1);
    if (isIslandFogged(island.world, save.cleared)) {
      img.setTint(0x8a9aaa);
      img.setAlpha(0.72);
      label.setAlpha(0.55);
      const fog = scene.add.image(island.cx, island.cy, islandKey(island.world)).setDepth(2);
      fog.setTint(0xc8d4e4);
      fog.setAlpha(0.42);
      fogs.push(fog);
    }
  }
  for (const island of MAP_ISLANDS) {
    if (island.arrival) {
      scene.add.image(island.arrival.x, island.arrival.y, 'map-dock').setDepth(8);
    }
    if (island.departure) {
      scene.add.image(island.departure.x, island.departure.y, 'map-dock').setDepth(8);
    }
  }
  drawBoatLanes(scene);
  return { ocean, fogs };
}
