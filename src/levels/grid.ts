import { GROUND_Y, JUMP_REACH_TILES, MAP_ROWS } from '../config';

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

  plat(x: number, y: number, w: number, oneWay = true): void {
    const tile = oneWay ? '=' : '#';
    for (let i = 0; i < w; i += 1) {
      this.set(x + i, y, tile);
    }
  }

  stairs(x: number, steps: number, dir = 1): void {
    for (let i = 0; i < steps; i += 1) {
      const height = i + 1;
      for (let h = 0; h < height; h += 1) {
        this.set(x + i * dir, GROUND_Y - 1 - h, '#');
      }
    }
  }

  hill(x: number, w: number, tilesHigh: number): void {
    for (let i = 0; i < w; i += 1) {
      for (let t = 1; t <= tilesHigh; t += 1) {
        this.set(x + i, GROUND_Y - t, '#');
      }
    }
  }

  wall(x: number, tilesHigh: number): void {
    this.column(x, rowAboveGround(tilesHigh), GROUND_Y - 1);
  }

  column(x: number, fromY: number, toY: number): void {
    for (let y = fromY; y <= toY; y += 1) {
      this.set(x, y, '#');
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

export function buildCourse(spec: CourseSpec): string[] {
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
  if (spec.mini !== undefined) {
    grid.put(spec.mini, GROUND_Y - 1, 'm');
  }
  if (spec.boss !== undefined) {
    grid.put(spec.boss, GROUND_Y - 1, 'B');
  }
  return grid.lines();
}
