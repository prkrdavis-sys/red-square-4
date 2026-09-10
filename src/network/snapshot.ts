export interface PredictedState {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
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
