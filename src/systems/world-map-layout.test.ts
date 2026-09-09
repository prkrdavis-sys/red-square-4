import { describe, expect, it } from 'vitest';
import { campaignPathPairs, mapNodePosition, mapNodePositionForId } from './world-map-layout';

describe('world map secret branch', () => {
  it('places W-? under stage 3 of the same world', () => {
    const stageThree = mapNodePosition(5, 3);
    const secret = mapNodePositionForId('5-?');
    expect(secret.x).toBe(stageThree.x);
    expect(secret.y).toBeGreaterThan(stageThree.y);
  });

  it('keeps campaign path 1-3 to 1-4 instead of 1-?', () => {
    expect(campaignPathPairs()).toContainEqual(['1-3', '1-4']);
    expect(campaignPathPairs()).not.toContainEqual(['1-3', '1-?']);
  });
});
