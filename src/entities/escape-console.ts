import { TILE } from '../config';

/** How close to the console's centre a player must stand to lean on the button. */
export const CONSOLE_REACH_PX = TILE * 0.75;

/** The console answers only once the stalker is gone and a player is standing at it. */
export function canPressConsole(consoleX: number, playerX: number, grounded: boolean, entityGone: boolean): boolean {
  return entityGone && grounded && Math.abs(playerX - consoleX) <= CONSOLE_REACH_PX;
}
