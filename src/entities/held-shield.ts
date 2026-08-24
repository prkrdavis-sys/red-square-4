/** Pixels from the hero center to the held shield, along the facing direction. */
export const HELD_SHIELD_OFFSET_X = 22;
export const HELD_SHIELD_OFFSET_Y = 2;

export function heldShieldPosition(
  x: number,
  y: number,
  flipX: boolean,
): { x: number; y: number } {
  const facing = flipX ? -1 : 1;
  return { x: x + facing * HELD_SHIELD_OFFSET_X, y: y + HELD_SHIELD_OFFSET_Y };
}
