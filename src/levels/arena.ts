import Phaser from 'phaser';
import { GROUND_Y, JUMP_REACH_TILES, TILE, type Theme } from '../config';
import {
  arenaBannerKey,
  arenaFlagColor,
  arenaGateKey,
  arenaRingKey,
  arenaTorchKey,
  kenneyArenaFlagKeys,
  kenneyTorchKeys,
  kenneyWindowKey,
} from '../systems/textures';
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

/** Pixel box bosses must stay inside, plus the X the player crosses to start the fight. */
export interface ArenaKeep {
  left: number;
  right: number;
  top: number;
  bottom: number;
  enterX: number;
}

export function bossSafeLandingX(arena: ArenaKeep, bossX: number): number {
  const midpoint = (arena.left + arena.right) / 2;
  return bossX <= midpoint ? arena.right - 76 : arena.left + 76;
}

export function arenaKeepBounds(layout: ArenaLayout): ArenaKeep {
  return {
    left: layout.floorStart * TILE,
    right: (layout.floorEnd - 1) * TILE,
    top: TILE * 0.5,
    bottom: GROUND_Y * TILE,
    enterX: layout.floorStart * TILE + 24,
  };
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
    case 'rainforest':
      return { pillarW: 1, gap: 3, height: 6 };
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
  stampThemeArena(grid, layout, theme);
}

function stampCliff(grid: Grid, fromX: number, theme: Theme): void {
  for (let x = fromX; x < grid.width; x += 1) {
    grid.column(x, 1, GROUND_Y - 1, 'W');
    if (merlon(theme, x - fromX)) {
      grid.set(x, 0, 'W');
    }
  }
}

function merlon(theme: Theme, offset: number): boolean {
  switch (theme) {
    case 'grass':
    case 'desert':
      return offset % 2 === 0;
    case 'snow':
    case 'ocean':
      return offset % 3 !== 1;
    case 'castle':
      return offset % 2 === 0;
    case 'rainforest':
      return offset % 2 === 0;
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

function stampThemeArena(grid: Grid, layout: ArenaLayout, theme: Theme): void {
  const { floorStart, floorEnd, wallStart } = layout;
  grid.hill(floorStart + 2, 3, hop);
  grid.hill(Math.max(floorStart + 6, floorEnd - 5), 3, hop);
  grid.plat(floorStart + 2, rowAboveGround(low), 3, true);
  grid.plat(Math.max(floorStart + 6, wallStart - 6), rowAboveGround(low), 3, true);
  grid.wall(floorEnd - 1, 5, 'W');
  switch (theme) {
    case 'grass':
      break;
    case 'snow':
      grid.plat(floorStart + 6, rowAboveGround(low), 2, true);
      break;
    case 'desert':
      grid.stairs(floorEnd - 5, 3, 1);
      break;
    case 'ocean':
      grid.plat(Math.max(floorStart + 5, wallStart - 8), rowAboveGround(low), 3, true);
      break;
    case 'castle':
      grid.plat(floorStart + 2, rowAboveGround(low), 4, false);
      grid.wall(floorEnd - 1, 6, 'W');
      break;
    case 'rainforest':
      grid.plat(floorStart + 5, rowAboveGround(low), 3, true);
      break;
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
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

  ensureArenaAnims(scene, theme);
  addDecorativeGate(scene, layout, theme, groundY);
  plantGroundFlags(scene, layout, groundY, theme, grand);
  mountLintelFlags(scene, layout, groundY, theme);
  addWallFixtures(scene, layout, groundY, theme, grand);
  addArenaDust(scene, layout, theme);
}

function ensureArenaAnims(scene: Phaser.Scene, theme: Theme): void {
  const torch = kenneyTorchKeys();
  if (scene.textures.exists(torch.a) && scene.textures.exists(torch.b) && !scene.anims.exists('kenney-torch')) {
    scene.anims.create({
      key: 'kenney-torch',
      frames: [{ key: torch.a }, { key: torch.b }],
      frameRate: 8,
      repeat: -1,
    });
  }
  const flags = kenneyArenaFlagKeys(theme);
  const flagAnim = `kenney-flag-${arenaFlagColor(theme)}`;
  if (scene.textures.exists(flags.a) && scene.textures.exists(flags.b) && !scene.anims.exists(flagAnim)) {
    scene.anims.create({
      key: flagAnim,
      frames: [{ key: flags.a }, { key: flags.b }],
      frameRate: 6,
      repeat: -1,
    });
  }
}

function gatePixelSize(layout: ArenaLayout): { left: number; width: number; height: number } {
  return {
    left: layout.gateX * TILE,
    width: (layout.pillarW * 2 + layout.gap) * TILE,
    height: (layout.pillarH + 1) * TILE,
  };
}

function addDecorativeGate(
  scene: Phaser.Scene,
  layout: ArenaLayout,
  theme: Theme,
  groundY: number,
): void {
  const { left, width, height } = gatePixelSize(layout);
  scene.add
    .image(left + width / 2, groundY, arenaGateKey(theme))
    .setOrigin(0.5, 1)
    .setDisplaySize(width, height)
    .setDepth(21);
}

function plantGroundFlags(
  scene: Phaser.Scene,
  layout: ArenaLayout,
  groundY: number,
  theme: Theme,
  grand: boolean,
): void {
  const { left, width } = gatePixelSize(layout);
  const xs = [
    left - 24,
    left + width + 24,
    (layout.floorStart + 1.5) * TILE,
    (layout.floorEnd - 2.5) * TILE,
  ];
  if (grand) {
    xs.push((layout.floorStart + layout.floorEnd - 6) * 0.5 * TILE);
    xs.push((layout.floorStart + layout.floorEnd + 6) * 0.5 * TILE);
  }
  for (const x of xs) {
    if (x < TILE) {
      continue;
    }
    scene.add.image(x, groundY, arenaBannerKey(theme)).setOrigin(0.5, 1).setDepth(6);
  }
}

function mountLintelFlags(
  scene: Phaser.Scene,
  layout: ArenaLayout,
  groundY: number,
  theme: Theme,
): void {
  const flags = kenneyArenaFlagKeys(theme);
  if (!scene.textures.exists(flags.a)) {
    return;
  }
  const { left, width, height } = gatePixelSize(layout);
  const capitalY = groundY - height * 0.68;
  const xs = [left + width * 0.12, left + width * 0.88];
  const anim = `kenney-flag-${arenaFlagColor(theme)}`;
  for (const x of xs) {
    const flag = scene.add.sprite(x, capitalY, flags.a).setOrigin(0.5, 1).setDepth(22);
    if (scene.anims.exists(anim)) {
      flag.play(anim);
    }
  }
}

function addWallFixtures(
  scene: Phaser.Scene,
  layout: ArenaLayout,
  groundY: number,
  theme: Theme,
  grand: boolean,
): void {
  const inner = layout.floorEnd - 1;
  const cliff = layout.wallStart;
  addTorch(scene, cliff, 2, theme);
  addTorch(scene, inner, 5, theme);
  addTorch(scene, inner, 7, theme);
  if (grand) {
    addTorch(scene, cliff, 3, theme);
  }
  const windowKey = kenneyWindowKey();
  if (scene.textures.exists(windowKey)) {
    scene.add
      .image(inner * TILE + TILE / 2, 4 * TILE + TILE / 2, windowKey)
      .setOrigin(0.5)
      .setDepth(5);
    if (grand) {
      scene.add
        .image(inner * TILE + TILE / 2, 6 * TILE + TILE / 2, windowKey)
        .setOrigin(0.5)
        .setDepth(5);
    }
  }
  const { left, width, height } = gatePixelSize(layout);
  const torchY = groundY - height * 0.42;
  addTorchAt(scene, left + width * 0.12, torchY, theme, 22);
  addTorchAt(scene, left + width * 0.88, torchY, theme, 22);
}

function addTorch(scene: Phaser.Scene, tileX: number, tileY: number, theme: Theme): void {
  addTorchAt(scene, tileX * TILE + TILE / 2, tileY * TILE + TILE / 2, theme, 7);
}

function addTorchAt(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  theme: Theme,
  depth: number,
): void {
  const glow = scene.add.circle(cx, cy - 8, 22, 0xff8833, 0.22).setDepth(depth - 1);
  scene.tweens.add({
    targets: glow,
    alpha: 0.08,
    duration: 320,
    yoyo: true,
    repeat: -1,
  });
  const torch = kenneyTorchKeys();
  if (scene.textures.exists(torch.a)) {
    const sprite = scene.add.sprite(cx, cy, torch.a).setOrigin(0.5).setDepth(depth);
    if (scene.anims.exists('kenney-torch')) {
      sprite.play('kenney-torch');
    }
    return;
  }
  scene.add.image(cx, cy + TILE / 2, arenaTorchKey(theme)).setOrigin(0.5, 1).setDepth(depth);
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
    case 'rainforest':
      return 0x1a3a18;
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
    case 'rainforest':
      tint = 0x8ab05a;
      speedY = { min: -16, max: -4 };
      frequency = 240;
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
