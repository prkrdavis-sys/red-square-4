import type Phaser from 'phaser';
import type { ViewportBox } from './viewport';

export type LandscapeAngle = 90 | 270;
export type RotateDeg = 0 | 90 | -90;

export interface SafeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ForcedLandscapeState {
  forced: boolean;
  rotate: RotateDeg;
  physical: ViewportBox;
  stage: ViewportBox;
}

export interface ScreenOrientationHint {
  type?: string;
  angle?: number;
}

const ZERO_INSETS: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

const defaultBox: ViewportBox = { width: 1, height: 1, offsetLeft: 0, offsetTop: 0 };

let lastLandscapeAngle: LandscapeAngle = 90;
let touchFirstProbe: () => boolean = () => false;
let state: ForcedLandscapeState = {
  forced: false,
  rotate: 0,
  physical: defaultBox,
  stage: defaultBox,
};

export function setForcedLandscapeTouchProbe(probe: () => boolean): void {
  touchFirstProbe = probe;
}

export function currentForcedLandscape(): ForcedLandscapeState {
  return state;
}

export function isForcedLandscape(): boolean {
  return state.forced;
}

export function isOsLandscape(orientationType: string | undefined, orientationAngle?: number): boolean {
  if (orientationType?.startsWith('landscape')) {
    return true;
  }
  switch (orientationAngle) {
    case 90:
    case -90:
    case 270:
      return true;
    default:
      return false;
  }
}

export function shouldForceLandscape(
  box: Pick<ViewportBox, 'width' | 'height'>,
  orientationType: string | undefined,
  touchFirst: boolean,
  orientationAngle?: number,
): boolean {
  if (!touchFirst) {
    return false;
  }
  if (isOsLandscape(orientationType, orientationAngle)) {
    return false;
  }
  return box.height > box.width;
}

export function portraitRotateDeg(lastAngle: LandscapeAngle | undefined): Exclude<RotateDeg, 0> {
  return lastAngle === 270 ? -90 : 90;
}

export function nextLandscapeAngle(
  orientationType: string | undefined,
  orientationAngle: number | undefined,
  previous: LandscapeAngle,
): LandscapeAngle {
  if (orientationType === 'landscape-secondary' || orientationAngle === 270 || orientationAngle === -90) {
    return 270;
  }
  if (orientationType === 'landscape-primary' || orientationAngle === 90) {
    return 90;
  }
  return previous;
}

export function resolveForcedLandscape(
  physical: ViewportBox,
  orientationType: string | undefined,
  touchFirst: boolean,
  lastAngle: LandscapeAngle,
  orientationAngle?: number,
): ForcedLandscapeState {
  const forced = shouldForceLandscape(physical, orientationType, touchFirst, orientationAngle);
  const rotate: RotateDeg = forced ? portraitRotateDeg(lastAngle) : 0;
  const stage: ViewportBox = forced
    ? { width: physical.height, height: physical.width, offsetLeft: 0, offsetTop: 0 }
    : physical;
  return { forced, rotate, physical, stage };
}

export function clientToStage(
  clientX: number,
  clientY: number,
  physical: Pick<ViewportBox, 'width' | 'height'>,
  deg: RotateDeg,
): { x: number; y: number } {
  switch (deg) {
    case 0:
      return { x: clientX, y: clientY };
    case 90:
      return { x: physical.height - clientY, y: clientX };
    case -90:
      return { x: clientY, y: physical.width - clientX };
    default: {
      const exhaustive: never = deg;
      return exhaustive;
    }
  }
}

export function remapSafeInsets(physical: SafeInsets, deg: RotateDeg): SafeInsets {
  switch (deg) {
    case 0:
      return physical;
    case 90:
      return {
        top: physical.left,
        right: physical.top,
        bottom: physical.right,
        left: physical.bottom,
      };
    case -90:
      return {
        top: physical.right,
        right: physical.bottom,
        bottom: physical.left,
        left: physical.top,
      };
    default: {
      const exhaustive: never = deg;
      return exhaustive;
    }
  }
}

export function offsetRectIn(
  el: HTMLElement,
  ancestor: HTMLElement,
): { left: number; top: number; width: number; height: number; right: number; bottom: number } {
  let left = 0;
  let top = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    left += node.offsetLeft;
    top += node.offsetTop;
    const parent: Element | null = node.offsetParent;
    if (!(parent instanceof HTMLElement)) {
      break;
    }
    node = parent;
  }
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  return { left, top, width, height, right: left + width, bottom: top + height };
}

export function readScreenOrientation(
  screenOrientation: ScreenOrientationHint | null | undefined,
  windowOrientation?: number,
): ScreenOrientationHint {
  return {
    type: screenOrientation?.type,
    angle: screenOrientation?.angle ?? windowOrientation,
  };
}

export function mapPageToStage(
  pageX: number,
  pageY: number,
  current: ForcedLandscapeState = state,
  scrollX = 0,
  scrollY = 0,
): { x: number; y: number } {
  if (!current.forced || current.rotate === 0) {
    return { x: pageX, y: pageY };
  }
  return clientToStage(pageX - scrollX, pageY - scrollY, current.physical, current.rotate);
}

function readLiveOrientation(): ScreenOrientationHint {
  if (typeof screen === 'undefined') {
    return {};
  }
  const windowAngle = typeof window.orientation === 'number' ? window.orientation : undefined;
  return readScreenOrientation(screen.orientation, windowAngle);
}

function readCssPx(style: CSSStyleDeclaration, name: string): number {
  const value = Number.parseFloat(style.getPropertyValue(name));
  return Number.isFinite(value) ? value : 0;
}

function readLiveSafeInsets(): SafeInsets {
  if (typeof document === 'undefined') {
    return ZERO_INSETS;
  }
  const style = getComputedStyle(document.documentElement);
  return {
    top: readCssPx(style, '--safe-phys-top'),
    right: readCssPx(style, '--safe-phys-right'),
    bottom: readCssPx(style, '--safe-phys-bottom'),
    left: readCssPx(style, '--safe-phys-left'),
  };
}

export function applyForcedLandscapeDom(
  next: ForcedLandscapeState,
  root: CSSStyleDeclaration,
  body: DOMTokenList,
  safe: SafeInsets,
): void {
  root.setProperty('--vv-phys-width', `${next.physical.width}px`);
  root.setProperty('--vv-phys-height', `${next.physical.height}px`);

  const remapped = remapSafeInsets(safe, next.rotate);
  root.setProperty('--safe-top', `${remapped.top}px`);
  root.setProperty('--safe-right', `${remapped.right}px`);
  root.setProperty('--safe-bottom', `${remapped.bottom}px`);
  root.setProperty('--safe-left', `${remapped.left}px`);

  body.toggle('forced-landscape', next.forced);
  body.toggle('forced-landscape-ccw', next.forced && next.rotate === -90);
}

export function applyForcedLandscape(physical: ViewportBox): ViewportBox {
  const orientation = readLiveOrientation();
  lastLandscapeAngle = nextLandscapeAngle(orientation.type, orientation.angle, lastLandscapeAngle);
  state = resolveForcedLandscape(
    physical,
    orientation.type,
    touchFirstProbe(),
    lastLandscapeAngle,
    orientation.angle,
  );

  if (typeof document !== 'undefined') {
    applyForcedLandscapeDom(state, document.documentElement.style, document.body.classList, readLiveSafeInsets());
  }

  return state.stage;
}

export function bindForcedLandscapeInput(game: Phaser.Game): void {
  const scale = game.scale;
  const input = game.input;
  const origUpdateBounds = scale.updateBounds.bind(scale);
  scale.updateBounds = () => {
    if (!state.forced) {
      origUpdateBounds();
      return;
    }
    const canvas = scale.canvas;
    const bounds = scale.canvasBounds;
    bounds.x = canvas.offsetLeft;
    bounds.y = canvas.offsetTop;
    bounds.width = Math.max(1, canvas.offsetWidth);
    bounds.height = Math.max(1, canvas.offsetHeight);
  };

  const origTransform = input.transformPointer.bind(input);
  input.transformPointer = (pointer, pageX, pageY, wasMove) => {
    if (!state.forced) {
      origTransform(pointer, pageX, pageY, wasMove);
      return;
    }
    const mapped = mapPageToStage(pageX, pageY, state, window.scrollX, window.scrollY);
    origTransform(pointer, mapped.x, mapped.y, wasMove);
  };
}
