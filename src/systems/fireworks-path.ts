import { GAME_HEIGHT, GAME_WIDTH } from '../config';

export type FireworkSide = -1 | 1;

export const FIREWORK_SIDES: readonly FireworkSide[] = [-1, 1];
export const FIREWORK_FLIGHT_MS = 680;
export const FIREWORK_ARC_WIDTH = 112;
export const FIREWORK_ARC_HEIGHT = 168;
export const FIREWORK_ARC_PEAK = 56;
export const VICTORY_FIREWORK_COUNT = 6;
export const VICTORY_FLIGHT_MS = 780;
export const LEVEL_CLEAR_MENU_DELAY_MS = 2500;

export interface FireworkArc {
  width: number;
  height: number;
  peak: number;
}

export const CHECKPOINT_FIREWORK_ARC: FireworkArc = {
  width: FIREWORK_ARC_WIDTH,
  height: FIREWORK_ARC_HEIGHT,
  peak: FIREWORK_ARC_PEAK,
};

export interface VictoryLaunch {
  x: number;
  y: number;
  side: FireworkSide;
  arc: FireworkArc;
  delayMs: number;
}

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

function controlPoint(
  startX: number,
  startY: number,
  side: FireworkSide,
  arc: FireworkArc,
): { x: number; y: number } {
  return {
    x: startX + side * arc.width * 0.32,
    y: startY - arc.height - arc.peak,
  };
}

function endPoint(
  startX: number,
  startY: number,
  side: FireworkSide,
  arc: FireworkArc,
): { x: number; y: number } {
  return {
    x: startX + side * arc.width,
    y: startY - arc.height,
  };
}

/** Evenly spaced rockets that start just below the visible screen. */
export function victoryLaunch(index: number): VictoryLaunch {
  const slots = [0.1, 0.26, 0.4, 0.6, 0.74, 0.9];
  const t = slots[index] ?? 0.5;
  const side: FireworkSide = index % 2 === 0 ? -1 : 1;
  return {
    x: GAME_WIDTH * t,
    y: GAME_HEIGHT + 10,
    side,
    delayMs: (index % 3) * 140,
    arc: {
      width: 64 + (index % 3) * 36,
      height: 420 + (index % 3) * 48,
      peak: 48 + (index % 2) * 20,
    },
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
  arc: FireworkArc = CHECKPOINT_FIREWORK_ARC,
): { x: number; y: number } {
  const tt = clamp01(t);
  const end = endPoint(startX, startY, side, arc);
  const mid = controlPoint(startX, startY, side, arc);
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
  arc: FireworkArc = CHECKPOINT_FIREWORK_ARC,
): { x: number; y: number } {
  const tt = clamp01(t);
  const end = endPoint(startX, startY, side, arc);
  const mid = controlPoint(startX, startY, side, arc);
  return {
    x: 2 * (1 - tt) * (mid.x - startX) + 2 * tt * (end.x - mid.x),
    y: 2 * (1 - tt) * (mid.y - startY) + 2 * tt * (end.y - mid.y),
  };
}
