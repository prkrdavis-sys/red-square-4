import Phaser from 'phaser';
import { GROUND_Y, JUMP_REACH_TILES, TILE, type Theme } from '../config';
import { arenaBannerKey, arenaRingKey, arenaTorchKey } from '../systems/textures';
import type { Grid } from './grid';

const hop = 1;
const low = JUMP_REACH_TILES;

function rowAboveGround(tilesUp: number): number {
  return GROUND_Y - tilesUp;
}

const WALL_DEPTH = 4;

export interface ArenaLayout {
  gateX: number;
  floorStart: number;
  floorEnd: number;
  wallStart: number;
  pillarW: number;
  gap: number;
  pillarH: number;
}

interface GateSpec {
  pillarW: number;
  gap: number;
  height: number;
}

function gateSpec(theme: Theme): GateSpec {
  switch (theme) {
    case 'grass':
      return { pillarW: 1, gap: 3, height: 6 };
    case 'snow':
      return { pillarW: 1, gap: 3, height: 7 };
    case 'desert':
      return { pillarW: 1, gap: 4, height: 5 };
    case 'ocean':
      return { pillarW: 1, gap: 3, height: 6 };
    case 'castle':
      return { pillarW: 2, gap: 3, height: 7 };
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

export function getArenaLayout(
  bossTileX: number,
  theme: Theme,
  grand: boolean,
  mapWidth: number,
): ArenaLayout {
  const floorLeft = grand ? 10 : 8;
  const floorRight = grand ? 10 : 8;
  const gate = gateSpec(theme);
  const floorStart = Math.max(gate.pillarW * 2 + gate.gap + 1, bossTileX - floorLeft);
  const floorEnd = Math.min(mapWidth - WALL_DEPTH, bossTileX + floorRight);
  const wallStart = floorEnd;
  const gateX = Math.max(0, floorStart - (gate.pillarW * 2 + gate.gap));
  return {
    gateX,
    floorStart,
    floorEnd,
    wallStart,
    pillarW: gate.pillarW,
    gap: gate.gap,
    pillarH: gate.height,
  };
}

export function stampArena(grid: Grid, bossX: number, theme: Theme, grand: boolean): void {
  const layout = getArenaLayout(bossX, theme, grand, grid.width);
  const { gateX, floorStart, floorEnd, wallStart } = layout;
  const span = grid.width - gateX;

  grid.clearAbove(gateX, span);
  grid.fillFloor(gateX, span);
  grid.arenaFloor(floorStart, Math.max(1, floorEnd - floorStart));
  stampCliff(grid, wallStart, theme);
  stampGate(grid, layout);
  stampThemeArena(grid, layout, theme);
}

function stampCliff(grid: Grid, fromX: number, theme: Theme): void {
  for (let x = fromX; x < grid.width; x += 1) {
    grid.column(x, 1, GROUND_Y - 1);
    const cap = cliffCap(theme, x);
    if (cap) {
      grid.set(x, 0, '#');
    }
  }
}

function cliffCap(theme: Theme, x: number): boolean {
  switch (theme) {
    case 'grass':
      return x % 3 !== 1;
    case 'snow':
      return true;
    case 'desert':
      return x % 3 !== 2;
    case 'ocean':
      return true;
    case 'castle':
      return x % 2 === 0;
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

/** Pillar that leaves ground-level headroom so the player can run through. */
function stampArch(grid: Grid, x: number, tilesHigh: number): void {
  const top = rowAboveGround(tilesHigh);
  const bottom = GROUND_Y - 3;
  if (top <= bottom) {
    grid.column(x, top, bottom);
  }
}

function stampGate(grid: Grid, layout: ArenaLayout): void {
  const { gateX, pillarW, gap, pillarH } = layout;
  for (let i = 0; i < pillarW; i += 1) {
    stampArch(grid, gateX + i, pillarH);
    stampArch(grid, gateX + pillarW + gap + i, pillarH);
  }
  grid.plat(gateX, rowAboveGround(pillarH), pillarW * 2 + gap, false);
}

function stampThemeArena(grid: Grid, layout: ArenaLayout, theme: Theme): void {
  const { floorStart, floorEnd, wallStart } = layout;
  switch (theme) {
    case 'grass':
      stampGrassArena(grid, floorStart, floorEnd);
      break;
    case 'snow':
      stampSnowArena(grid, floorStart, floorEnd, wallStart);
      break;
    case 'desert':
      stampDesertArena(grid, floorStart, floorEnd);
      break;
    case 'ocean':
      stampOceanArena(grid, floorStart, floorEnd, wallStart);
      break;
    case 'castle':
      stampCastleArena(grid, floorStart, floorEnd, wallStart);
      break;
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

function stampGrassArena(grid: Grid, floorStart: number, floorEnd: number): void {
  grid.hill(floorStart + 2, 3, hop);
  grid.hill(floorEnd - 3, 3, hop);
  grid.plat(floorStart + 2, rowAboveGround(low), 3, true);
  grid.plat(floorEnd - 3, rowAboveGround(low), 3, true);
  grid.wall(floorEnd - 1, 3);
}

function stampSnowArena(grid: Grid, floorStart: number, floorEnd: number, wallStart: number): void {
  grid.hill(floorStart + 2, 4, hop);
  grid.hill(floorEnd - 3, 3, hop);
  grid.wall(floorEnd - 1, 4);
  for (let x = floorStart + 2; x < wallStart; x += 4) {
    grid.set(x, 0, '#');
    if (x + 1 < wallStart) {
      grid.set(x + 1, 0, '#');
    }
  }
}

function stampDesertArena(grid: Grid, floorStart: number, floorEnd: number): void {
  grid.hill(floorStart + 2, 2, hop);
  grid.hill(floorEnd - 2, 2, hop);
  grid.stairs(floorEnd - 4, 3, 1);
  grid.wall(floorEnd - 1, 5);
}

function stampOceanArena(grid: Grid, floorStart: number, floorEnd: number, wallStart: number): void {
  for (let x = floorStart; x < grid.width; x += 1) {
    grid.set(x, 0, '#');
  }
  grid.wall(floorEnd - 1, 5);
  grid.plat(floorStart + 2, rowAboveGround(low), 3, true);
  grid.plat(Math.max(floorStart + 6, wallStart - 5), rowAboveGround(low), 3, true);
}

function stampCastleArena(grid: Grid, floorStart: number, floorEnd: number, wallStart: number): void {
  for (let x = floorStart; x < grid.width; x += 1) {
    grid.set(x, 0, '#');
  }
  grid.plat(floorStart + 2, rowAboveGround(low), 4, false);
  grid.plat(Math.max(floorStart + 6, wallStart - 6), rowAboveGround(low), 4, false);
  grid.wall(floorEnd - 1, 6);
}

export function decorateArena(
  scene: Phaser.Scene,
  bossPixelX: number,
  theme: Theme,
  grand: boolean,
  mapWidthTiles: number,
): void {
  const bossTileX = Math.floor(bossPixelX / TILE);
  const layout = getArenaLayout(bossTileX, theme, grand, mapWidthTiles);
  const groundY = GROUND_Y * TILE;
  const floorMid = ((layout.floorStart + layout.floorEnd) / 2) * TILE;
  const floorW = (layout.floorEnd - layout.floorStart) * TILE;

  scene.add
    .image(bossPixelX, groundY - 6, arenaRingKey(theme))
    .setOrigin(0.5, 1)
    .setDepth(1)
    .setAlpha(grand ? 0.95 : 0.8);

  scene.add
    .rectangle(floorMid, groundY - 2, floorW, 10, floorWash(theme), 0.22)
    .setOrigin(0.5, 1)
    .setDepth(1);

  const bannerXs = [
    (layout.gateX + layout.pillarW * 0.5) * TILE,
    (layout.gateX + layout.pillarW + layout.gap + layout.pillarW * 0.5) * TILE,
    (layout.floorStart + 2) * TILE,
    (layout.floorEnd - 2) * TILE,
  ];
  for (const x of bannerXs) {
    scene.add
      .image(x, 36, arenaBannerKey(theme))
      .setOrigin(0.5, 0)
      .setDepth(6);
  }

  if (theme === 'castle' || theme === 'desert') {
    const torchKey = arenaTorchKey(theme);
    const torchXs = [layout.floorStart + 1, layout.floorEnd - 2];
    for (const tileX of torchXs) {
      scene.add
        .image(tileX * TILE + TILE / 2, groundY - TILE * 3.2, torchKey)
        .setOrigin(0.5, 1)
        .setDepth(6);
    }
  }

  addArenaDust(scene, layout, theme);
}

function floorWash(theme: Theme): number {
  switch (theme) {
    case 'grass':
      return 0x3a2410;
    case 'snow':
      return 0x8ec6e6;
    case 'desert':
      return 0x7a4a18;
    case 'ocean':
      return 0x0a3040;
    case 'castle':
      return 0x4a1020;
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

function addArenaDust(scene: Phaser.Scene, layout: ArenaLayout, theme: Theme): void {
  const minX = layout.floorStart * TILE;
  const maxX = layout.wallStart * TILE;
  let tint: number;
  let speedY: { min: number; max: number };
  let frequency: number;
  switch (theme) {
    case 'grass':
      tint = 0xc8e86a;
      speedY = { min: -18, max: -6 };
      frequency = 260;
      break;
    case 'snow':
      tint = 0xffffff;
      speedY = { min: 12, max: 28 };
      frequency = 200;
      break;
    case 'desert':
      tint = 0xe0b86a;
      speedY = { min: -8, max: 8 };
      frequency = 240;
      break;
    case 'ocean':
      tint = 0x9fe8ff;
      speedY = { min: -24, max: -8 };
      frequency = 220;
      break;
    case 'castle':
      tint = 0xff6622;
      speedY = { min: -22, max: -6 };
      frequency = 200;
      break;
    default: {
      const neverTheme: never = theme;
      tint = neverTheme;
      speedY = { min: 0, max: 0 };
      frequency = 0;
    }
  }
  scene.add
    .particles(0, 0, 'poof-particle', {
      x: { min: minX, max: maxX },
      y: { min: 70, max: GROUND_Y * TILE - 50 },
      tint,
      scale: { start: 0.28, end: 0 },
      lifespan: 1900,
      frequency,
      quantity: 1,
      speedY,
      speedX: { min: -12, max: 12 },
      alpha: { start: 0.45, end: 0 },
    })
    .setDepth(8);
}
