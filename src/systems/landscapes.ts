import Phaser from 'phaser';
import { GAME_HEIGHT, type Theme } from '../config';

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
        skyTop: 0x3a78dc,
        skyHorizon: 0xa6d0ff,
        cloud: 0xf7fbff,
        cloudShade: 0xd7e7f8,
        far: 0x8bb7c9,
        farCap: 0xe8f4f8,
        mountain: 0x5a8a58,
        mountainShade: 0x3f6a40,
        cap: 0xe4f0e6,
        ground: 0x3d9e2f,
        groundShade: 0x2d7a22,
        groundTop: 0x58c43c,
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
        skyTop: 0x3a88c8,
        skyHorizon: 0x9fd4f4,
        cloud: 0xf3fbff,
        cloudShade: 0xc5e4f6,
        far: 0x6aa3b8,
        farCap: 0xd8eef6,
        mountain: 0x2f6a48,
        mountainShade: 0x1f4a34,
        cap: 0xd5c090,
        ground: 0x1b6f9a,
        groundShade: 0x0e3a58,
        groundTop: 0x5ec4e0,
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

function paintCaps(ctx: CanvasRenderingContext2D, heights: number[], texH: number, width: number, color: number, minH: number): void {
  ctx.fillStyle = css(color);
  for (let x = 32; x < width - 32; x += 14) {
    const h = heights[x] ?? 0;
    if (h < minH) {
      continue;
    }
    const left = heights[x - 28] ?? 0;
    const right = heights[x + 28] ?? 0;
    if (h < left || h < right) {
      continue;
    }
    const peakY = texH - h;
    const spread = 16 + (h - minH) * 0.18;
    ctx.beginPath();
    ctx.moveTo(x - spread, peakY + 26);
    ctx.lineTo(x, peakY);
    ctx.lineTo(x + spread, peakY + 26);
    ctx.closePath();
    ctx.fill();
  }
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

function drawSky(scene: Phaser.Scene, theme: Theme, colors: LandscapePalette): void {
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
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

function drawClouds(scene: Phaser.Scene, theme: Theme, colors: LandscapePalette): void {
  paintCanvas(scene, cloudKey(theme), LANDSCAPE.stripW, LANDSCAPE.cloudH, (ctx) => {
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

function oceanPeaks(far: boolean, texH: number): Peak[] {
  const s = texH / 310;
  if (far) {
    return [
      { x: 300, w: 180, h: 70 * s },
      { x: 820, w: 240, h: 100 * s },
      { x: 1420, w: 160, h: 60 * s },
      { x: 1960, w: 220, h: 90 * s },
      { x: 2420, w: 150, h: 55 * s },
    ];
  }
  return [
    { x: 240, w: 210, h: 90 },
    { x: 620, w: 130, h: 50 },
    { x: 1080, w: 260, h: 115 },
    { x: 1580, w: 150, h: 65 },
    { x: 2040, w: 230, h: 100 },
    { x: 2420, w: 140, h: 55 },
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

    const peaks = theme === 'snow' ? snowPeaks(far, texH) : theme === 'ocean' ? oceanPeaks(far, texH) : grassPeaks(far, texH);
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
      paintCaps(ctx, ridge, texH, width, far ? colors.farCap : colors.cap, texH * 0.8);
    }
  });
}

function drawGround(scene: Phaser.Scene, theme: Theme, colors: LandscapePalette): void {
  const width = LANDSCAPE.stripW;
  const texH = LANDSCAPE.groundH;
  paintCanvas(scene, hillKey(theme), width, texH, (ctx) => {
    if (theme === 'ocean') {
      const heights = new Array<number>(width + 1);
      for (let x = 0; x <= width; x += 1) {
        const surfaceY =
          32 +
          12 * Math.sin((x / width) * Math.PI * 2 * 5) +
          6 * Math.sin((x / width) * Math.PI * 2 * 11 + 1.2) +
          3 * Math.sin((x / width) * Math.PI * 2 * 17 + 0.4);
        heights[x] = texH - surfaceY;
      }
      ctx.fillStyle = css(colors.groundShade);
      fillBelow(ctx, heights, texH, width);
      ctx.fillStyle = css(colors.ground);
      fillBand(ctx, heights, texH, width, 140);
      ctx.fillStyle = css(colors.groundTop);
      fillBand(ctx, heights, texH, width, 42);
      ctx.strokeStyle = css(0xd8f6ff, 0.7);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, texH - (heights[0] ?? 0));
      for (let x = 2; x <= width; x += 2) {
        ctx.lineTo(x, texH - (heights[x] ?? 0));
      }
      ctx.stroke();
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
  const themes: Theme[] = ['grass', 'snow', 'desert', 'ocean', 'castle'];
  for (const theme of themes) {
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
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}
