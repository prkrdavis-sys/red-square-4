import { TILE } from '../config';

export const ONEWAY_HEIGHT = 18;

const SOLID_CELLS = new Set(['#', '@', 'G', 'W', 'b']);

export function isSolidCell(cell: string | undefined): boolean {
  return SOLID_CELLS.has(cell ?? '');
}

/** Breakable blocks block movement but each needs its own body so one can be destroyed. */
export function isBrickCell(cell: string | undefined): boolean {
  return cell === 'b';
}

/** True when the tile's top face is open to air, so it should keep a grass/snow cap. */
export function isExposedTileTop(rows: readonly string[], x: number, y: number): boolean {
  if (y <= 0) {
    return true;
  }
  return !isSolidCell(rows[y - 1]?.[x]);
}

export interface ColliderRun {
  tileX: number;
  tileY: number;
  tilesWide: number;
  kind: 'solid' | 'oneway';
}

export interface ColliderBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Lift a body so its feet sit on the floor instead of sinking through it. */
export function liftOntoFloor(bodyBottom: number, floorY: number): number {
  return bodyBottom > floorY ? bodyBottom - floorY : 0;
}

export function enableOneWayCollision(body: {
  checkCollision: { up: boolean; down: boolean; left: boolean; right: boolean };
}): void {
  body.checkCollision.up = true;
  body.checkCollision.down = false;
  body.checkCollision.left = false;
  body.checkCollision.right = false;
}

/**
 * Merge consecutive floor/wall/platform tiles in a row into one collider.
 * Arcade physics ejects large bodies through seams between 64px tiles.
 */
export function colliderRuns(rows: string[]): ColliderRun[] {
  const runs: ColliderRun[] = [];
  for (let y = 0; y < rows.length; y += 1) {
    const row = rows[y] ?? '';
    let x = 0;
    while (x < row.length) {
      const kind = cellKind(row[x] ?? '.');
      if (!kind) {
        x += 1;
        continue;
      }
      let width = 1;
      while (x + width < row.length && cellKind(row[x + width] ?? '.') === kind) {
        width += 1;
      }
      runs.push({ tileX: x, tileY: y, tilesWide: width, kind });
      x += width;
    }
  }
  return runs;
}

export function colliderBox(run: ColliderRun): ColliderBox {
  return {
    x: run.tileX * TILE,
    y: run.tileY * TILE,
    width: run.tilesWide * TILE,
    height: run.kind === 'oneway' ? ONEWAY_HEIGHT : TILE,
  };
}

function cellKind(cell: string): ColliderRun['kind'] | undefined {
  if (isBrickCell(cell)) {
    return undefined;
  }
  if (isSolidCell(cell)) {
    return 'solid';
  }
  if (cell === '=') {
    return 'oneway';
  }
  return undefined;
}
