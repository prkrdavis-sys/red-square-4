export const COIN_DROP_CHANCE = 0.25;

export function shouldDropCoin(random: () => number = Math.random): boolean {
  return random() < COIN_DROP_CHANCE;
}
