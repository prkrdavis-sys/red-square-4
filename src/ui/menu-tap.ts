export const MENU_TAP_LOCK_MS = 400;
export const MENU_OPEN_GUARD_MS = 350;

export function shouldAcceptTap(lastTapAt: number, now: number, lockMs = MENU_TAP_LOCK_MS): boolean {
  return now - lastTapAt >= lockMs;
}

export function menuDismissIsArmed(
  openSince: number | undefined,
  now: number,
  guardMs = MENU_OPEN_GUARD_MS,
): boolean {
  return openSince !== undefined && now - openSince >= guardMs;
}
