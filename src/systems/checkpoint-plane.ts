/** Vertical gate at the flag X. Altitude is ignored. */

export function checkpointPlaneX(checkpoint: {
  x: number;
  getData: (key: string) => unknown;
}): number {
  const stored = Number(checkpoint.getData('spawnX'));
  return Number.isFinite(stored) ? stored : checkpoint.x;
}

export function playerLeadX(x: number, bodyRight: number): number {
  return Number.isFinite(bodyRight) ? Math.max(x, bodyRight) : x;
}

/** True once any part of the player has reached the checkpoint column. */
export function reachedCheckpointPlane(leadX: number, planeX: number): boolean {
  return Number.isFinite(leadX) && Number.isFinite(planeX) && leadX >= planeX;
}
