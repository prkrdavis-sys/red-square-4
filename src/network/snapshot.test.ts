import { describe, expect, it } from 'vitest';
import {
  insertSnapshot,
  interpolateSnapshots,
  reconcilePrediction,
  smoothPredictionCorrection,
  type SnapshotSample,
} from './snapshot';
import type { InputFrame, PlayerId, WirePlayerState } from './protocol';

function player(id: PlayerId, x: number, acknowledgedInput = 0): WirePlayerState {
  return {
    id,
    x,
    y: x * 2,
    velocityX: x,
    velocityY: -x,
    alive: true,
    animation: x < 10 ? 'idle' : 'run',
    acknowledgedInput,
  };
}

function sample(tick: number, serverTime: number, x: number): SnapshotSample {
  return {
    tick,
    serverTime,
    players: [player('host', x), player('guest', x + 5)],
  };
}

describe('snapshot interpolation', () => {
  it('orders, deduplicates, and caps snapshot buffers', () => {
    let samples: readonly SnapshotSample[] = [];
    samples = insertSnapshot(samples, sample(2, 200, 20), 2);
    samples = insertSnapshot(samples, sample(1, 100, 10), 2);
    samples = insertSnapshot(samples, sample(2, 200, 25), 2);
    samples = insertSnapshot(samples, sample(3, 300, 30), 2);
    expect(samples.map(({ tick }) => tick)).toEqual([2, 3]);
    expect(samples[0]?.players[0].x).toBe(25);
  });

  it('interpolates both players at render time', () => {
    const result = interpolateSnapshots([sample(1, 100, 10), sample(2, 200, 30)], 150);
    expect(result?.alpha).toBe(0.5);
    expect(result?.players[0].x).toBe(20);
    expect(result?.players[1].y).toBe(50);
    expect(result?.players[0].animation).toBe('run');
  });

  it('holds the edge snapshots instead of extrapolating', () => {
    const samples = [sample(1, 100, 10), sample(2, 200, 30)];
    expect(interpolateSnapshots(samples, 50)?.players[0].x).toBe(10);
    expect(interpolateSnapshots(samples, 250)?.players[0].x).toBe(30);
    expect(interpolateSnapshots([], 100)).toBeNull();
  });
});

describe('client reconciliation', () => {
  const inputs: readonly InputFrame[] = [
    { sequence: 3, clientTime: 30, moveX: 1, jump: false, special: false },
    { sequence: 1, clientTime: 10, moveX: 1, jump: false, special: false },
    { sequence: 2, clientTime: 20, moveX: -1, jump: false, special: false },
  ];

  it('drops acknowledged inputs and replays remaining input in sequence order', () => {
    const result = reconcilePrediction({ x: 100 }, 1, inputs, (state, input) => ({
      x: state.x + input.moveX * 10,
    }));
    expect(result.state).toEqual({ x: 100 });
    expect(result.pendingInputs.map(({ sequence }) => sequence)).toEqual([2, 3]);
    expect(result.replayedInputCount).toBe(2);
  });

  it('smooths small corrections and snaps large divergence', () => {
    const predicted = { x: 0, y: 0, velocityX: 2, velocityY: 0 };
    const nearby = { x: 4, y: 0, velocityX: 4, velocityY: 0 };
    expect(smoothPredictionCorrection(predicted, nearby, 0.25, 10)).toEqual({
      x: 1,
      y: 0,
      velocityX: 2.5,
      velocityY: 0,
    });
    const far = { x: 20, y: 0, velocityX: 0, velocityY: 0 };
    expect(smoothPredictionCorrection(predicted, far, 0.25, 10)).toEqual(far);
  });
});
