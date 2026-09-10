import type { PlayerId } from '../network/role';

export interface TargetPoint {
  id: PlayerId;
  x: number;
  y: number;
  targetable: boolean;
}

export interface TargetSelection {
  id: PlayerId;
  distanceSquared: number;
}

export function selectMultiplayerTarget(
  origin: Readonly<{ x: number; y: number }>,
  players: readonly TargetPoint[],
  maximumDistance = Number.POSITIVE_INFINITY,
): TargetSelection | null {
  const maximumDistanceSquared = maximumDistance * maximumDistance;
  let selected: TargetSelection | null = null;

  for (const player of players) {
    if (!player.targetable) {
      continue;
    }
    const distanceSquared = (player.x - origin.x) ** 2 + (player.y - origin.y) ** 2;
    if (distanceSquared > maximumDistanceSquared) {
      continue;
    }
    if (
      selected === null ||
      distanceSquared < selected.distanceSquared ||
      (distanceSquared === selected.distanceSquared && player.id < selected.id)
    ) {
      selected = { id: player.id, distanceSquared };
    }
  }

  return selected;
}
