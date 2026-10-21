export const COIN_HOVER_LIFT = 48;
export const COIN_MAGNET_RANGE = 120;
export const COIN_MAGNET_SPEED = 320;

export type CoinPoint = {
  x: number;
  y: number;
};

export function coinHoverY(spawnY: number): number {
  return spawnY - COIN_HOVER_LIFT;
}

/** Velocity toward the nearest point inside the magnet range, or zero when none qualify. */
export function coinMagnetVelocity(
  coin: CoinPoint,
  players: readonly CoinPoint[],
): { x: number; y: number } {
  let nearest: CoinPoint | undefined;
  let nearestDistance = COIN_MAGNET_RANGE;
  for (const player of players) {
    const distance = Math.hypot(player.x - coin.x, player.y - coin.y);
    if (distance <= nearestDistance) {
      nearest = player;
      nearestDistance = distance;
    }
  }
  if (!nearest || nearestDistance === 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: ((nearest.x - coin.x) / nearestDistance) * COIN_MAGNET_SPEED,
    y: ((nearest.y - coin.y) / nearestDistance) * COIN_MAGNET_SPEED,
  };
}
