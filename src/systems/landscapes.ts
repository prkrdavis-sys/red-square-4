import Phaser from 'phaser';
import { GAME_HEIGHT, THEMES, type Theme } from '../config';

export const LANDSCAPE = {
  stripW: 2560,
  cloudH: 200,
  farH: 240,
  mountainH: 310,
  groundH: 380,
} as const;

interface LandscapePalette {
  skyTop: number;
  skyHorizon: number;
  cloud: number;
  cloudShade: number;
  far: number;
  farCap: number;
  mountain: number;
  mountainShade: number;
  cap: number;
  ground: number;
  groundShade: number;
  groundTop: number;
}

interface Peak {
  x: number;
  w: number;
  h: number;
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

function palette(theme: Theme): LandscapePalette {
  switch (theme) {
    case 'grass':
      return {
        skyTop: 0x1f58c4,
        skyHorizon: 0xd2ecff,
        cloud: 0xffffff,
        cloudShade: 0xc5d8ee,
        far: 0x6a9eb4,
        farCap: 0x9cc4d2,
        mountain: 0x4a7e46,
        mountainShade: 0x315a32,
        cap: 0x8fb86a,
        ground: 0x3d9e2f,
        groundShade: 0x27661c,
        groundTop: 0x64d046,
      };
    case 'snow':
      return {
        skyTop: 0x7ea8c8,
        skyHorizon: 0xe4f2fc,
        cloud: 0xffffff,
        cloudShade: 0xd5e6f2,
        far: 0xb7cfe0,
        farCap: 0xffffff,
        mountain: 0x7a9bb4,
        mountainShade: 0x5d7c94,
        cap: 0xffffff,
        ground: 0xd8ecf8,
        groundShade: 0xb4d0e2,
        groundTop: 0xf4fbff,
      };
    case 'desert':
      return {
        skyTop: 0x5ea0d8,
        skyHorizon: 0xf6d39a,
        cloud: 0xfff6e8,
        cloudShade: 0xf0d9b4,
        far: 0xd8b07a,
        farCap: 0xf3e0b8,
        mountain: 0xc9953f,
        mountainShade: 0xa67428,
        cap: 0xf0d9a0,
        ground: 0xe0b05a,
        groundShade: 0xc4923e,
        groundTop: 0xf0d48a,
      };
    case 'ocean':
      return {
        skyTop: 0x2a90a8,
        skyHorizon: 0x031018,
        cloud: 0x7bebf3,
        cloudShade: 0x3c8ad0,
        far: 0x0a243c,
        farCap: 0x163a52,
        mountain: 0x0c4844,
        mountainShade: 0x072e32,
        cap: 0x7bebf3,
        ground: 0x143848,
        groundShade: 0x07141c,
        groundTop: 0x2a5c68,
      };
    case 'castle':
      return {
        skyTop: 0x08060e,
        skyHorizon: 0x2a1830,
        cloud: 0x6a5470,
        cloudShade: 0x3a2838,
        far: 0x1a1020,
        farCap: 0x4a2838,
        mountain: 0x241428,
        mountainShade: 0x140814,
        cap: 0x5a3048,
        ground: 0x160c18,
        groundShade: 0x0a060c,
        groundTop: 0x2a1a28,
      };
    case 'rainforest':
      return {
        skyTop: 0x14382c,
        skyHorizon: 0x3a7a5a,
        cloud: 0xc8e8d8,
        cloudShade: 0x7aaa90,
        far: 0x1a4a32,
        farCap: 0x2d6b48,
        mountain: 0x0f3a24,
        mountainShade: 0x0a2818,
        cap: 0x4a8a3a,
        ground: 0x2a6b28,
        groundShade: 0x1a4a18,
        groundTop: 0x3d8a32,
      };
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

function wrappedPeak(x: number, peak: Peak, width: number): number {
  let dist = Math.abs(x - peak.x);
  dist = Math.min(dist, Math.abs(x - peak.x - width), Math.abs(x - peak.x + width));
  const t = dist / peak.w;
  if (t >= 1) {
    return 0;
  }
  return peak.h * (1 - t) * (1 - t * 0.28);
}

function ridgeHeights(
  width: number,
  texH: number,
  peaks: Peak[],
  rolls: { amp: number; cycles: number; phase: number }[],
  floorRatio = 0.62,
): number[] {
  const floor = texH * floorRatio;
  const heights = new Array<number>(width + 1);
  for (let x = 0; x <= width; x += 1) {
    let h = floor;
    for (const roll of rolls) {
      h += roll.amp * (0.5 + 0.5 * Math.sin((x / width) * Math.PI * 2 * roll.cycles + roll.phase));
    }
    for (const peak of peaks) {
      h = Math.max(h, floor * 0.82 + wrappedPeak(x, peak, width));
    }
    heights[x] = Math.min(texH - 8, h);
  }
  return heights;
}

function fillBelow(ctx: CanvasRenderingContext2D, heights: number[], texH: number, width: number): void {
  ctx.beginPath();
  ctx.moveTo(0, texH);
  for (let x = 0; x <= width; x += 2) {
    ctx.lineTo(x, texH - (heights[x] ?? 0));
  }
  ctx.lineTo(width, texH);
  ctx.closePath();
  ctx.fill();
}

function fillBand(ctx: CanvasRenderingContext2D, heights: number[], texH: number, width: number, depth: number): void {
  ctx.beginPath();
  ctx.moveTo(0, texH - (heights[0] ?? 0));
  for (let x = 2; x <= width; x += 2) {
    ctx.lineTo(x, texH - (heights[x] ?? 0));
  }
  for (let x = width; x >= 0; x -= 2) {
    ctx.lineTo(x, Math.min(texH, texH - (heights[x] ?? 0) + depth));
  }
  ctx.closePath();
  ctx.fill();
}

function sampleHeight(heights: number[], x: number, width: number): number {
  return heights[((x % width) + width) % width] ?? 0;
}

function findSnowPeaks(heights: number[], width: number, minH: number): number[] {
  const candidates: { x: number; h: number }[] = [];
  for (let x = 0; x < width; x += 1) {
    const h = heights[x] ?? 0;
    if (h < minH) {
      continue;
    }
    const left = sampleHeight(heights, x - 1, width);
    const right = sampleHeight(heights, x + 1, width);
    const prominence =
      h - Math.min(sampleHeight(heights, x - 64, width), sampleHeight(heights, x + 64, width));
    if (h >= left && h > right && prominence >= 38) {
      candidates.push({ x, h });
    }
  }
  candidates.sort((a, b) => b.h - a.h);
  const kept: number[] = [];
  for (const candidate of candidates) {
    const tooClose = kept.some((peakX) => {
      const dist = Math.abs(candidate.x - peakX);
      return Math.min(dist, width - dist) < 88;
    });
    if (!tooClose) {
      kept.push(candidate.x);
    }
  }
  return kept;
}

function walkCapEdge(
  heights: number[],
  peakX: number,
  peakH: number,
  width: number,
  dir: -1 | 1,
): number {
  const snowFloor = peakH - Math.max(22, Math.min(34, peakH * 0.12));
  let x = peakX;
  let prev = peakH;
  for (let step = 0; step < 90; step += 1) {
    const nextH = sampleHeight(heights, x + dir, width);
    if (nextH < snowFloor || nextH > prev + 0.2) {
      break;
    }
    x += dir;
    prev = nextH;
  }
  return x;
}

function paintCaps(
  ctx: CanvasRenderingContext2D,
  heights: number[],
  texH: number,
  width: number,
  color: number,
  minH: number,
): void {
  const depth = new Float64Array(width + 1);
  for (const peakX of findSnowPeaks(heights, width, minH)) {
    const peakH = heights[peakX] ?? 0;
    const left = walkCapEdge(heights, peakX, peakH, width, -1);
    const right = walkCapEdge(heights, peakX, peakH, width, 1);
    const span = right - left;
    if (span < 16) {
      continue;
    }
    const base = 18 + Math.min(span, 110) * 0.07;
    for (let x = left; x <= right; x += 1) {
      const i = ((x % width) + width) % width;
      const t = (x - left) / span;
      const snowline = peakH - base * (0.96 + 0.04 * Math.sin(t * Math.PI * 2));
      const h = sampleHeight(heights, x, width);
      if (h > snowline) {
        depth[i] = Math.max(depth[i], h - snowline);
      }
    }
  }
  depth[0] = Math.max(depth[0], depth[width]);
  depth[width] = depth[0];

  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = css(color);
  let x = 0;
  while (x < width) {
    while (x < width && depth[x] < 1) {
      x += 1;
    }
    if (x >= width) {
      break;
    }
    const start = x;
    while (x < width && depth[x] >= 1) {
      x += 1;
    }
    const end = x - 1;
    ctx.beginPath();
    for (let i = start; i <= end; i += 1) {
      const y = texH - (heights[i] ?? 0) - 1.5;
      if (i === start) {
        ctx.moveTo(i, y);
      } else {
        ctx.lineTo(i, y);
      }
    }
    for (let i = end; i >= start; i -= 1) {
      ctx.lineTo(i, texH - (heights[i] ?? 0) + depth[i]);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function fillCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, width: number): void {
  const draw = (cx: number) => {
    ctx.beginPath();
    ctx.arc(cx, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  draw(x);
  if (x - r < 0) {
    draw(x + width);
  }
  if (x + r > width) {
    draw(x - width);
  }
}

function stampCloud(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  width: number,
  body: number,
  shade: number,
): void {
  ctx.fillStyle = css(shade);
  fillCircle(ctx, cx + 3, cy + 6, 21 * scale, width);
  fillCircle(ctx, cx - 20 * scale, cy + 8, 15 * scale, width);
  fillCircle(ctx, cx + 22 * scale, cy + 9, 16 * scale, width);
  ctx.fillStyle = css(body);
  fillCircle(ctx, cx, cy, 22 * scale, width);
  fillCircle(ctx, cx - 26 * scale, cy + 5, 16 * scale, width);
  fillCircle(ctx, cx + 28 * scale, cy + 6, 18 * scale, width);
  fillCircle(ctx, cx - 10 * scale, cy - 13 * scale, 14 * scale, width);
  fillCircle(ctx, cx + 14 * scale, cy - 11 * scale, 15 * scale, width);
  fillCircle(ctx, cx + 2 * scale, cy - 3 * scale, 12 * scale, width);
}

function mixColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

function fillEllipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  width: number,
): void {
  const draw = (cx: number) => {
    ctx.beginPath();
    ctx.ellipse(cx, y, Math.max(0.6, rx), Math.max(0.6, ry), 0, 0, Math.PI * 2);
    ctx.fill();
  };
  draw(x);
  if (x - rx < 0) {
    draw(x + width);
  }
  if (x + rx > width) {
    draw(x - width);
  }
}

function paintGodRays(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const rays = [
    { x: 160, tw: 36, bw: 170, drift: 80, a: 0.08 },
    { x: 420, tw: 18, bw: 90, drift: 36, a: 0.045 },
    { x: 710, tw: 44, bw: 200, drift: 110, a: 0.07 },
    { x: 1080, tw: 22, bw: 120, drift: 48, a: 0.05 },
    { x: 1420, tw: 38, bw: 180, drift: 70, a: 0.075 },
    { x: 1780, tw: 16, bw: 86, drift: 28, a: 0.04 },
    { x: 2140, tw: 42, bw: 190, drift: 96, a: 0.065 },
    { x: 2460, tw: 24, bw: 100, drift: 40, a: 0.05 },
  ];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const ray of rays) {
    const draw = (ox: number) => {
      ctx.fillStyle = `rgba(170, 232, 255, ${ray.a})`;
      ctx.beginPath();
      ctx.moveTo(ox + ray.x - ray.tw / 2, -12);
      ctx.lineTo(ox + ray.x + ray.tw / 2, -12);
      ctx.lineTo(ox + ray.x + ray.drift + ray.bw / 2, height * 0.78);
      ctx.lineTo(ox + ray.x + ray.drift - ray.bw / 2, height * 0.78);
      ctx.closePath();
      ctx.fill();
    };
    draw(0);
    draw(width);
    draw(-width);
  }
  ctx.restore();
}

function paintCaustics(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 18; i += 1) {
    const x = ((i * 173) % width) + 40;
    const y = 16 + (i % 6) * (height / 8);
    ctx.fillStyle = `rgba(150, 230, 255, ${0.035 + (i % 3) * 0.012})`;
    fillEllipse(ctx, x, y, 70 + (i % 4) * 18, 10 + (i % 3) * 3, width);
  }
  for (let x = 0; x <= width; x += 2) {
    const y =
      12 +
      height * 0.06 +
      7 * Math.sin((x / width) * Math.PI * 2 * 6) +
      4 * Math.sin((x / width) * Math.PI * 2 * 13 + 0.8);
    ctx.fillStyle = 'rgba(210, 250, 255, 0.07)';
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.restore();
}

function stampCyanReef(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  width: number,
): void {
  const outline = [
    [0, -38],
    [-11, -34],
    [-22, -22],
    [-36, -10],
    [-42, 6],
    [-34, 20],
    [-18, 28],
    [-4, 24],
    [10, 30],
    [26, 22],
    [40, 8],
    [38, -8],
    [24, -20],
    [12, -32],
  ];
  const paintPoly = (color: number, ox: number, oy: number, shrink: number) => {
    ctx.fillStyle = css(color);
    const draw = (wx: number) => {
      ctx.beginPath();
      outline.forEach((point, i) => {
        const px = wx + cx + ox + point[0] * scale * shrink;
        const py = cy + oy + point[1] * scale * shrink;
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      });
      ctx.closePath();
      ctx.fill();
    };
    draw(0);
    if (cx - 48 * scale < 0) {
      draw(width);
    }
    if (cx + 48 * scale > width) {
      draw(-width);
    }
  };
  paintPoly(0x1a3a62, 3, 4, 1);
  paintPoly(0x2668a1, 0, 0, 1);
  paintPoly(0x3c8ad0, -2, -6, 0.62);
  ctx.fillStyle = css(0x7bebf3);
  for (const tip of [
    [-6, -34],
    [4, -36],
    [14, -28],
    [-20, -20],
  ]) {
    fillEllipse(ctx, cx + tip[0] * scale, cy + tip[1] * scale, 3.2 * scale, 2.2 * scale, width);
  }
}

function stampKelp(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  height: number,
  width: number,
  body: number,
  highlight: number,
): void {
  const steps = 18;
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const y = baseY - height * t;
    const sway = Math.sin(t * Math.PI * 2.5 + x * 0.02) * (7 + t * 18);
    const half = Math.max(1.2, (6.2 - t * 4.4) * (height / 170));
    left.push([x + sway - half, y]);
    right.push([x + sway + half, y]);
  }
  const paint = (ox: number) => {
    ctx.fillStyle = css(body);
    ctx.beginPath();
    ctx.moveTo(left[0][0] + ox, left[0][1]);
    for (const point of left) {
      ctx.lineTo(point[0] + ox, point[1]);
    }
    for (let i = right.length - 1; i >= 0; i -= 1) {
      const point = right[i];
      if (point) {
        ctx.lineTo(point[0] + ox, point[1]);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = css(highlight, 0.55);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < left.length; i += 1) {
      const l = left[i];
      const r = right[i];
      if (!l || !r) {
        continue;
      }
      const px = (l[0] + r[0]) * 0.5 - 1.1 + ox;
      if (i === 0) {
        ctx.moveTo(px, l[1]);
      } else {
        ctx.lineTo(px, l[1]);
      }
    }
    ctx.stroke();
  };
  paint(0);
  if (x < 36) {
    paint(width);
  }
  if (x > width - 36) {
    paint(-width);
  }
}

function drawOceanSeamounts(ctx: CanvasRenderingContext2D, colors: LandscapePalette, texH: number): void {
  const width = LANDSCAPE.stripW;
  const clumps = [
    { x: 180, y: texH - 70, s: 0.72 },
    { x: 520, y: texH - 110, s: 1.05 },
    { x: 860, y: texH - 54, s: 0.58 },
    { x: 1240, y: texH - 96, s: 0.9 },
    { x: 1680, y: texH - 64, s: 0.7 },
    { x: 2060, y: texH - 120, s: 1.12 },
    { x: 2420, y: texH - 80, s: 0.8 },
  ];
  for (const clump of clumps) {
    ctx.fillStyle = css(colors.far, 0.9);
    stampDarkReef(ctx, clump.x, clump.y, clump.s, width);
  }
}

function stampDarkReef(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  width: number,
): void {
  const lumps = [
    { dx: 0, dy: 8, rx: 46, ry: 22 },
    { dx: -28, dy: 0, rx: 24, ry: 18 },
    { dx: 30, dy: 2, rx: 26, ry: 16 },
    { dx: -8, dy: -16, rx: 18, ry: 16 },
    { dx: 16, dy: -12, rx: 16, ry: 14 },
  ];
  for (const lump of lumps) {
    fillEllipse(ctx, cx + lump.dx * scale, cy + lump.dy * scale, lump.rx * scale, lump.ry * scale, width);
  }
}

function drawOceanReefs(ctx: CanvasRenderingContext2D, colors: LandscapePalette, texH: number): void {
  const width = LANDSCAPE.stripW;
  const kelp = [
    { x: 90, h: 120 },
    { x: 160, h: 88 },
    { x: 420, h: 140 },
    { x: 490, h: 96 },
    { x: 780, h: 110 },
    { x: 980, h: 150 },
    { x: 1060, h: 92 },
    { x: 1320, h: 128 },
    { x: 1580, h: 104 },
    { x: 1660, h: 146 },
    { x: 1980, h: 90 },
    { x: 2220, h: 134 },
    { x: 2310, h: 86 },
    { x: 2480, h: 118 },
  ];
  for (const blade of kelp) {
    stampKelp(ctx, blade.x, texH + 8, blade.h, width, colors.mountain, 0x1e8a6a);
    stampKelp(ctx, blade.x + 14, texH + 8, blade.h * 0.72, width, colors.mountainShade, 0x167a5c);
  }
  const reefs = [
    { x: 280, y: 96, s: 0.92 },
    { x: 900, y: 58, s: 0.7 },
    { x: 1480, y: 110, s: 0.84 },
    { x: 2060, y: 72, s: 0.76 },
  ];
  for (const reef of reefs) {
    stampCyanReef(ctx, reef.x, reef.y, reef.s, width);
  }
}

function drawOceanFloor(ctx: CanvasRenderingContext2D, colors: LandscapePalette, texH: number): void {
  const width = LANDSCAPE.stripW;
  const ridge = ridgeHeights(
    width,
    texH,
    [
      { x: 180, w: 280, h: 55 },
      { x: 560, w: 340, h: 80 },
      { x: 980, w: 220, h: 45 },
      { x: 1380, w: 300, h: 70 },
      { x: 1840, w: 260, h: 58 },
      { x: 2260, w: 240, h: 74 },
      { x: 2480, w: 160, h: 40 },
    ],
    [
      { amp: 18, cycles: 2, phase: 0.3 },
      { amp: 10, cycles: 4, phase: 1.5 },
      { amp: 6, cycles: 7, phase: 0.9 },
    ],
    0.72,
  );
  ctx.fillStyle = css(colors.groundShade);
  fillBelow(ctx, ridge, texH, width);
  ctx.fillStyle = css(colors.ground);
  fillBand(ctx, ridge, texH, width, 120);
  ctx.fillStyle = css(colors.groundTop);
  fillBand(ctx, ridge, texH, width, 22);
  const floorKelp = [
    { x: 70, h: 150 },
    { x: 300, h: 210 },
    { x: 340, h: 130 },
    { x: 640, h: 180 },
    { x: 900, h: 240 },
    { x: 1180, h: 160 },
    { x: 1480, h: 220 },
    { x: 1520, h: 140 },
    { x: 1860, h: 190 },
    { x: 2140, h: 250 },
    { x: 2180, h: 155 },
    { x: 2440, h: 170 },
  ];
  for (const blade of floorKelp) {
    const y = texH - (sampleHeight(ridge, blade.x, width) ?? 0) + 6;
    stampKelp(ctx, blade.x, y, blade.h, width, 0x0a3a38, 0x1a7a58);
  }
  ctx.fillStyle = css(0x2a8aaa, 0.7);
  for (const rock of [
    { x: 210, r: 16 },
    { x: 720, r: 12 },
    { x: 1290, r: 18 },
    { x: 1760, r: 11 },
    { x: 2330, r: 15 },
  ]) {
    const y = texH - (sampleHeight(ridge, rock.x, width) ?? 0) + 4;
    fillEllipse(ctx, rock.x, y, rock.r, rock.r * 0.55, width);
    ctx.fillStyle = css(0x7bebf3, 0.35);
    fillEllipse(ctx, rock.x - 3, y - 3, rock.r * 0.35, rock.r * 0.18, width);
    ctx.fillStyle = css(0x2a8aaa, 0.7);
  }
}

function sourceImageOf(scene: Phaser.Scene, key: string): HTMLImageElement | HTMLCanvasElement | undefined {
  if (!scene.textures.exists(key)) {
    return undefined;
  }
  const image = scene.textures.get(key).getSourceImage();
  if (image instanceof HTMLImageElement || image instanceof HTMLCanvasElement) {
    return image;
  }
  return undefined;
}

function createKeyedTexture(
  scene: Phaser.Scene,
  srcKey: string,
  destKey: string,
  keyColor: number,
  tolerance: number,
  scale: number,
): boolean {
  const src = sourceImageOf(scene, srcKey);
  if (!src) {
    return false;
  }
  const srcW = src instanceof HTMLImageElement ? src.naturalWidth : src.width;
  const srcH = src instanceof HTMLImageElement ? src.naturalHeight : src.height;
  if (srcW < 8 || srcH < 8) {
    return false;
  }
  if (scene.textures.exists(destKey)) {
    return true;
  }
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  if (scene.textures.exists(destKey)) {
    scene.textures.remove(destKey);
  }
  const texture = scene.textures.createCanvas(destKey, w, h);
  if (!texture) {
    return false;
  }
  const ctx = texture.getContext();
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h);
  const kr = (keyColor >> 16) & 0xff;
  const kg = (keyColor >> 8) & 0xff;
  const kb = keyColor & 0xff;
  for (let i = 0; i < pixels.data.length; i += 4) {
    const r = pixels.data[i] ?? 0;
    const g = pixels.data[i + 1] ?? 0;
    const b = pixels.data[i + 2] ?? 0;
    if (Math.abs(r - kr) + Math.abs(g - kg) + Math.abs(b - kb) <= tolerance) {
      pixels.data[i + 3] = 0;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  texture.refresh();
  return true;
}

export function ensureOceanPackTextures(scene: Phaser.Scene): { reefs?: string; coral?: string } {
  const pack: { reefs?: string; coral?: string } = {};
  if (createKeyedTexture(scene, 'bg-ocean', 'ocean-pack-reefs', 0x244b7e, 20, 2.15)) {
    pack.reefs = 'ocean-pack-reefs';
  }
  if (createKeyedTexture(scene, 'bg-ocean-midground', 'ocean-pack-coral', 0x13283c, 12, 1)) {
    pack.coral = 'ocean-pack-coral';
  }
  return pack;
}

type MeadowCloudKind = 'cumulus' | 'flat' | 'puff';

function wrapStamp(x: number, width: number, pad: number, draw: (ox: number) => void): void {
  draw(0);
  if (x < pad) {
    draw(width);
  }
  if (x > width - pad) {
    draw(-width);
  }
}

function ellipseAt(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.6, rx), Math.max(0.6, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

function triangleAt(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
  ctx.fill();
}

function paintMeadowSky(ctx: CanvasRenderingContext2D, width: number, height: number, colors: LandscapePalette): void {
  const mid = 0x4c8aee;
  const steps = 56;
  const slice = Math.ceil(height / steps) + 1;
  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);
    const color =
      t < 0.38
        ? mixColor(colors.skyTop, mid, t / 0.38)
        : t < 0.72
          ? mixColor(mid, mixColor(mid, colors.skyHorizon, 0.55), (t - 0.38) / 0.34)
          : mixColor(mixColor(mid, colors.skyHorizon, 0.55), colors.skyHorizon, (t - 0.72) / 0.28);
    ctx.fillStyle = css(color);
    ctx.fillRect(0, (height / steps) * i, width, slice);
  }

  const haze = ctx.createLinearGradient(0, height * 0.52, 0, height);
  haze.addColorStop(0, css(0xe8f4ff, 0));
  haze.addColorStop(0.45, css(0xd8ecff, 0.16));
  haze.addColorStop(1, css(0xf4fbff, 0.34));
  ctx.fillStyle = haze;
  ctx.fillRect(0, height * 0.5, width, height * 0.5);

  ctx.fillStyle = css(0xffffff, 0.14);
  for (const streak of [
    { x: 120, y: 46, rx: 88, ry: 7 },
    { x: 390, y: 28, rx: 64, ry: 5 },
    { x: 680, y: 58, rx: 110, ry: 8 },
    { x: 1020, y: 22, rx: 72, ry: 5 },
    { x: 1380, y: 50, rx: 96, ry: 7 },
    { x: 1760, y: 34, rx: 80, ry: 6 },
    { x: 2140, y: 62, rx: 104, ry: 8 },
    { x: 2440, y: 26, rx: 70, ry: 5 },
  ]) {
    fillEllipse(ctx, streak.x, streak.y, streak.rx, streak.ry, width);
    fillEllipse(ctx, streak.x + 30, streak.y + 7, streak.rx * 0.55, streak.ry * 0.7, width);
  }

  ctx.strokeStyle = css(0x2a4068, 0.38);
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  for (const bird of [
    { x: 240, y: 118, s: 1 },
    { x: 268, y: 126, s: 0.7 },
    { x: 292, y: 114, s: 0.85 },
    { x: 880, y: 72, s: 0.9 },
    { x: 904, y: 80, s: 0.6 },
    { x: 1540, y: 132, s: 1.05 },
    { x: 1570, y: 140, s: 0.7 },
    { x: 1594, y: 128, s: 0.8 },
    { x: 2100, y: 96, s: 0.75 },
    { x: 2122, y: 104, s: 0.55 },
  ]) {
    wrapStamp(bird.x, width, 12, (ox) => {
      const x = bird.x + ox;
      ctx.beginPath();
      ctx.moveTo(x - 6 * bird.s, bird.y);
      ctx.quadraticCurveTo(x - 1.2 * bird.s, bird.y - 3.4 * bird.s, x, bird.y);
      ctx.quadraticCurveTo(x + 1.2 * bird.s, bird.y - 3.4 * bird.s, x + 6 * bird.s, bird.y);
      ctx.stroke();
    });
  }
}

function stampMeadowCloud(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  width: number,
  body: number,
  shade: number,
  kind: MeadowCloudKind,
): void {
  switch (kind) {
    case 'cumulus':
      ctx.fillStyle = css(shade);
      fillCircle(ctx, cx + 4, cy + 10, 24 * scale, width);
      fillCircle(ctx, cx - 28 * scale, cy + 12, 16 * scale, width);
      fillCircle(ctx, cx + 30 * scale, cy + 13, 17 * scale, width);
      ctx.fillStyle = css(body);
      fillCircle(ctx, cx, cy, 24 * scale, width);
      fillCircle(ctx, cx - 30 * scale, cy + 6, 17 * scale, width);
      fillCircle(ctx, cx + 32 * scale, cy + 7, 19 * scale, width);
      fillCircle(ctx, cx - 12 * scale, cy - 15 * scale, 15 * scale, width);
      fillCircle(ctx, cx + 16 * scale, cy - 14 * scale, 16 * scale, width);
      fillCircle(ctx, cx + 2 * scale, cy - 6 * scale, 13 * scale, width);
      fillCircle(ctx, cx - 40 * scale, cy + 10, 11 * scale, width);
      fillCircle(ctx, cx + 44 * scale, cy + 12, 12 * scale, width);
      ctx.fillStyle = css(0xffffff, 0.55);
      fillCircle(ctx, cx - 8 * scale, cy - 10 * scale, 9 * scale, width);
      return;
    case 'flat':
      ctx.fillStyle = css(shade);
      fillEllipse(ctx, cx + 2, cy + 7, 38 * scale, 12 * scale, width);
      ctx.fillStyle = css(body);
      fillEllipse(ctx, cx, cy, 40 * scale, 12 * scale, width);
      fillCircle(ctx, cx - 18 * scale, cy - 2, 11 * scale, width);
      fillCircle(ctx, cx + 10 * scale, cy - 4, 13 * scale, width);
      fillCircle(ctx, cx + 28 * scale, cy + 1, 9 * scale, width);
      ctx.fillStyle = css(0xffffff, 0.4);
      fillEllipse(ctx, cx - 6 * scale, cy - 4, 16 * scale, 5 * scale, width);
      return;
    case 'puff':
      ctx.fillStyle = css(shade);
      fillCircle(ctx, cx + 2, cy + 5, 12 * scale, width);
      ctx.fillStyle = css(body);
      fillCircle(ctx, cx, cy, 12 * scale, width);
      fillCircle(ctx, cx - 10 * scale, cy + 3, 8 * scale, width);
      fillCircle(ctx, cx + 11 * scale, cy + 2, 9 * scale, width);
      ctx.fillStyle = css(0xffffff, 0.45);
      fillCircle(ctx, cx - 3 * scale, cy - 3, 5 * scale, width);
      return;
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

function drawMeadowClouds(ctx: CanvasRenderingContext2D, colors: LandscapePalette): void {
  const width = LANDSCAPE.stripW;
  const clouds: { x: number; y: number; s: number; kind: MeadowCloudKind }[] = [
    { x: 150, y: 102, s: 1.22, kind: 'cumulus' },
    { x: 390, y: 146, s: 0.52, kind: 'puff' },
    { x: 500, y: 84, s: 0.78, kind: 'flat' },
    { x: 720, y: 96, s: 1.32, kind: 'cumulus' },
    { x: 960, y: 154, s: 0.46, kind: 'puff' },
    { x: 1140, y: 76, s: 0.88, kind: 'flat' },
    { x: 1360, y: 108, s: 1.1, kind: 'cumulus' },
    { x: 1600, y: 68, s: 0.6, kind: 'puff' },
    { x: 1820, y: 128, s: 0.84, kind: 'flat' },
    { x: 2020, y: 88, s: 1.18, kind: 'cumulus' },
    { x: 2240, y: 150, s: 0.5, kind: 'puff' },
    { x: 2460, y: 94, s: 1.02, kind: 'cumulus' },
  ];
  for (const cloud of clouds) {
    stampMeadowCloud(ctx, cloud.x, cloud.y, cloud.s, width, colors.cloud, colors.cloudShade, cloud.kind);
  }
}

function paintMeadowSlope(
  ctx: CanvasRenderingContext2D,
  heights: number[],
  texH: number,
  width: number,
  body: number,
  shade: number,
  highlight: number,
  shadeDepth: number,
  highlightDepth: number,
): void {
  ctx.fillStyle = css(body);
  fillBelow(ctx, heights, texH, width);
  ctx.fillStyle = css(shade, 0.42);
  fillBand(ctx, heights, texH, width, shadeDepth);
  ctx.fillStyle = css(highlight, 0.88);
  fillBand(ctx, heights, texH, width, highlightDepth);

  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  for (let x = 20; x < width; x += 34) {
    const h = sampleHeight(heights, x, width);
    const neigh =
      0.5 * (sampleHeight(heights, x - 26, width) + sampleHeight(heights, x + 26, width));
    if (h + 10 < neigh) {
      const y = texH - h;
      ctx.fillStyle = css(shade, 0.18);
      ctx.beginPath();
      ctx.moveTo(x - 28, y);
      ctx.lineTo(x + 28, y);
      ctx.lineTo(x + 10, texH);
      ctx.lineTo(x - 10, texH);
      ctx.closePath();
      ctx.fill();
    } else if (h > neigh + 8) {
      ctx.fillStyle = css(highlight, 0.12);
      ctx.beginPath();
      ctx.moveTo(x - 16, texH - h);
      ctx.lineTo(x + 16, texH - h);
      ctx.lineTo(x + 6, texH - h + 36);
      ctx.lineTo(x - 6, texH - h + 36);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

function stampMeadowPine(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  scale: number,
  width: number,
  body: number,
  shade: number,
  trunk = 0x5a3a1c,
): void {
  wrapStamp(cx, width, 28 * scale, (ox) => {
    const x = cx + ox;
    ctx.fillStyle = css(trunk);
    ctx.fillRect(x - 2.2 * scale, baseY - 14 * scale, 4.4 * scale, 14 * scale);
    ctx.fillStyle = css(shade);
    triangleAt(ctx, x, baseY - 42 * scale, x + 18 * scale, baseY - 8 * scale, x - 18 * scale, baseY - 8 * scale);
    ctx.fillStyle = css(body);
    triangleAt(ctx, x, baseY - 50 * scale, x + 14 * scale, baseY - 18 * scale, x - 14 * scale, baseY - 18 * scale);
    triangleAt(ctx, x, baseY - 62 * scale, x + 9 * scale, baseY - 30 * scale, x - 9 * scale, baseY - 30 * scale);
    ctx.fillStyle = css(mixColor(body, 0xd8f0b0, 0.28), 0.45);
    triangleAt(ctx, x - 2 * scale, baseY - 58 * scale, x + 4 * scale, baseY - 34 * scale, x - 7 * scale, baseY - 34 * scale);
  });
}

function stampMeadowTree(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  scale: number,
  width: number,
  canopy: number,
  shade: number,
  highlight: number,
  trunk = 0x6a4420,
): void {
  wrapStamp(cx, width, 36 * scale, (ox) => {
    const x = cx + ox;
    ctx.fillStyle = css(trunk);
    ctx.fillRect(x - 3.2 * scale, baseY - 20 * scale, 6.4 * scale, 20 * scale);
    ctx.fillStyle = css(0x4a3014);
    ctx.fillRect(x - 3.2 * scale, baseY - 20 * scale, 2.2 * scale, 20 * scale);
    ctx.fillStyle = css(shade);
    ellipseAt(ctx, x + 1 * scale, baseY - 24 * scale, 20 * scale, 16 * scale);
    ellipseAt(ctx, x - 14 * scale, baseY - 20 * scale, 13 * scale, 11 * scale);
    ellipseAt(ctx, x + 15 * scale, baseY - 19 * scale, 13 * scale, 11 * scale);
    ctx.fillStyle = css(canopy);
    ellipseAt(ctx, x - 2 * scale, baseY - 34 * scale, 16 * scale, 14 * scale);
    ellipseAt(ctx, x - 13 * scale, baseY - 26 * scale, 12 * scale, 10 * scale);
    ellipseAt(ctx, x + 13 * scale, baseY - 25 * scale, 12 * scale, 10 * scale);
    ellipseAt(ctx, x + 3 * scale, baseY - 22 * scale, 11 * scale, 9 * scale);
    ctx.fillStyle = css(highlight, 0.55);
    ellipseAt(ctx, x - 7 * scale, baseY - 40 * scale, 7 * scale, 5 * scale);
  });
}

function stampFarSilhouette(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  scale: number,
  width: number,
  color: number,
): void {
  wrapStamp(cx, width, 10 * scale, (ox) => {
    const x = cx + ox;
    ctx.fillStyle = css(color);
    ellipseAt(ctx, x, baseY - 9 * scale, 5.2 * scale, 7.4 * scale);
    triangleAt(ctx, x, baseY - 20 * scale, x + 4.2 * scale, baseY - 8 * scale, x - 4.2 * scale, baseY - 8 * scale);
  });
}

function stampMeadowCottage(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  scale: number,
  width: number,
): void {
  wrapStamp(cx, width, 28 * scale, (ox) => {
    const x = cx + ox;
    ctx.fillStyle = css(0x5a3a1c, 0.28);
    ellipseAt(ctx, x, baseY + 2 * scale, 22 * scale, 4 * scale);
    ctx.fillStyle = css(0xefe0c0);
    ctx.fillRect(x - 16 * scale, baseY - 22 * scale, 32 * scale, 22 * scale);
    ctx.fillStyle = css(0xe2d0a8);
    ctx.fillRect(x - 16 * scale, baseY - 22 * scale, 8 * scale, 22 * scale);
    ctx.fillStyle = css(0x6a3a18);
    ctx.fillRect(x - 4 * scale, baseY - 12 * scale, 8 * scale, 12 * scale);
    ctx.fillStyle = css(0x7ec8f0);
    ctx.fillRect(x + 6 * scale, baseY - 18 * scale, 7 * scale, 6 * scale);
    ctx.fillStyle = css(0xfff6d8, 0.55);
    ctx.fillRect(x + 7 * scale, baseY - 17 * scale, 2.2 * scale, 2 * scale);
    ctx.fillStyle = css(0xb8442c);
    triangleAt(
      ctx,
      x - 20 * scale,
      baseY - 20 * scale,
      x,
      baseY - 38 * scale,
      x + 20 * scale,
      baseY - 20 * scale,
    );
    ctx.fillStyle = css(0x8a4a32);
    ctx.fillRect(x + 8 * scale, baseY - 36 * scale, 5.5 * scale, 10 * scale);
    ctx.fillStyle = css(0xd8e4ee, 0.7);
    ellipseAt(ctx, x + 11 * scale, baseY - 38 * scale, 3.2 * scale, 2.2 * scale);
  });
}

function stampMeadowWindmill(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  scale: number,
  width: number,
): void {
  wrapStamp(cx, width, 36 * scale, (ox) => {
    const x = cx + ox;
    ctx.fillStyle = css(0x5a3a1c, 0.25);
    ellipseAt(ctx, x, baseY + 2 * scale, 14 * scale, 3.4 * scale);
    ctx.fillStyle = css(0xd8c49a);
    ctx.beginPath();
    ctx.moveTo(x - 10 * scale, baseY);
    ctx.lineTo(x - 7 * scale, baseY - 52 * scale);
    ctx.lineTo(x + 7 * scale, baseY - 52 * scale);
    ctx.lineTo(x + 10 * scale, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = css(0xc4ae82);
    ctx.beginPath();
    ctx.moveTo(x - 10 * scale, baseY);
    ctx.lineTo(x - 7 * scale, baseY - 52 * scale);
    ctx.lineTo(x - 2 * scale, baseY - 52 * scale);
    ctx.lineTo(x - 3 * scale, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = css(0x8a3a22);
    triangleAt(
      ctx,
      x - 9 * scale,
      baseY - 50 * scale,
      x,
      baseY - 64 * scale,
      x + 9 * scale,
      baseY - 50 * scale,
    );
    ctx.fillStyle = css(0x6a3a18);
    ctx.fillRect(x - 3 * scale, baseY - 14 * scale, 6 * scale, 14 * scale);
    ctx.fillStyle = css(0xe8d8b0);
    ellipseAt(ctx, x, baseY - 48 * scale, 3.6 * scale, 3.6 * scale);
    ctx.strokeStyle = css(0xf4ead4, 0.92);
    ctx.lineWidth = 3.2 * scale;
    ctx.lineCap = 'round';
    const hubY = baseY - 48 * scale;
    for (const a of [-0.55, 1.02, 2.59, 4.16]) {
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 4 * scale, hubY + Math.sin(a) * 4 * scale);
      ctx.lineTo(x + Math.cos(a) * 26 * scale, hubY + Math.sin(a) * 26 * scale);
      ctx.stroke();
    }
    ctx.fillStyle = css(0xf8f0d8);
    ellipseAt(ctx, x, hubY, 3 * scale, 3 * scale);
  });
}

function stampMeadowFence(
  ctx: CanvasRenderingContext2D,
  x0: number,
  x1: number,
  heights: number[],
  texH: number,
  width: number,
): void {
  const posts: number[] = [];
  for (let x = x0; x <= x1; x += 14) {
    posts.push(x);
  }
  ctx.strokeStyle = css(0x7a4a22, 0.8);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < posts.length; i += 1) {
    const x = posts[i] ?? x0;
    const y = texH - sampleHeight(heights, x, width) - 11;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < posts.length; i += 1) {
    const x = posts[i] ?? x0;
    const y = texH - sampleHeight(heights, x, width) - 6;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
  ctx.fillStyle = css(0x8a5a28);
  for (const x of posts) {
    const y = texH - sampleHeight(heights, x, width);
    wrapStamp(x, width, 4, (ox) => {
      ctx.fillRect(x + ox - 1.2, y - 16, 2.4, 16);
    });
  }
}

function stampMeadowHedge(
  ctx: CanvasRenderingContext2D,
  x0: number,
  x1: number,
  heights: number[],
  texH: number,
  width: number,
  color: number,
): void {
  ctx.fillStyle = css(color);
  for (let x = x0; x <= x1; x += 7) {
    const y = texH - sampleHeight(heights, x, width) + 3;
    fillEllipse(ctx, x, y - 5, 8, 5, width);
  }
}

function plantMeadowTrees(
  ctx: CanvasRenderingContext2D,
  heights: number[],
  texH: number,
  width: number,
  xs: number[],
  scale: number,
  canopy: number,
  shade: number,
  highlight: number,
  pines: number[],
): void {
  for (const x of xs) {
    const y = texH - sampleHeight(heights, x, width) + 3;
    stampMeadowTree(ctx, x, y, scale, width, canopy, shade, highlight);
  }
  for (const x of pines) {
    const y = texH - sampleHeight(heights, x, width) + 3;
    stampMeadowPine(ctx, x, y, scale * 0.92, width, canopy, shade);
  }
}

function plantFarTreeLine(
  ctx: CanvasRenderingContext2D,
  heights: number[],
  texH: number,
  width: number,
  color: number,
): void {
  const groves = [180, 540, 890, 1320, 1760, 2140, 2460];
  for (const origin of groves) {
    for (const dx of [-22, -10, 0, 12, 24]) {
      const x = origin + dx;
      const h = sampleHeight(heights, x, width);
      if (h < texH * 0.34) {
        continue;
      }
      const scale = 0.42 + Math.abs(dx) * 0.012 + ((origin + dx) % 5) * 0.03;
      stampFarSilhouette(ctx, x, texH - h + 2, scale, width, color);
    }
  }
}

function meadowBackPeaks(texH: number): Peak[] {
  const s = texH / 310;
  return [
    { x: 220, w: 340, h: 78 * s },
    { x: 720, w: 420, h: 96 * s },
    { x: 1260, w: 300, h: 62 * s },
    { x: 1760, w: 380, h: 88 * s },
    { x: 2240, w: 360, h: 80 * s },
  ];
}

function meadowFrontPeaks(texH: number): Peak[] {
  const s = texH / 310;
  return [
    { x: 300, w: 260, h: 64 * s },
    { x: 780, w: 300, h: 78 * s },
    { x: 1280, w: 220, h: 50 * s },
    { x: 1760, w: 280, h: 70 * s },
    { x: 2220, w: 250, h: 66 * s },
    { x: 2520, w: 180, h: 44 * s },
  ];
}

function meadowHillPeaks(): Peak[] {
  return [
    { x: 200, w: 320, h: 88 },
    { x: 680, w: 380, h: 118 },
    { x: 1140, w: 260, h: 70 },
    { x: 1580, w: 340, h: 104 },
    { x: 2100, w: 320, h: 96 },
    { x: 2480, w: 220, h: 62 },
  ];
}

function drawMeadowFar(ctx: CanvasRenderingContext2D, colors: LandscapePalette, texH: number): void {
  const width = LANDSCAPE.stripW;
  const back = ridgeHeights(
    width,
    texH,
    meadowBackPeaks(texH),
    [
      { amp: texH * 0.06, cycles: 2, phase: 0.5 },
      { amp: texH * 0.035, cycles: 4, phase: 1.6 },
    ],
    0.52,
  );
  paintMeadowSlope(
    ctx,
    back,
    texH,
    width,
    colors.far,
    mixColor(colors.far, 0x3a5868, 0.28),
    mixColor(colors.far, colors.farCap, 0.4),
    36,
    7,
  );
  plantFarTreeLine(ctx, back, texH, width, mixColor(colors.far, 0x2a4454, 0.38));

  const front = ridgeHeights(
    width,
    texH,
    meadowFrontPeaks(texH),
    [
      { amp: texH * 0.035, cycles: 3, phase: 1.1 },
      { amp: texH * 0.02, cycles: 6, phase: 0.4 },
    ],
    0.36,
  );
  paintMeadowSlope(
    ctx,
    front,
    texH,
    width,
    mixColor(colors.far, colors.mountain, 0.22),
    mixColor(colors.far, 0x3a5868, 0.28),
    mixColor(colors.far, colors.farCap, 0.35),
    32,
    8,
  );
  plantFarTreeLine(ctx, front, texH, width, mixColor(colors.far, 0x2a4a3a, 0.5));

  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const haze = ctx.createLinearGradient(0, texH * 0.28, 0, texH);
  haze.addColorStop(0, css(0xd8eef8, 0));
  haze.addColorStop(1, css(0xd8eef8, 0.3));
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, width, texH);
  ctx.restore();
}

function drawMeadowHills(ctx: CanvasRenderingContext2D, colors: LandscapePalette, texH: number): void {
  const width = LANDSCAPE.stripW;
  const back = ridgeHeights(
    width,
    texH,
    meadowHillPeaks(),
    [
      { amp: texH * 0.05, cycles: 2, phase: 0.25 },
      { amp: texH * 0.03, cycles: 3, phase: 1.3 },
      { amp: texH * 0.02, cycles: 6, phase: 2.6 },
    ],
    0.56,
  );
  paintMeadowSlope(ctx, back, texH, width, mixColor(colors.mountain, colors.far, 0.34), colors.mountainShade, colors.cap, 70, 12);
  plantMeadowTrees(
    ctx,
    back,
    texH,
    width,
    [140, 175, 210, 430, 470, 510, 980, 1020, 1060, 1580, 1620, 1940, 2180, 2220, 2460],
    0.88,
    mixColor(colors.mountainShade, 0x1e3a22, 0.15),
    mixColor(colors.mountainShade, 0x142818, 0.3),
    colors.mountain,
    [560, 1320, 2080],
  );

  const front = ridgeHeights(
    width,
    texH,
    meadowFrontPeaks(texH),
    [
      { amp: texH * 0.04, cycles: 2, phase: 1.8 },
      { amp: texH * 0.025, cycles: 5, phase: 0.7 },
    ],
    0.4,
  );
  paintMeadowSlope(ctx, front, texH, width, colors.mountain, colors.mountainShade, mixColor(colors.cap, colors.groundTop, 0.35), 64, 14);
  stampMeadowHedge(ctx, 260, 420, front, texH, width, mixColor(colors.mountainShade, 0x1a3a1c, 0.15));
  stampMeadowHedge(ctx, 1640, 1840, front, texH, width, mixColor(colors.mountainShade, 0x1a3a1c, 0.15));
  ctx.strokeStyle = css(0xc4a060, 0.5);
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let x = 600; x <= 1140; x += 6) {
    const y = texH - sampleHeight(front, x, width) + 11;
    if (x === 600) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
  plantMeadowTrees(
    ctx,
    front,
    texH,
    width,
    [260, 300, 340, 380, 800, 840, 880, 920, 1220, 1260, 1300, 1740, 1780, 1820, 2180, 2230, 2280],
    1.18,
    0x3d7a32,
    0x245820,
    0x7ac84e,
    [760, 1288, 2200],
  );
  stampMeadowFence(ctx, 980, 1160, front, texH, width);
  stampMeadowWindmill(ctx, 620, texH - sampleHeight(front, 620, width) + 4, 1.08, width);
  stampMeadowCottage(ctx, 1088, texH - sampleHeight(front, 1088, width) + 3, 1.12, width);
  stampMeadowCottage(ctx, 1760, texH - sampleHeight(front, 1760, width) + 3, 1, width);
  stampMeadowCottage(ctx, 2320, texH - sampleHeight(front, 2320, width) + 3, 0.86, width);
}

function stampCrestTuft(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tall: number,
  lean: number,
  color: number,
): void {
  ctx.fillStyle = css(color);
  ctx.beginPath();
  ctx.moveTo(x - 1.1, y);
  ctx.quadraticCurveTo(x + lean * 0.28, y - tall * 0.52, x + lean, y - tall);
  ctx.quadraticCurveTo(x + lean * 0.18 + 1.6, y - tall * 0.48, x + 2.1, y);
  ctx.closePath();
  ctx.fill();
}

function drawMeadowGround(ctx: CanvasRenderingContext2D, colors: LandscapePalette, texH: number): void {
  const width = LANDSCAPE.stripW;
  const ridge = ridgeHeights(
    width,
    texH,
    [
      { x: 240, w: 400, h: 70 },
      { x: 820, w: 340, h: 95 },
      { x: 1460, w: 480, h: 80 },
      { x: 2100, w: 360, h: 105 },
      { x: 2480, w: 260, h: 55 },
    ],
    [
      { amp: 28, cycles: 2, phase: 0.4 },
      { amp: 16, cycles: 3, phase: 1.7 },
      { amp: 8, cycles: 5, phase: 0.8 },
    ],
    0.78,
  );
  paintMeadowSlope(ctx, ridge, texH, width, colors.ground, colors.groundShade, colors.groundTop, 92, 22);

  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 640; i += 1) {
    const x = (i * 97 + 13) % width;
    const y = ((i * 53 + 19) % (texH - 16)) + 8;
    ctx.fillStyle = css(i % 3 === 0 ? colors.groundShade : colors.groundTop, 0.22);
    ctx.fillRect(x, y, 1.6, 3 + (i % 6));
  }
  for (let i = 0; i < 220; i += 1) {
    const x = (i * 149 + 41) % width;
    const y = ((i * 71 + 8) % Math.floor(texH * 0.55)) + 12;
    ctx.fillStyle = css(i % 2 === 0 ? 0x8ee05a : 0x2f7a22, 0.28);
    ellipseAt(ctx, x, y, 8 + (i % 5), 3.4);
  }
  ctx.restore();

  for (let x = 4; x < width; x += 9) {
    const h = sampleHeight(ridge, x, width);
    const y = texH - h + 1;
    const tall = 10 + ((x * 17) % 14);
    const lean = ((x * 13) % 11) - 5;
    stampCrestTuft(ctx, x, y, tall, lean, x % 18 === 0 ? colors.groundShade : colors.groundTop);
    if (x % 27 === 0) {
      stampCrestTuft(ctx, x + 3, y, tall + 6, lean - 3, 0x7ad84a);
    }
  }

  const bushes = [180, 520, 860, 1180, 1520, 1880, 2260, 2480];
  for (const x of bushes) {
    const y = texH - sampleHeight(ridge, x, width) + 4;
    wrapStamp(x, width, 24, (ox) => {
      const px = x + ox;
      ctx.fillStyle = css(colors.groundShade);
      ellipseAt(ctx, px, y - 12, 20, 12);
      ctx.fillStyle = css(mixColor(colors.ground, 0x1e4a18, 0.15));
      ellipseAt(ctx, px - 10, y - 10, 12, 9);
      ellipseAt(ctx, px + 11, y - 9, 11, 8);
      ctx.fillStyle = css(colors.groundTop, 0.55);
      ellipseAt(ctx, px - 4, y - 18, 7, 4);
    });
  }

  const rocks = [340, 980, 1400, 2040];
  for (const x of rocks) {
    const y = texH - sampleHeight(ridge, x, width) + 2;
    wrapStamp(x, width, 16, (ox) => {
      const px = x + ox;
      ctx.fillStyle = css(0x6a7a48);
      ellipseAt(ctx, px, y - 7, 14, 8);
      ctx.fillStyle = css(0x4a5a32);
      ellipseAt(ctx, px + 6, y - 6, 8, 6);
      ctx.fillStyle = css(0xc4d090, 0.4);
      ellipseAt(ctx, px - 4, y - 11, 5, 2.4);
    });
  }

  for (const bloom of [
    { x: 90, c: 0xffe066 },
    { x: 210, c: 0xff7aa2 },
    { x: 400, c: 0xfff8e8 },
    { x: 610, c: 0xffe066 },
    { x: 740, c: 0xff7aa2 },
    { x: 910, c: 0xfff8e8 },
    { x: 1090, c: 0xffe066 },
    { x: 1310, c: 0xff7aa2 },
    { x: 1490, c: 0xfff8e8 },
    { x: 1670, c: 0xffe066 },
    { x: 1890, c: 0xff7aa2 },
    { x: 2070, c: 0xfff8e8 },
    { x: 2230, c: 0xffe066 },
    { x: 2410, c: 0xff7aa2 },
  ]) {
    const y = texH - sampleHeight(ridge, bloom.x, width) - 8 - (bloom.x % 7);
    wrapStamp(bloom.x, width, 6, (ox) => {
      ctx.fillStyle = css(0x2d7a22);
      ctx.fillRect(bloom.x + ox - 0.7, y + 3, 1.4, 8);
      ctx.fillStyle = css(bloom.c);
      ellipseAt(ctx, bloom.x + ox, y, 3.4, 3.1);
      ctx.fillStyle = css(0xfff4c4);
      ellipseAt(ctx, bloom.x + ox - 0.6, y - 0.6, 1.2, 1.2);
    });
  }
}

function drawSky(scene: Phaser.Scene, theme: Theme, colors: LandscapePalette): void {
  if (theme === 'ocean') {
    paintCanvas(scene, skyKey(theme), LANDSCAPE.stripW, GAME_HEIGHT, (ctx) => {
      const steps = 48;
      const slice = Math.ceil(GAME_HEIGHT / steps) + 1;
      for (let i = 0; i < steps; i += 1) {
        const t = i / (steps - 1);
        const bent = t * t * 0.55 + t * 0.45;
        ctx.fillStyle = css(mixColor(colors.skyTop, colors.skyHorizon, bent));
        ctx.fillRect(0, (GAME_HEIGHT / steps) * i, LANDSCAPE.stripW, slice);
      }
      paintGodRays(ctx, LANDSCAPE.stripW, GAME_HEIGHT);
      paintCaustics(ctx, LANDSCAPE.stripW, 210);
    });
    return;
  }
  if (theme === 'grass') {
    paintCanvas(scene, skyKey(theme), LANDSCAPE.stripW, GAME_HEIGHT, (ctx) => {
      paintMeadowSky(ctx, LANDSCAPE.stripW, GAME_HEIGHT, colors);
    });
    return;
  }
  paintCanvas(scene, skyKey(theme), 16, GAME_HEIGHT, (ctx) => {
    const steps = 36;
    const slice = Math.ceil(GAME_HEIGHT / steps) + 1;
    for (let i = 0; i < steps; i += 1) {
      ctx.fillStyle = css(mixColor(colors.skyTop, colors.skyHorizon, i / (steps - 1)));
      ctx.fillRect(0, (GAME_HEIGHT / steps) * i, 16, slice);
    }
  });
}

function cloudPlan(theme: Theme): { x: number; y: number; s: number }[] {
  switch (theme) {
    case 'grass':
      return [
        { x: 160, y: 98, s: 1.2 },
        { x: 430, y: 128, s: 0.78 },
        { x: 720, y: 88, s: 1.28 },
        { x: 1040, y: 136, s: 0.68 },
        { x: 1360, y: 102, s: 1.05 },
        { x: 1680, y: 84, s: 0.92 },
        { x: 1980, y: 132, s: 1.12 },
        { x: 2260, y: 92, s: 0.74 },
        { x: 2480, y: 118, s: 1.08 },
      ];
    case 'snow':
      return [
        { x: 200, y: 78, s: 1.08 },
        { x: 560, y: 120, s: 0.7 },
        { x: 980, y: 84, s: 1.22 },
        { x: 1420, y: 70, s: 0.86 },
        { x: 1860, y: 112, s: 0.96 },
        { x: 2260, y: 76, s: 1.14 },
        { x: 2480, y: 102, s: 0.72 },
      ];
    case 'desert':
      return [
        { x: 280, y: 68, s: 0.7 },
        { x: 860, y: 62, s: 0.52 },
        { x: 1480, y: 74, s: 0.82 },
        { x: 2040, y: 64, s: 0.6 },
        { x: 2420, y: 72, s: 0.48 },
      ];
    case 'ocean':
      return [
        { x: 220, y: 88, s: 1.1 },
        { x: 640, y: 68, s: 0.82 },
        { x: 1100, y: 102, s: 1.2 },
        { x: 1560, y: 74, s: 0.9 },
        { x: 1980, y: 92, s: 1.04 },
        { x: 2360, y: 70, s: 0.76 },
      ];
    case 'castle':
      return [
        { x: 260, y: 96, s: 1.42 },
        { x: 780, y: 74, s: 1.12 },
        { x: 1320, y: 114, s: 1.5 },
        { x: 1860, y: 82, s: 1.18 },
        { x: 2360, y: 100, s: 1.32 },
      ];
    case 'rainforest':
      return [
        { x: 140, y: 90, s: 1.18 },
        { x: 380, y: 124, s: 0.86 },
        { x: 640, y: 78, s: 1.34 },
        { x: 920, y: 110, s: 0.72 },
        { x: 1180, y: 86, s: 1.16 },
        { x: 1460, y: 128, s: 0.8 },
        { x: 1740, y: 94, s: 1.22 },
        { x: 2020, y: 72, s: 0.9 },
        { x: 2280, y: 108, s: 1.08 },
        { x: 2480, y: 84, s: 0.76 },
      ];
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

function drawClouds(scene: Phaser.Scene, theme: Theme, colors: LandscapePalette): void {
  paintCanvas(scene, cloudKey(theme), LANDSCAPE.stripW, LANDSCAPE.cloudH, (ctx) => {
    if (theme === 'ocean') {
      const motes = [
        { x: 140, y: 70, r: 5 },
        { x: 310, y: 120, r: 3 },
        { x: 480, y: 46, r: 4 },
        { x: 640, y: 96, r: 6 },
        { x: 820, y: 58, r: 3 },
        { x: 990, y: 132, r: 5 },
        { x: 1180, y: 40, r: 4 },
        { x: 1360, y: 88, r: 7 },
        { x: 1540, y: 64, r: 3 },
        { x: 1720, y: 118, r: 5 },
        { x: 1920, y: 52, r: 4 },
        { x: 2140, y: 100, r: 6 },
        { x: 2320, y: 38, r: 3 },
        { x: 2480, y: 84, r: 5 },
      ];
      ctx.fillStyle = css(colors.cloud, 0.35);
      for (const mote of motes) {
        fillCircle(ctx, mote.x, mote.y, mote.r, LANDSCAPE.stripW);
        fillCircle(ctx, mote.x + 8, mote.y - 14, Math.max(2, mote.r - 2), LANDSCAPE.stripW);
      }
      return;
    }
    if (theme === 'grass') {
      drawMeadowClouds(ctx, colors);
      return;
    }
    for (const cloud of cloudPlan(theme)) {
      stampCloud(ctx, cloud.x, cloud.y, cloud.s, LANDSCAPE.stripW, colors.cloud, colors.cloudShade);
    }
  });
}

function grassPeaks(far: boolean, texH: number): Peak[] {
  const s = texH / 310;
  if (far) {
    return [
      { x: 180, w: 200, h: 118 * s },
      { x: 560, w: 280, h: 150 * s },
      { x: 980, w: 160, h: 90 * s },
      { x: 1380, w: 240, h: 135 * s },
      { x: 1780, w: 180, h: 100 * s },
      { x: 2180, w: 260, h: 145 * s },
      { x: 2480, w: 140, h: 85 * s },
    ];
  }
  return [
    { x: 140, w: 230, h: 130 },
    { x: 420, w: 130, h: 70 },
    { x: 720, w: 280, h: 150 },
    { x: 1040, w: 160, h: 85 },
    { x: 1320, w: 80, h: 45 },
    { x: 1620, w: 250, h: 125 },
    { x: 1960, w: 140, h: 75 },
    { x: 2260, w: 260, h: 140 },
    { x: 2480, w: 150, h: 80 },
  ];
}

function snowPeaks(far: boolean, texH: number): Peak[] {
  const s = texH / 310;
  if (far) {
    return [
      { x: 160, w: 150, h: 130 * s },
      { x: 520, w: 210, h: 160 * s },
      { x: 920, w: 130, h: 100 * s },
      { x: 1320, w: 240, h: 165 * s },
      { x: 1760, w: 170, h: 115 * s },
      { x: 2160, w: 220, h: 155 * s },
      { x: 2460, w: 140, h: 95 * s },
    ];
  }
  return [
    { x: 120, w: 170, h: 145 },
    { x: 380, w: 110, h: 80 },
    { x: 680, w: 210, h: 165 },
    { x: 980, w: 140, h: 95 },
    { x: 1260, w: 90, h: 55 },
    { x: 1580, w: 230, h: 150 },
    { x: 1940, w: 120, h: 85 },
    { x: 2240, w: 200, h: 160 },
    { x: 2480, w: 150, h: 100 },
  ];
}

function fillTriangle(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  width: number,
): void {
  const draw = (dx: number) => {
    ctx.beginPath();
    ctx.moveTo(x1 + dx, y1);
    ctx.lineTo(x2 + dx, y2);
    ctx.lineTo(x3 + dx, y3);
    ctx.closePath();
    ctx.fill();
  };
  draw(0);
  const minX = Math.min(x1, x2, x3);
  const maxX = Math.max(x1, x2, x3);
  if (minX < 0) {
    draw(width);
  }
  if (maxX > width) {
    draw(-width);
  }
}

function drawPyramids(ctx: CanvasRenderingContext2D, colors: LandscapePalette, far: boolean, texH: number): void {
  const width = LANDSCAPE.stripW;
  const pyramids = far
    ? [
        { x: 240, w: 130, h: 95 },
        { x: 680, w: 190, h: 140 },
        { x: 1180, w: 110, h: 85 },
        { x: 1660, w: 170, h: 120 },
        { x: 2140, w: 140, h: 100 },
        { x: 2480, w: 100, h: 75 },
      ]
    : [
        { x: 180, w: 170, h: 175 },
        { x: 500, w: 85, h: 85 },
        { x: 820, w: 230, h: 230 },
        { x: 1180, w: 120, h: 130 },
        { x: 1500, w: 65, h: 65 },
        { x: 1840, w: 190, h: 185 },
        { x: 2200, w: 150, h: 150 },
        { x: 2480, w: 100, h: 100 },
      ];
  const base = texH - 2;
  for (const py of pyramids) {
    ctx.fillStyle = css(colors.mountain);
    fillTriangle(ctx, py.x - py.w / 2, base, py.x, base - py.h, py.x + py.w / 2, base, width);
    ctx.fillStyle = css(colors.mountainShade);
    fillTriangle(ctx, py.x, base - py.h, py.x + py.w / 2, base, py.x + py.w * 0.1, base, width);
    ctx.fillStyle = css(colors.cap, 0.9);
    fillTriangle(
      ctx,
      py.x - py.w * 0.12,
      base - py.h * 0.78,
      py.x,
      base - py.h,
      py.x + py.w * 0.12,
      base - py.h * 0.78,
      width,
    );
  }
}

function drawKeeps(ctx: CanvasRenderingContext2D, colors: LandscapePalette, far: boolean, texH: number): void {
  const width = LANDSCAPE.stripW;
  const keeps = far
    ? [
        { x: 400, w: 64, h: 95 },
        { x: 1120, w: 100, h: 140 },
        { x: 1840, w: 74, h: 105 },
        { x: 2400, w: 56, h: 85 },
      ]
    : [
        { x: 220, w: 88, h: 165 },
        { x: 600, w: 50, h: 110 },
        { x: 1040, w: 124, h: 230 },
        { x: 1420, w: 44, h: 95 },
        { x: 1780, w: 96, h: 185 },
        { x: 2160, w: 66, h: 130 },
        { x: 2460, w: 80, h: 160 },
      ];
  const merlon = far ? 6 : 8;
  const merlonH = far ? 8 : 12;
  for (const keep of keeps) {
    const drawAt = (ox: number) => {
      ctx.fillStyle = css(colors.mountainShade);
      ctx.fillRect(ox - keep.w / 2 - 6, texH - keep.h * 0.5, keep.w + 12, keep.h * 0.5);
      ctx.fillStyle = css(colors.mountain);
      ctx.fillRect(ox - keep.w / 2, texH - keep.h, keep.w, keep.h);
      ctx.fillStyle = css(colors.cap);
      for (let i = 0; i < keep.w; i += merlon * 2) {
        ctx.fillRect(ox - keep.w / 2 + i, texH - keep.h - merlonH, merlon, merlonH);
      }
      ctx.fillStyle = css(0x1a0810, 0.85);
      ctx.fillRect(ox - 7, texH - 30, 14, 30);
    };
    drawAt(keep.x);
    if (keep.x < keep.w) {
      drawAt(keep.x + width);
    }
    if (keep.x > width - keep.w) {
      drawAt(keep.x - width);
    }
  }
}

function drawRange(scene: Phaser.Scene, key: string, theme: Theme, colors: LandscapePalette, far: boolean): void {
  const width = LANDSCAPE.stripW;
  const texH = far ? LANDSCAPE.farH : LANDSCAPE.mountainH;
  paintCanvas(scene, key, width, texH, (ctx) => {
    if (theme === 'ocean') {
      if (far) {
        drawOceanSeamounts(ctx, colors, texH);
      } else {
        drawOceanReefs(ctx, colors, texH);
      }
      return;
    }
    if (theme === 'desert') {
      ctx.fillStyle = css(far ? colors.far : colors.mountain);
      ctx.fillRect(0, texH * 0.3, width, texH * 0.7);
      const pyramidColors = far
        ? { ...colors, mountain: colors.far, mountainShade: colors.far, cap: colors.farCap }
        : colors;
      drawPyramids(ctx, pyramidColors, far, texH);
      return;
    }
    if (theme === 'castle') {
      const ridge = ridgeHeights(
        width,
        texH,
        far
          ? [
              { x: 320, w: 240, h: texH * 0.28 },
              { x: 980, w: 300, h: texH * 0.38 },
              { x: 1680, w: 220, h: texH * 0.26 },
              { x: 2280, w: 260, h: texH * 0.34 },
            ]
          : [
              { x: 180, w: 260, h: 95 },
              { x: 760, w: 320, h: 125 },
              { x: 1400, w: 240, h: 85 },
              { x: 2000, w: 280, h: 110 },
              { x: 2460, w: 200, h: 80 },
            ],
        [
          { amp: texH * (far ? 0.05 : 0.06), cycles: 2, phase: 0.6 },
          { amp: texH * 0.03, cycles: 5, phase: 1.8 },
        ],
      );
      ctx.fillStyle = css(far ? colors.far : colors.mountain);
      fillBelow(ctx, ridge, texH, width);
      ctx.fillStyle = css(far ? colors.far : colors.mountainShade, 0.5);
      fillBand(ctx, ridge, texH, width, far ? 44 : 74);
      const keepColors = far
        ? { ...colors, mountain: colors.far, mountainShade: colors.far, cap: colors.farCap }
        : colors;
      drawKeeps(ctx, keepColors, far, texH);
      return;
    }
    if (theme === 'grass') {
      if (far) {
        drawMeadowFar(ctx, colors, texH);
      } else {
        drawMeadowHills(ctx, colors, texH);
      }
      return;
    }

    const peaks = theme === 'snow' ? snowPeaks(far, texH) : grassPeaks(far, texH);
    const ridge = ridgeHeights(
      width,
      texH,
      peaks,
      far
        ? [
            { amp: texH * 0.05, cycles: 2, phase: 0.5 },
            { amp: texH * 0.03, cycles: 5, phase: 1.6 },
          ]
        : [
            { amp: texH * 0.055, cycles: 2, phase: 0.25 },
            { amp: texH * 0.03, cycles: 3, phase: 1.3 },
            { amp: texH * 0.02, cycles: 7, phase: 2.6 },
          ],
    );
    ctx.fillStyle = css(far ? colors.far : colors.mountain);
    fillBelow(ctx, ridge, texH, width);
    ctx.fillStyle = css(far ? colors.far : colors.mountainShade, 0.42);
    fillBand(ctx, ridge, texH, width, far ? 48 : 80);
    if (theme === 'snow') {
      paintCaps(ctx, ridge, texH, width, far ? colors.farCap : colors.cap, texH * 0.74);
    }
  });
}

function drawGround(scene: Phaser.Scene, theme: Theme, colors: LandscapePalette): void {
  const width = LANDSCAPE.stripW;
  const texH = LANDSCAPE.groundH;
  paintCanvas(scene, hillKey(theme), width, texH, (ctx) => {
    if (theme === 'ocean') {
      drawOceanFloor(ctx, colors, texH);
      return;
    }
    if (theme === 'grass') {
      drawMeadowGround(ctx, colors, texH);
      return;
    }

    const ridge = ridgeHeights(
      width,
      texH,
      theme === 'desert'
        ? [
            { x: 320, w: 360, h: 55 },
            { x: 900, w: 440, h: 70 },
            { x: 1560, w: 320, h: 45 },
            { x: 2160, w: 400, h: 65 },
          ]
        : [
            { x: 240, w: 400, h: 70 },
            { x: 820, w: 340, h: 95 },
            { x: 1460, w: 480, h: 80 },
            { x: 2100, w: 360, h: 105 },
            { x: 2480, w: 260, h: 55 },
          ],
      [
        { amp: theme === 'desert' ? 22 : 28, cycles: 2, phase: 0.4 },
        { amp: theme === 'desert' ? 12 : 16, cycles: 3, phase: 1.7 },
        { amp: 8, cycles: 5, phase: 0.8 },
      ],
      0.78,
    );
    ctx.fillStyle = css(colors.ground);
    fillBelow(ctx, ridge, texH, width);
    ctx.fillStyle = css(colors.groundShade, 0.38);
    fillBand(ctx, ridge, texH, width, 90);
    ctx.fillStyle = css(colors.groundTop);
    fillBand(ctx, ridge, texH, width, 20);
  });
}

export function createLandscapeTextures(scene: Phaser.Scene): void {
  for (const theme of THEMES) {
    const colors = palette(theme);
    drawSky(scene, theme, colors);
    drawClouds(scene, theme, colors);
    drawRange(scene, farKey(theme), theme, colors, true);
    drawRange(scene, mountainKey(theme), theme, colors, false);
    drawGround(scene, theme, colors);
  }
}

export function skyKey(theme: Theme): string {
  return `sky-${theme}`;
}

export function cloudKey(theme: Theme): string {
  return `clouds-${theme}`;
}

export function farKey(theme: Theme): string {
  return `far-${theme}`;
}

export function hillKey(theme: Theme): string {
  switch (theme) {
    case 'grass':
      return 'hill-grass';
    case 'snow':
      return 'hill-snow';
    case 'desert':
      return 'hill-desert';
    case 'ocean':
      return 'hill-ocean';
    case 'castle':
      return 'hill-castle';
    case 'rainforest':
      return 'hill-rainforest';
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

export function mountainKey(theme: Theme): string {
  switch (theme) {
    case 'grass':
      return 'mtn-grass';
    case 'snow':
      return 'mtn-snow';
    case 'desert':
      return 'mtn-desert';
    case 'ocean':
      return 'mtn-ocean';
    case 'castle':
      return 'mtn-castle';
    case 'rainforest':
      return 'mtn-rainforest';
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}
