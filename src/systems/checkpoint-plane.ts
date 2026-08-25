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

/** A farther active flag blocks re-arming an earlier one. */
export function laterCheckpointIsActive(incomingX: number, activeXs: readonly number[]): boolean {
  return activeXs.some((x) => Number.isFinite(x) && x > incomingX);
}

export function isEarlierCheckpoint(candidateX: number, incomingX: number): boolean {
  return Number.isFinite(candidateX) && Number.isFinite(incomingX) && candidateX < incomingX;
}

export function checkpointSpawnMatches(
  spawn: { x: number; y: number },
  saved: { x: number; y: number },
): boolean {
  return Math.abs(spawn.x - saved.x) < 2 && Math.abs(spawn.y - saved.y) < 2;
}
