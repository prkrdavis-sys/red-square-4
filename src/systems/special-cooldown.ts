export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

export function specialChargeRatio(cooldownRatio: number): number {
  return clamp01(1 - cooldownRatio);
}

export function specialMeterFillWidth(charge: number, barWidth: number): number {
  return clamp01(charge) * barWidth;
}
