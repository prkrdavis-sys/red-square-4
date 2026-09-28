import { describe, expect, it } from 'vitest';
import {
  BACKROOMS_HOST_LEVEL,
  BACKROOMS_LEVEL_ID,
  CAMPAIGN_LEVEL_IDS,
  SECRET_LEVEL_IDS,
  THEMES,
  parseLevelId,
} from '../config';
import {
  MAP_ISLANDS,
  MAP_NODE_BACKROOMS_KEY,
  MAP_NODE_RADIUS,
  backroomsNodePosition,
  boatWorldPairs,
  campaignPathPairs,
  islandPathPairs,
  isIslandFogged,
  linkedDock,
  mapNodePosition,
  mapNodePositionForId,
  mapNodeTextureKey,
  nearbyNode,
  secretStubEnd,
  walkable,
} from './world-map-layout';

describe('world map overworld', () => {
  it('places each secret as a spur off that world’s stage 3 on the same island', () => {
    for (const id of SECRET_LEVEL_IDS) {
      const parsed = parseLevelId(id);
      const stageThree = mapNodePosition(parsed.world, 3);
      const secret = mapNodePositionForId(id);
      expect(walkable(stageThree.x, stageThree.y)).toBe(true);
      expect(walkable(secret.x, secret.y)).toBe(true);
      expect(Math.hypot(secret.x - stageThree.x, secret.y - stageThree.y)).toBeGreaterThan(80);
      const stub = secretStubEnd(parsed.world);
      expect(stub).toBeDefined();
      if (stub) {
        expect(Math.hypot(stub.x - stageThree.x, stub.y - stageThree.y)).toBeLessThan(
          Math.hypot(secret.x - stageThree.x, secret.y - stageThree.y),
        );
      }
    }
  });

  it('keeps campaign path 1-3 to 1-4 instead of 1-?', () => {
    expect(campaignPathPairs()).toContainEqual(['1-3', '1-4']);
    expect(campaignPathPairs()).not.toContainEqual(['1-3', '1-?']);
    expect(islandPathPairs()).toContainEqual(['1-3', '1-4']);
    expect(islandPathPairs()).not.toContainEqual(['1-4', '2-1']);
  });

  it('keeps every campaign node and dock on land', () => {
    for (const id of CAMPAIGN_LEVEL_IDS) {
      const pos = mapNodePositionForId(id);
      expect(walkable(pos.x, pos.y), id).toBe(true);
    }
    for (const island of MAP_ISLANDS) {
      if (island.arrival) {
        expect(walkable(island.arrival.x, island.arrival.y), `arrival ${island.world}`).toBe(true);
      }
      if (island.departure) {
        expect(walkable(island.departure.x, island.departure.y), `departure ${island.world}`).toBe(true);
      }
    }
  });

  it('chains boats from world 1 through world 8', () => {
    expect(boatWorldPairs()).toEqual([
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 8],
    ]);
    for (const island of MAP_ISLANDS) {
      if (island.world === 1) {
        expect(island.arrival).toBeUndefined();
        expect(island.departure).toBeDefined();
      } else if (island.world === THEMES.length) {
        expect(island.arrival).toBeDefined();
        expect(island.departure).toBeUndefined();
      } else {
        expect(island.arrival).toBeDefined();
        expect(island.departure).toBeDefined();
      }
    }
    for (const island of MAP_ISLANDS) {
      if (!island.departure) {
        continue;
      }
      const dest = linkedDock({
        world: island.world,
        kind: 'departure',
        x: island.departure.x,
        y: island.departure.y,
      });
      expect(dest?.world).toBe(island.world + 1);
      expect(dest?.kind).toBe('arrival');
    }
  });

  it('treats land and docks as walkable and open water as not', () => {
    const meadow = MAP_ISLANDS[0];
    expect(meadow).toBeDefined();
    if (!meadow) {
      return;
    }
    expect(walkable(meadow.cx, meadow.cy)).toBe(true);
    expect(walkable(80, 80)).toBe(false);
    expect(walkable(1375, meadow.cy)).toBe(false);
  });

  it('selects a nearby node within radius', () => {
    const pos = mapNodePositionForId('1-1');
    expect(nearbyNode(pos.x, pos.y, CAMPAIGN_LEVEL_IDS)).toBe('1-1');
    expect(nearbyNode(pos.x + 200, pos.y, CAMPAIGN_LEVEL_IDS)).toBeUndefined();
  });

  it('fogs later islands until the previous world boss is cleared', () => {
    expect(isIslandFogged(1, [])).toBe(false);
    expect(isIslandFogged(2, [])).toBe(true);
    expect(isIslandFogged(2, ['1-4'])).toBe(false);
  });

  it('uses a castle icon only for each world’s x-4 boss course', () => {
    for (const id of CAMPAIGN_LEVEL_IDS) {
      const parsed = parseLevelId(id);
      expect(mapNodeTextureKey(id, true)).toBe(parsed.stage === 4 ? 'map-node-castle' : 'map-node');
      expect(mapNodeTextureKey(id, false)).toBe(parsed.stage === 4 ? 'map-node-castle-locked' : 'map-node-locked');
    }
    for (const id of SECRET_LEVEL_IDS) {
      expect(mapNodeTextureKey(id, true)).toBe('map-node-secret');
      expect(mapNodeTextureKey(id, false)).toBe('map-node-secret');
    }
    expect(mapNodeTextureKey(BACKROOMS_LEVEL_ID, true)).toBe(MAP_NODE_BACKROOMS_KEY);
  });

  it('puts Level 0 on a spur off 1-2, clear of the 1-? spur and every other node', () => {
    const host = mapNodePositionForId(BACKROOMS_HOST_LEVEL);
    const node = mapNodePositionForId(BACKROOMS_LEVEL_ID);
    expect(node).toEqual(backroomsNodePosition());
    expect(walkable(node.x, node.y)).toBe(true);
    expect(Math.hypot(node.x - host.x, node.y - host.y)).toBeGreaterThan(80);
    for (const t of [0.25, 0.5, 0.75]) {
      expect(walkable(host.x + (node.x - host.x) * t, host.y + (node.y - host.y) * t)).toBe(true);
    }
    const others = [...CAMPAIGN_LEVEL_IDS, ...SECRET_LEVEL_IDS].map(mapNodePositionForId);
    for (const other of others) {
      expect(Math.hypot(node.x - other.x, node.y - other.y)).toBeGreaterThan(MAP_NODE_RADIUS * 2.5);
    }
    const secret = mapNodePositionForId('1-?');
    expect(Math.sign(node.x - host.x)).not.toBe(Math.sign(secret.x - host.x));
    expect(nearbyNode(node.x, node.y, [...CAMPAIGN_LEVEL_IDS, BACKROOMS_LEVEL_ID])).toBe(BACKROOMS_LEVEL_ID);
  });
});
