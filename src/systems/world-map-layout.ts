import { CAMPAIGN_LEVEL_IDS, GAME_HEIGHT, GAME_WIDTH, THEMES, parseLevelId, type LevelId } from '../config';

export const MAP_SECRET_NODE_Y = 530;
export const MAP_SECRET_STUB_LENGTH = 46;

export function worldBandWidth(): number {
  return GAME_WIDTH / THEMES.length;
}

export function mapNodePosition(world: number, stage: number, secret = false): { x: number; y: number } {
  const band = worldBandWidth();
  const origin = (world - 1) * band;
  const col = stage === 1 || stage === 4 ? 0 : 1;
  const row = stage <= 2 ? 0 : 1;
  const x = origin + band * 0.32 + col * band * 0.42;
  if (secret) {
    return { x: origin + band * 0.32 + 1 * band * 0.42, y: MAP_SECRET_NODE_Y };
  }
  return {
    x,
    y: 236 + row * 148,
  };
}

export function mapNodePositionForId(id: LevelId): { x: number; y: number } {
  const parsed = parseLevelId(id);
  return mapNodePosition(parsed.world, parsed.secret ? 3 : parsed.stage, parsed.secret);
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

export function mapFooterTop(): number {
  return GAME_HEIGHT - 120;
}
