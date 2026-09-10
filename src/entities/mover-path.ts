import { GROUND_Y, MOVER_HEIGHT, TILE } from '../config';
import type { MoverSpawn } from '../levels/grid';

/** How close the feet must be to the plate top to count as riding it. */
export const RIDE_TOLERANCE = 12;

export function moverHomeX(spec: MoverSpawn): number {
  return spec.x * TILE + (spec.w * TILE) / 2;
}

export function moverHomeY(spec: MoverSpawn): number {
  return (GROUND_Y - spec.tilesUp) * TILE - MOVER_HEIGHT / 2;
}

/** Signed distance from home along the plate's axis at `now`, in pixels. */
export function moverOffset(spec: MoverSpawn, now: number): number {
  const phase = (now / spec.periodMs + spec.phase) * Math.PI * 2;
  return Math.sin(phase) * ((spec.span * TILE) / 2);
}

export function moverPosition(spec: MoverSpawn, now: number): { x: number; y: number } {
  const offset = moverOffset(spec, now);
  return {
    x: spec.axis === 'x' ? moverHomeX(spec) + offset : moverHomeX(spec),
    y: spec.axis === 'y' ? moverHomeY(spec) + offset : moverHomeY(spec),
  };
}

/**
 * True when a rider's feet rest on the plate. Arcade physics will not carry a body
 * on a moving platform, so the scene uses this to move riders by hand.
 */
export function moverCarries(
  plate: { top: number; left: number; right: number },
  rider: { bottom: number; left: number; right: number; velocityY: number },
): boolean {
  if (rider.velocityY < -1) {
    return false;
  }
  if (rider.bottom < plate.top - RIDE_TOLERANCE || rider.bottom > plate.top + RIDE_TOLERANCE) {
    return false;
  }
  return rider.right > plate.left && rider.left < plate.right;
}
