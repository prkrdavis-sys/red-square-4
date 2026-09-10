import {
  CAMPAIGN_LEVEL_IDS,
  GAME_HEIGHT,
  SECRET_LEVEL_IDS,
  THEMES,
  parseLevelId,
  secretLevelId,
  type CampaignLevelId,
  type LevelId,
  type Theme,
} from '../config';

export const MAP_WIDTH = 5200;
export const MAP_HEIGHT = 2600;
export const MAP_WALK_SPEED = 210;
export const MAP_NODE_RADIUS = 36;
export const MAP_DOCK_RADIUS = 46;
export const MAP_SECRET_STUB_LENGTH = 78;
export const MAP_TOKEN_CLEARANCE = 10;

export interface MapPoint {
  x: number;
  y: number;
}

export type DockKind = 'arrival' | 'departure';

export interface DockDef {
  world: number;
  kind: DockKind;
  x: number;
  y: number;
}

export interface IslandDef {
  world: number;
  theme: Theme;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  nodes: { 1: MapPoint; 2: MapPoint; 3: MapPoint; 4: MapPoint };
  secret?: MapPoint;
  arrival?: MapPoint;
  departure?: MapPoint;
}

interface IslandDraft {
  world: number;
  theme: Theme;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  arrival?: 'west' | 'north';
  departure?: 'east' | 'south';
  layout: 'trail' | 'keep';
  secret: boolean;
}

function add(cx: number, cy: number, local: MapPoint): MapPoint {
  return { x: cx + local.x, y: cy + local.y };
}

function dockLocal(rx: number, ry: number, dir: 'west' | 'east' | 'north' | 'south'): MapPoint {
  switch (dir) {
    case 'west':
      return { x: -rx * 0.96, y: 18 };
    case 'east':
      return { x: rx * 0.96, y: 18 };
    case 'north':
      return { x: 8, y: -ry * 0.96 };
    case 'south':
      return { x: 12, y: ry * 0.96 };
    default: {
      const neverDir: never = dir;
      return neverDir;
    }
  }
}

function trailLocals(rx: number, ry: number): {
  n1: MapPoint;
  n2: MapPoint;
  n3: MapPoint;
  n4: MapPoint;
  secret: MapPoint;
} {
  return {
    n1: { x: -rx * 0.5, y: ry * 0.24 },
    n2: { x: -rx * 0.08, y: -ry * 0.42 },
    n3: { x: rx * 0.32, y: -ry * 0.46 },
    n4: { x: rx * 0.52, y: ry * 0.22 },
    secret: { x: rx * 0.68, y: -ry * 0.18 },
  };
}

function keepLocals(rx: number, ry: number): {
  n1: MapPoint;
  n2: MapPoint;
  n3: MapPoint;
  n4: MapPoint;
  secret: MapPoint;
} {
  return {
    n1: { x: rx * 0.04, y: -ry * 0.55 },
    n2: { x: -rx * 0.4, y: ry * 0.06 },
    n3: { x: rx * 0.16, y: ry * 0.28 },
    n4: { x: rx * 0.52, y: ry * 0.2 },
    secret: { x: rx * 0.62, y: ry * 0.02 },
  };
}

function buildIsland(draft: IslandDraft): IslandDef {
  const locals = draft.layout === 'keep' ? keepLocals(draft.rx, draft.ry) : trailLocals(draft.rx, draft.ry);
  return {
    world: draft.world,
    theme: draft.theme,
    cx: draft.cx,
    cy: draft.cy,
    rx: draft.rx,
    ry: draft.ry,
    nodes: {
      1: add(draft.cx, draft.cy, locals.n1),
      2: add(draft.cx, draft.cy, locals.n2),
      3: add(draft.cx, draft.cy, locals.n3),
      4: add(draft.cx, draft.cy, locals.n4),
    },
    secret: draft.secret ? add(draft.cx, draft.cy, locals.secret) : undefined,
    arrival: draft.arrival ? add(draft.cx, draft.cy, dockLocal(draft.rx, draft.ry, draft.arrival)) : undefined,
    departure: draft.departure ? add(draft.cx, draft.cy, dockLocal(draft.rx, draft.ry, draft.departure)) : undefined,
  };
}

const DRAFTS: IslandDraft[] = [
  {
    world: 1,
    theme: 'grass',
    cx: 780,
    cy: 760,
    rx: 430,
    ry: 320,
    departure: 'east',
    layout: 'trail',
    secret: true,
  },
  {
    world: 2,
    theme: 'snow',
    cx: 1960,
    cy: 700,
    rx: 420,
    ry: 360,
    arrival: 'west',
    departure: 'east',
    layout: 'trail',
    secret: true,
  },
  {
    world: 3,
    theme: 'desert',
    cx: 3140,
    cy: 780,
    rx: 450,
    ry: 310,
    arrival: 'west',
    departure: 'east',
    layout: 'trail',
    secret: true,
  },
  {
    world: 4,
    theme: 'ocean',
    cx: 4320,
    cy: 720,
    rx: 430,
    ry: 340,
    arrival: 'west',
    departure: 'south',
    layout: 'trail',
    secret: true,
  },
  {
    world: 5,
    theme: 'castle',
    cx: 780,
    cy: 1880,
    rx: 400,
    ry: 350,
    arrival: 'north',
    departure: 'east',
    layout: 'keep',
    secret: true,
  },
  {
    world: 6,
    theme: 'rainforest',
    cx: 1960,
    cy: 1940,
    rx: 440,
    ry: 340,
    arrival: 'west',
    departure: 'east',
    layout: 'trail',
    secret: true,
  },
  {
    world: 7,
    theme: 'beach',
    cx: 3140,
    cy: 1880,
    rx: 450,
    ry: 300,
    arrival: 'west',
    departure: 'east',
    layout: 'trail',
    secret: false,
  },
  {
    world: 8,
    theme: 'rainy-city',
    cx: 4320,
    cy: 1940,
    rx: 420,
    ry: 340,
    arrival: 'west',
    departure: undefined,
    layout: 'trail',
    secret: false,
  },
];

export const MAP_ISLANDS: IslandDef[] = DRAFTS.map(buildIsland);

export function mapFooterTop(): number {
  return GAME_HEIGHT - 120;
}

export function islandForWorld(world: number): IslandDef | undefined {
  return MAP_ISLANDS[world - 1];
}

export function inEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

function inCircle(x: number, y: number, point: MapPoint, radius: number): boolean {
  return (x - point.x) * (x - point.x) + (y - point.y) * (y - point.y) <= radius * radius;
}

export function islandDocks(island: IslandDef): DockDef[] {
  const docks: DockDef[] = [];
  if (island.arrival) {
    docks.push({ world: island.world, kind: 'arrival', x: island.arrival.x, y: island.arrival.y });
  }
  if (island.departure) {
    docks.push({ world: island.world, kind: 'departure', x: island.departure.x, y: island.departure.y });
  }
  return docks;
}

export function allDocks(): DockDef[] {
  return MAP_ISLANDS.flatMap(islandDocks);
}

export function islandAt(x: number, y: number): IslandDef | undefined {
  for (const island of MAP_ISLANDS) {
    if (inEllipse(x, y, island.cx, island.cy, island.rx, island.ry)) {
      return island;
    }
    for (const dock of islandDocks(island)) {
      if (inCircle(x, y, dock, MAP_DOCK_RADIUS)) {
        return island;
      }
    }
  }
  return undefined;
}

export function walkable(x: number, y: number): boolean {
  if (x < MAP_TOKEN_CLEARANCE || y < MAP_TOKEN_CLEARANCE || x > MAP_WIDTH - MAP_TOKEN_CLEARANCE || y > MAP_HEIGHT - MAP_TOKEN_CLEARANCE) {
    return false;
  }
  return islandAt(x, y) !== undefined;
}

export function mapNodePosition(world: number, stage: number, secret = false): MapPoint {
  const island = islandForWorld(world);
  if (!island) {
    return { x: 0, y: 0 };
  }
  if (secret) {
    return island.secret ?? island.nodes[3];
  }
  if (stage === 1 || stage === 2 || stage === 3 || stage === 4) {
    return island.nodes[stage];
  }
  return island.nodes[1];
}

export function mapNodePositionForId(id: LevelId): MapPoint {
  const parsed = parseLevelId(id);
  return mapNodePosition(parsed.world, parsed.secret ? 3 : parsed.stage, parsed.secret);
}

export function nearbyNode(x: number, y: number, ids: readonly LevelId[]): LevelId | undefined {
  let best: LevelId | undefined;
  let bestDist = MAP_NODE_RADIUS;
  for (const id of ids) {
    const pos = mapNodePositionForId(id);
    const dist = Math.hypot(pos.x - x, pos.y - y);
    if (dist <= bestDist) {
      best = id;
      bestDist = dist;
    }
  }
  return best;
}

export function dockAt(x: number, y: number): DockDef | undefined {
  let best: DockDef | undefined;
  let bestDist = MAP_DOCK_RADIUS;
  for (const dock of allDocks()) {
    const dist = Math.hypot(dock.x - x, dock.y - y);
    if (dist <= bestDist) {
      best = dock;
      bestDist = dist;
    }
  }
  return best;
}

export function linkedDock(dock: DockDef): DockDef | undefined {
  if (dock.kind === 'departure') {
    const next = islandForWorld(dock.world + 1);
    if (!next?.arrival) {
      return undefined;
    }
    return { world: next.world, kind: 'arrival', x: next.arrival.x, y: next.arrival.y };
  }
  const prev = islandForWorld(dock.world - 1);
  if (!prev?.departure) {
    return undefined;
  }
  return { world: prev.world, kind: 'departure', x: prev.departure.x, y: prev.departure.y };
}

export function boatWorldPairs(): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  for (let world = 1; world < THEMES.length; world += 1) {
    pairs.push([world, world + 1]);
  }
  return pairs;
}

export function boatRoutes(): Array<{ from: DockDef; to: DockDef }> {
  return boatWorldPairs().flatMap(([fromWorld, toWorld]) => {
    const fromIsland = islandForWorld(fromWorld);
    const toIsland = islandForWorld(toWorld);
    if (!fromIsland?.departure || !toIsland?.arrival) {
      return [];
    }
    return [
      {
        from: { world: fromWorld, kind: 'departure' as const, x: fromIsland.departure.x, y: fromIsland.departure.y },
        to: { world: toWorld, kind: 'arrival' as const, x: toIsland.arrival.x, y: toIsland.arrival.y },
      },
    ];
  });
}

export function ferryControl(from: MapPoint, to: MapPoint): MapPoint {
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const mapCx = MAP_WIDTH / 2;
  const mapCy = MAP_HEIGHT / 2;
  const towardCenter = nx * (mapCx - mid.x) + ny * (mapCy - mid.y) >= 0 ? 1 : -1;
  const bow = Math.min(260, Math.max(120, len * 0.18));
  return { x: mid.x + nx * bow * towardCenter, y: mid.y + ny * bow * towardCenter };
}

export function quadBezier(from: MapPoint, control: MapPoint, to: MapPoint, t: number): MapPoint {
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
  };
}

export function islandPathPairs(): Array<[CampaignLevelId, CampaignLevelId]> {
  const pairs: Array<[CampaignLevelId, CampaignLevelId]> = [];
  for (let world = 1; world <= THEMES.length; world += 1) {
    pairs.push([`${world}-1` as CampaignLevelId, `${world}-2` as CampaignLevelId]);
    pairs.push([`${world}-2` as CampaignLevelId, `${world}-3` as CampaignLevelId]);
    pairs.push([`${world}-3` as CampaignLevelId, `${world}-4` as CampaignLevelId]);
  }
  return pairs;
}

export function campaignPathPairs(): Array<[LevelId, LevelId]> {
  const pairs: Array<[LevelId, LevelId]> = [];
  for (let i = 0; i < CAMPAIGN_LEVEL_IDS.length - 1; i += 1) {
    const from = CAMPAIGN_LEVEL_IDS[i];
    const to = CAMPAIGN_LEVEL_IDS[i + 1];
    if (from && to) {
      pairs.push([from, to]);
    }
  }
  return pairs;
}

export function secretStubEnd(world: number): MapPoint | undefined {
  const island = islandForWorld(world);
  if (!island?.secret) {
    return undefined;
  }
  const from = island.nodes[3];
  const dx = island.secret.x - from.x;
  const dy = island.secret.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const reach = Math.min(MAP_SECRET_STUB_LENGTH, len * 0.42);
  return { x: from.x + (dx / len) * reach, y: from.y + (dy / len) * reach };
}

export function isIslandFogged(world: number, cleared: readonly LevelId[]): boolean {
  if (world <= 1) {
    return false;
  }
  return !cleared.includes(`${world - 1}-4` as CampaignLevelId);
}

export function hasSecretCourse(world: number): boolean {
  return SECRET_LEVEL_IDS.some((id) => parseLevelId(id).world === world);
}

export function secretCourseOf(world: number): LevelId | undefined {
  if (!hasSecretCourse(world)) {
    return undefined;
  }
  return secretLevelId(world);
}
