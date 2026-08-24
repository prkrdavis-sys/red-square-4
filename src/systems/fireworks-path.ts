export type FireworkSide = -1 | 1;

export const FIREWORK_SIDES: readonly FireworkSide[] = [-1, 1];
export const FIREWORK_FLIGHT_MS = 680;
export const FIREWORK_ARC_WIDTH = 112;
export const FIREWORK_ARC_HEIGHT = 168;
export const FIREWORK_ARC_PEAK = 56;

export interface FlagSprite {
  x: number;
  y: number;
  displayWidth: number;
  displayHeight: number;
  originX: number;
  originY: number;
}

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

function controlPoint(startX: number, startY: number, side: FireworkSide): { x: number; y: number } {
  return {
    x: startX + side * FIREWORK_ARC_WIDTH * 0.32,
    y: startY - FIREWORK_ARC_HEIGHT - FIREWORK_ARC_PEAK,
  };
}

function endPoint(startX: number, startY: number, side: FireworkSide): { x: number; y: number } {
  return {
    x: startX + side * FIREWORK_ARC_WIDTH,
    y: startY - FIREWORK_ARC_HEIGHT,
  };
}

/** Launch from the gold cloth, not the pole base. */
export function checkpointFlagLaunch(flag: FlagSprite): { x: number; y: number } {
  const left = flag.x - flag.displayWidth * flag.originX;
  const top = flag.y - flag.displayHeight * flag.originY;
  return {
    x: left + flag.displayWidth * 0.62,
    y: top + flag.displayHeight * 0.16,
  };
}

export function fireworkArcPoint(
  startX: number,
  startY: number,
  side: FireworkSide,
  t: number,
): { x: number; y: number } {
  const tt = clamp01(t);
  const end = endPoint(startX, startY, side);
  const mid = controlPoint(startX, startY, side);
  const u = 1 - tt;
  return {
    x: u * u * startX + 2 * u * tt * mid.x + tt * tt * end.x,
    y: u * u * startY + 2 * u * tt * mid.y + tt * tt * end.y,
  };
}

export function fireworkArcTangent(
  startX: number,
  startY: number,
  side: FireworkSide,
  t: number,
): { x: number; y: number } {
  const tt = clamp01(t);
  const end = endPoint(startX, startY, side);
  const mid = controlPoint(startX, startY, side);
  return {
    x: 2 * (1 - tt) * (mid.x - startX) + 2 * tt * (end.x - mid.x),
    y: 2 * (1 - tt) * (mid.y - startY) + 2 * tt * (end.y - mid.y),
  };
}
