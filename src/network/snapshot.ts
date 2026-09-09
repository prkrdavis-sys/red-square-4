import type { InputFrame, PlayerId, WirePlayerState } from './protocol';

export interface SnapshotSample {
  serverTime: number;
  tick: number;
  players: readonly [WirePlayerState, WirePlayerState];
}

export interface InterpolatedSnapshot {
  serverTime: number;
  tick: number;
  players: readonly [WirePlayerState, WirePlayerState];
  fromTick: number;
  toTick: number;
  alpha: number;
}

export interface PredictedState {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
}

export interface ReconciliationResult<TState> {
  state: TState;
  pendingInputs: readonly InputFrame[];
  replayedInputCount: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function stateForPlayer(sample: SnapshotSample, id: PlayerId): WirePlayerState {
  const player = sample.players.find((candidate) => candidate.id === id);
  if (!player) {
    throw new Error(`Snapshot ${sample.tick} is missing player ${id}`);
  }
  return player;
}

function interpolatePlayer(
  from: WirePlayerState,
  to: WirePlayerState,
  alpha: number,
): WirePlayerState {
  const lerp = (start: number, end: number): number => start + (end - start) * alpha;
  return {
    id: from.id,
    x: lerp(from.x, to.x),
    y: lerp(from.y, to.y),
    velocityX: lerp(from.velocityX, to.velocityX),
    velocityY: lerp(from.velocityY, to.velocityY),
    alive: alpha < 1 ? from.alive : to.alive,
    animation: alpha < 0.5 ? from.animation : to.animation,
    acknowledgedInput: Math.max(from.acknowledgedInput, to.acknowledgedInput),
  };
}

export function insertSnapshot(
  samples: readonly SnapshotSample[],
  incoming: SnapshotSample,
  capacity = 32,
): readonly SnapshotSample[] {
  if (capacity <= 0) {
    return [];
  }
  const byTick = new Map(samples.map((sample) => [sample.tick, sample]));
  byTick.set(incoming.tick, incoming);
  return [...byTick.values()]
    .sort((left, right) => left.serverTime - right.serverTime || left.tick - right.tick)
    .slice(-capacity);
}

export function interpolateSnapshots(
  samples: readonly SnapshotSample[],
  renderTime: number,
): InterpolatedSnapshot | null {
  if (samples.length === 0 || !Number.isFinite(renderTime)) {
    return null;
  }
  const ordered = [...samples].sort(
    (left, right) => left.serverTime - right.serverTime || left.tick - right.tick,
  );
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  if (!first || !last) {
    return null;
  }
  const to = ordered.find((sample) => sample.serverTime >= renderTime) ?? last;
  const toIndex = ordered.indexOf(to);
  const from = ordered[Math.max(0, toIndex - 1)] ?? first;
  const duration = to.serverTime - from.serverTime;
  const alpha = duration <= 0 ? 0 : clamp01((renderTime - from.serverTime) / duration);
  const host = interpolatePlayer(stateForPlayer(from, 'host'), stateForPlayer(to, 'host'), alpha);
  const guest = interpolatePlayer(stateForPlayer(from, 'guest'), stateForPlayer(to, 'guest'), alpha);
  return {
    serverTime: renderTime,
    tick: alpha < 0.5 ? from.tick : to.tick,
    players: [host, guest],
    fromTick: from.tick,
    toTick: to.tick,
    alpha,
  };
}

export function reconcilePrediction<TState>(
  authoritativeState: TState,
  acknowledgedInput: number,
  inputs: readonly InputFrame[],
  applyInput: (state: TState, input: InputFrame) => TState,
): ReconciliationResult<TState> {
  const pendingInputs = inputs
    .filter((input) => input.sequence > acknowledgedInput)
    .sort((left, right) => left.sequence - right.sequence);
  const state = pendingInputs.reduce(applyInput, authoritativeState);
  return {
    state,
    pendingInputs,
    replayedInputCount: pendingInputs.length,
  };
}

export function smoothPredictionCorrection(
  predicted: PredictedState,
  reconciled: PredictedState,
  correctionRatio: number,
  snapDistance: number,
): PredictedState {
  const distance = Math.hypot(reconciled.x - predicted.x, reconciled.y - predicted.y);
  const alpha = distance >= snapDistance ? 1 : clamp01(correctionRatio);
  const lerp = (start: number, end: number): number => start + (end - start) * alpha;
  return {
    x: lerp(predicted.x, reconciled.x),
    y: lerp(predicted.y, reconciled.y),
    velocityX: lerp(predicted.velocityX, reconciled.velocityX),
    velocityY: lerp(predicted.velocityY, reconciled.velocityY),
  };
}
