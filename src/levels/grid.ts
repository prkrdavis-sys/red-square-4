import {
  GROUND_Y,
  JUMP_REACH_TILES,
  MAP_ROWS,
  enemiesForWorld,
  specialForTheme,
  type EnemyKind,
  type MiniBossVariant,
  type SpecialKind,
  type Theme,
} from '../config';
import { stampArena } from './arena';

/** Convert tiles-above-ground to a row index. 2 is a full jump from the floor. */
export function rowAboveGround(tilesUp: number): number {
  return GROUND_Y - tilesUp;
}

/** Jumpable ledge heights in tiles above the floor. */
export const LEDGE = {
  hop: 1,
  low: JUMP_REACH_TILES,
  mid: JUMP_REACH_TILES * 2,
  high: JUMP_REACH_TILES * 3,
} as const;

export class Grid {
  cells: string[][];

  constructor(width: number) {
    this.cells = Array.from({ length: MAP_ROWS }, () => Array(width).fill('.'));
    this.fillGround();
  }

  get width(): number {
    return this.cells[0]?.length ?? 0;
  }

  fillGround(): void {
    for (let y = GROUND_Y; y < MAP_ROWS; y += 1) {
      this.cells[y].fill('#');
    }
  }

  fillFloor(x: number, w: number): void {
    for (let i = 0; i < w; i += 1) {
      for (let y = GROUND_Y; y < MAP_ROWS; y += 1) {
        this.set(x + i, y, '#');
      }
    }
  }

  arenaFloor(x: number, w: number): void {
    this.fillFloor(x, w);
    for (let i = 0; i < w; i += 1) {
      this.set(x + i, GROUND_Y, '@');
    }
  }

  clearAbove(x: number, w: number): void {
    for (let i = 0; i < w; i += 1) {
      for (let y = 0; y < GROUND_Y; y += 1) {
        this.set(x + i, y, '.');
      }
    }
  }

  pit(x: number, w: number): void {
    for (let i = 0; i < w; i += 1) {
      for (let y = GROUND_Y; y < MAP_ROWS; y += 1) {
        this.set(x + i, y, '.');
      }
    }
  }

  lava(x: number, w: number): void {
    this.pit(x, w);
    for (let i = 0; i < w; i += 1) {
      this.set(x + i, MAP_ROWS - 1, '~');
    }
  }

  plat(x: number, y: number, w: number, oneWay = true, tile?: string): void {
    const cell = tile ?? (oneWay ? '=' : '#');
    for (let i = 0; i < w; i += 1) {
      this.set(x + i, y, cell);
    }
  }

  stairs(x: number, steps: number, dir = 1, tile = '#'): void {
    for (let i = 0; i < steps; i += 1) {
      const height = i + 1;
      for (let h = 0; h < height; h += 1) {
        this.set(x + i * dir, GROUND_Y - 1 - h, tile);
      }
    }
  }

  hill(x: number, w: number, tilesHigh: number, tile = '#'): void {
    for (let i = 0; i < w; i += 1) {
      for (let t = 1; t <= tilesHigh; t += 1) {
        this.set(x + i, GROUND_Y - t, tile);
      }
    }
  }

  wall(x: number, tilesHigh: number, tile = '#'): void {
    this.column(x, rowAboveGround(tilesHigh), GROUND_Y - 1, tile);
  }

  column(x: number, fromY: number, toY: number, tile = '#'): void {
    for (let y = fromY; y <= toY; y += 1) {
      this.set(x, y, tile);
    }
  }

  set(x: number, y: number, ch: string): void {
    if (y < 0 || y >= MAP_ROWS || x < 0 || x >= this.width) {
      return;
    }
    this.cells[y][x] = ch;
  }

  put(x: number, y: number, ch: string): void {
    this.set(x, y, ch);
  }

  lines(): string[] {
    return this.cells.map((row) => row.join(''));
  }
}

export interface CourseSpec {
  width: number;
  playerX?: number;
  pits?: [number, number][];
  lava?: [number, number][];
  /** One-way ledges: [x, tilesAboveGround, width]. A full jump reaches 2 tiles. */
  plats?: [number, number, number][];
  /** Solid ledges: [x, tilesAboveGround, width]. */
  solids?: [number, number, number][];
  /** Raised floor: [x, width, tilesHigh]. Height 2 is jumpable from the ground. */
  hills?: [number, number, number][];
  /** Solid pillars on the ground: [x, tilesHigh]. Height 3+ blocks a running jump. */
  walls?: [number, number][];
  stairs?: [number, number, number?][];
  enemies?: number[];
  /** [x, tilesAboveGround] — stands on a ledge of that height. */
  airEnemies?: [number, number][];
  mini?: number;
  boss?: number;
}

export interface EnemySpawn {
  x: number;
  tilesUp: number;
  kind: EnemyKind;
}

export interface CoursePickup {
  x: number;
  tilesUp: number;
}

export type PuzzleKind = 'vine-bed' | 'ice-wall' | 'sand-wall' | 'down-current' | 'shadow-wall';

export interface PuzzleFeature {
  x: number;
  kind: PuzzleKind;
  height: number;
}

export interface CompiledCourse {
  rows: string[];
  enemies: EnemySpawn[];
  checkpoint: CoursePickup;
  collectibles: [CoursePickup, CoursePickup, CoursePickup];
  shield: CoursePickup;
  special: SpecialKind;
  specialAnchors: CoursePickup[];
  puzzles: PuzzleFeature[];
  miniVariant: MiniBossVariant | undefined;
}

export function buildCourse(spec: CourseSpec, theme: Theme = 'grass'): string[] {
  const grid = new Grid(spec.width);
  const playerX = spec.playerX ?? 3;
  grid.put(playerX, GROUND_Y - 1, 'P');

  for (const [x, w] of spec.pits ?? []) {
    grid.pit(x, w);
  }
  for (const [x, w] of spec.lava ?? []) {
    grid.lava(x, w);
  }
  for (const [x, w, tilesHigh] of spec.hills ?? []) {
    grid.hill(x, w, tilesHigh);
  }
  for (const [x, tilesHigh] of spec.walls ?? []) {
    grid.wall(x, tilesHigh);
  }
  for (const stair of spec.stairs ?? []) {
    grid.stairs(stair[0], stair[1], stair[2] ?? 1);
  }
  for (const [x, tilesUp, w] of spec.solids ?? []) {
    grid.plat(x, rowAboveGround(tilesUp), w, false);
  }
  for (const [x, tilesUp, w] of spec.plats ?? []) {
    grid.plat(x, rowAboveGround(tilesUp), w, true);
  }
  for (const x of spec.enemies ?? []) {
    grid.put(x, GROUND_Y - 1, 'e');
  }
  for (const [x, tilesUp] of spec.airEnemies ?? []) {
    grid.put(x, rowAboveGround(tilesUp) - 1, 'e');
  }
  const fightX = spec.boss ?? spec.mini;
  if (fightX !== undefined) {
    stampArena(grid, fightX, theme, spec.boss !== undefined);
  }
  if (spec.mini !== undefined) {
    grid.put(spec.mini, GROUND_Y - 1, 'm');
  }
  if (spec.boss !== undefined) {
    grid.put(spec.boss, GROUND_Y - 1, 'B');
  }
  return grid.lines();
}

function occupy(blocked: Set<number>, x: number, radius: number): void {
  for (let i = x - radius; i <= x + radius; i += 1) {
    blocked.add(i);
  }
}

function isSolidPuzzle(kind: PuzzleKind): boolean {
  switch (kind) {
    case 'ice-wall':
    case 'sand-wall':
    case 'shadow-wall':
      return true;
    case 'vine-bed':
    case 'down-current':
      return false;
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

function safeFloorX(rows: string[], desired: number, blocked: ReadonlySet<number> = new Set()): number {
  const width = rows[0]?.length ?? 1;
  const find = (respectBlocked: boolean): number | undefined => {
    for (let radius = 0; radius < width; radius += 1) {
      const candidates = radius === 0 ? [desired] : [desired - radius, desired + radius];
      for (const candidate of candidates) {
        if (candidate < 2 || candidate >= width - 2) {
          continue;
        }
        if (respectBlocked && blocked.has(candidate)) {
          continue;
        }
        const ground = rows[GROUND_Y]?.[candidate];
        const above = rows[GROUND_Y - 1]?.[candidate];
        if ((ground === '#' || ground === '@' || ground === 'G' || ground === 'W') && above === '.') {
          return candidate;
        }
      }
    }
    return undefined;
  };
  return find(true) ?? find(false) ?? 3;
}

function assignEnemyKinds(world: number, stage: number, count: number): EnemyKind[] {
  const [movement, ranged, terrain] = enemiesForWorld(world);
  const available =
    stage === 1 ? [movement] : stage === 2 ? [movement, ranged] : [movement, ranged, terrain];
  return Array.from({ length: count }, (_, index) => available[index % available.length] ?? movement);
}

export function compileCourse(world: number, stage: number, spec: CourseSpec, theme: Theme): CompiledCourse {
  const groundEnemyX = spec.enemies ?? [];
  const airEnemyPositions = spec.airEnemies ?? [];
  const rows = buildCourse({ ...spec, enemies: [], airEnemies: [] }, theme);
  const rawSpawns = [
    ...groundEnemyX.map((x) => ({ x, tilesUp: 0 })),
    ...airEnemyPositions.map(([x, tilesUp]) => ({ x, tilesUp })),
  ];
  const kinds = assignEnemyKinds(world, stage, rawSpawns.length);
  const enemies = rawSpawns.map((spawn, index) => ({
    ...spawn,
    kind: kinds[index] ?? enemiesForWorld(world)[0],
  }));
  const blocked = new Set<number>();
  occupy(blocked, spec.playerX ?? 3, 3);
  for (const x of groundEnemyX) {
    occupy(blocked, x, 2);
  }
  const checkpointX = safeFloorX(rows, Math.floor(spec.width * 0.5), blocked);
  const featureBlocked = new Set(blocked);
  occupy(featureBlocked, checkpointX, 1);
  const collectibleA = safeFloorX(rows, Math.floor(spec.width * 0.23), featureBlocked);
  occupy(featureBlocked, collectibleA, 1);
  const collectibleB = safeFloorX(rows, Math.floor(spec.width * 0.51), featureBlocked);
  occupy(featureBlocked, collectibleB, 1);
  const collectibleC = safeFloorX(rows, Math.floor(spec.width * 0.76), featureBlocked);
  occupy(featureBlocked, collectibleC, 1);
  const shieldX = safeFloorX(rows, Math.floor(spec.width * 0.68), featureBlocked);
  occupy(featureBlocked, shieldX, 1);
  const anchorCount = Math.min(4, Math.max(2, stage));
  const specialAnchors = Array.from({ length: anchorCount }, (_, index) => {
    const x = safeFloorX(rows, Math.floor(spec.width * ((index + 1) / (anchorCount + 1))), featureBlocked);
    occupy(featureBlocked, x, 1);
    return { x, tilesUp: index % 2 === 0 ? 0 : 2 };
  });
  const puzzleKind: PuzzleKind =
    world === 1
      ? 'vine-bed'
      : world === 2
        ? 'ice-wall'
        : world === 3
          ? 'sand-wall'
          : world === 4
            ? 'down-current'
            : 'shadow-wall';
  const puzzleBlocked = new Set(blocked);
  if (isSolidPuzzle(puzzleKind)) {
    occupy(puzzleBlocked, checkpointX, 1);
  }
  const puzzleCount = stage === 4 ? 1 : stage;
  const puzzles = Array.from({ length: puzzleCount }, (_, index) => {
    const x = safeFloorX(
      rows,
      Math.floor(spec.width * ((index + 1) / (puzzleCount + 1))),
      puzzleBlocked,
    );
    occupy(puzzleBlocked, x, 1);
    return { x, kind: puzzleKind, height: Math.min(4, 1 + stage) };
  });
  return {
    rows,
    enemies,
    checkpoint: { x: checkpointX, tilesUp: 0 },
    collectibles: [
      { x: collectibleA, tilesUp: 2 },
      { x: collectibleB, tilesUp: stage >= 2 ? 3 : 2 },
      { x: collectibleC, tilesUp: stage >= 3 ? 4 : 2 },
    ],
    shield: { x: shieldX, tilesUp: 1 },
    special: specialForTheme(theme),
    specialAnchors,
    puzzles,
    miniVariant: stage < 4 ? (stage as MiniBossVariant) : undefined,
  };
}
