/** Distance from the player to the near edge of a dune they will land on after a surge. */
export function sandSurgeDuneAlong(
  speed: number,
  lift: number,
  gravity: number,
  drop: number,
  width: number,
): number {
  const flight = (-lift + Math.sqrt(lift * lift + 2 * gravity * drop)) / gravity;
  return Math.max(0, speed * flight - width * 0.5);
}
