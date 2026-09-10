import type { PlayerId } from '../network/role';

export interface SharedCameraPlayer {
  id: PlayerId;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  active: boolean;
}

export interface SharedCameraOptions {
  viewportWidth: number;
  viewportHeight: number;
  paddingX: number;
  paddingY: number;
  minZoom: number;
  maxZoom: number;
  lookAheadSeconds: number;
}

export interface SharedCameraGoal {
  x: number;
  y: number;
  zoom: number;
  playerSeparation: number;
}

export interface SharedCameraState {
  x: number;
  y: number;
  zoom: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function sharedCameraGoal(
  players: readonly SharedCameraPlayer[],
  options: SharedCameraOptions,
): SharedCameraGoal | null {
  const active = players.filter((player) => player.active);
  if (active.length === 0) {
    return null;
  }

  const xs = active.map((player) => player.x);
  const ys = active.map((player) => player.y);
  const minimumX = Math.min(...xs);
  const maximumX = Math.max(...xs);
  const minimumY = Math.min(...ys);
  const maximumY = Math.max(...ys);
  const averageVelocityX =
    active.reduce((sum, player) => sum + player.velocityX, 0) / active.length;
  const averageVelocityY =
    active.reduce((sum, player) => sum + player.velocityY, 0) / active.length;
  const contentWidth = maximumX - minimumX + options.paddingX * 2;
  const contentHeight = maximumY - minimumY + options.paddingY * 2;
  const widthZoom = contentWidth > 0 ? options.viewportWidth / contentWidth : options.maxZoom;
  const heightZoom =
    contentHeight > 0 ? options.viewportHeight / contentHeight : options.maxZoom;
  const minimumZoom = Math.min(options.minZoom, options.maxZoom);
  const maximumZoom = Math.max(options.minZoom, options.maxZoom);

  return {
    x: (minimumX + maximumX) / 2 + averageVelocityX * options.lookAheadSeconds,
    y: (minimumY + maximumY) / 2 + averageVelocityY * options.lookAheadSeconds,
    zoom: clamp(Math.min(widthZoom, heightZoom), minimumZoom, maximumZoom),
    playerSeparation: Math.hypot(maximumX - minimumX, maximumY - minimumY),
  };
}

export function smoothSharedCamera(
  current: SharedCameraState,
  goal: SharedCameraGoal,
  positionRatio: number,
  zoomRatio: number,
): SharedCameraState {
  const positionAlpha = clamp(positionRatio, 0, 1);
  const zoomAlpha = clamp(zoomRatio, 0, 1);
  return {
    x: current.x + (goal.x - current.x) * positionAlpha,
    y: current.y + (goal.y - current.y) * positionAlpha,
    zoom: current.zoom + (goal.zoom - current.zoom) * zoomAlpha,
  };
}

export function clampSharedCameraToBounds(
  state: SharedCameraState,
  viewport: Readonly<{ width: number; height: number }>,
  world: Readonly<{ x: number; y: number; width: number; height: number }>,
): SharedCameraState {
  const halfWidth = viewport.width / (2 * state.zoom);
  const halfHeight = viewport.height / (2 * state.zoom);
  const minimumX = world.x + halfWidth;
  const maximumX = world.x + world.width - halfWidth;
  const minimumY = world.y + halfHeight;
  const maximumY = world.y + world.height - halfHeight;
  return {
    x: minimumX > maximumX ? world.x + world.width / 2 : clamp(state.x, minimumX, maximumX),
    y: minimumY > maximumY ? world.y + world.height / 2 : clamp(state.y, minimumY, maximumY),
    zoom: state.zoom,
  };
}
