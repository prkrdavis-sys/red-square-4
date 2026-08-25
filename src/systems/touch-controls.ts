import type Phaser from 'phaser';

export type TouchAction = 'jump' | 'special';
export type MoveAxis = 'left' | 'right' | null;

export interface TouchState {
  left: boolean;
  right: boolean;
  jump: boolean;
  special: boolean;
}

export const MOVE_DEADZONE_PX = 18;

const ACTIONS: readonly TouchAction[] = ['jump', 'special'];

const held: Record<TouchAction, Set<number>> = {
  jump: new Set(),
  special: new Set(),
};

const tracked = new Map<number, 'move' | TouchAction>();

let moveAxis: MoveAxis = null;
let moveOriginX = 0;
let booted = false;
let pausedByRotate = false;

export function moveDirectionFromDelta(deltaX: number, deadzonePx = MOVE_DEADZONE_PX): MoveAxis {
  if (deltaX <= -deadzonePx) {
    return 'left';
  }
  if (deltaX >= deadzonePx) {
    return 'right';
  }
  return null;
}

export function sliderThumbOffset(deltaX: number, maxOffset: number): number {
  return Math.min(maxOffset, Math.max(-maxOffset, deltaX));
}

function isTouchAction(value: string | undefined): value is TouchAction {
  switch (value) {
    case 'jump':
    case 'special':
      return true;
    default:
      return false;
  }
}

function movePad(): HTMLElement | null {
  return document.querySelector('[data-touch-move]');
}

function sliderEl(): HTMLElement | null {
  return document.querySelector('[data-touch-slider]');
}

function capturePointer(target: Element, pointerId: number): void {
  if (!('setPointerCapture' in target)) {
    return;
  }
  try {
    target.setPointerCapture(pointerId);
  } catch {
    // iOS can reject capture; window-level pointerup still releases.
  }
}

function syncPressed(action: TouchAction): void {
  const button = document.querySelector<HTMLButtonElement>(`.touch-btn[data-touch="${action}"]`);
  button?.classList.toggle('is-pressed', held[action].size > 0);
}

function setMoveAxis(next: MoveAxis): void {
  moveAxis = next;
  const slider = sliderEl();
  slider?.classList.toggle('is-left', next === 'left');
  slider?.classList.toggle('is-right', next === 'right');
}

function restSlider(): void {
  const slider = sliderEl();
  if (!slider) {
    return;
  }
  slider.classList.remove('is-steering', 'is-left', 'is-right');
  slider.style.left = '';
  slider.style.top = '';
  slider.style.setProperty('--thumb-x', '0px');
}

function clampCenter(value: number, extent: number, size: number): number {
  const half = size / 2;
  const min = half + 8;
  const max = extent - half - 8;
  if (max < min) {
    return extent / 2;
  }
  return Math.min(max, Math.max(min, value));
}

function placeSlider(clientX: number, clientY: number): void {
  const pad = movePad();
  const slider = sliderEl();
  if (!pad || !slider) {
    return;
  }
  const rect = pad.getBoundingClientRect();
  const x = clampCenter(clientX - rect.left, rect.width, slider.offsetWidth);
  const y = clampCenter(clientY - rect.top, rect.height, slider.offsetHeight);
  slider.style.left = `${x}px`;
  slider.style.top = `${y}px`;
  slider.classList.add('is-steering');
}

function updateThumb(currentX: number): void {
  const slider = sliderEl();
  if (!slider) {
    return;
  }
  const max = slider.offsetWidth * 0.28;
  slider.style.setProperty('--thumb-x', `${sliderThumbOffset(currentX - moveOriginX, max)}px`);
}

function applyMoveX(currentX: number): void {
  setMoveAxis(moveDirectionFromDelta(currentX - moveOriginX));
  updateThumb(currentX);
}

function hasTrackedMove(): boolean {
  for (const kind of tracked.values()) {
    if (kind === 'move') {
      return true;
    }
  }
  return false;
}

function releasePointer(pointerId: number): void {
  const kind = tracked.get(pointerId);
  if (!kind) {
    return;
  }
  tracked.delete(pointerId);
  if (kind === 'move') {
    if (hasTrackedMove()) {
      return;
    }
    moveOriginX = 0;
    setMoveAxis(null);
    restSlider();
    return;
  }
  if (held[kind].delete(pointerId)) {
    syncPressed(kind);
  }
}

function releaseAll(): void {
  tracked.clear();
  moveOriginX = 0;
  setMoveAxis(null);
  restSlider();
  for (const action of ACTIONS) {
    held[action].clear();
    syncPressed(action);
  }
}

function press(action: TouchAction, pointerId: number): void {
  tracked.set(pointerId, action);
  held[action].add(pointerId);
  syncPressed(action);
}

function beginMove(event: PointerEvent): void {
  if (tracked.has(event.pointerId) || hasTrackedMove()) {
    return;
  }
  tracked.set(event.pointerId, 'move');
  moveOriginX = event.clientX;
  placeSlider(event.clientX, event.clientY);
  applyMoveX(event.clientX);
}

function bindButton(button: HTMLButtonElement): void {
  const action = button.dataset.touch;
  if (!isTouchAction(action)) {
    return;
  }

  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    capturePointer(button, event.pointerId);
    press(action, event.pointerId);
    lockLandscape();
  });

  button.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });
}

function bindMovePad(pad: HTMLElement): void {
  pad.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    capturePointer(pad, event.pointerId);
    beginMove(event);
    lockLandscape();
  });

  pad.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });
}

function bindGlobalPointers(): void {
  const onEnd = (event: PointerEvent) => {
    releasePointer(event.pointerId);
  };

  window.addEventListener('pointerup', onEnd, true);
  window.addEventListener('pointercancel', onEnd, true);
  window.addEventListener(
    'pointermove',
    (event) => {
      if (tracked.get(event.pointerId) !== 'move') {
        return;
      }
      applyMoveX(event.clientX);
    },
    true,
  );
  window.addEventListener(
    'lostpointercapture',
    (event) => {
      if (event.buttons !== 0) {
        return;
      }
      releasePointer(event.pointerId);
    },
    true,
  );

  const onTouchEnd = (event: TouchEvent) => {
    for (const touch of Array.from(event.changedTouches)) {
      releasePointer(touch.identifier);
    }
  };
  window.addEventListener('touchend', onTouchEnd, true);
  window.addEventListener('touchcancel', onTouchEnd, true);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') {
      releaseAll();
    }
  });
  window.addEventListener('pagehide', releaseAll);
  window.addEventListener('blur', releaseAll);
  window.addEventListener('orientationchange', releaseAll);
}

export function hasDesktopPointer(): boolean {
  return window.matchMedia('(any-hover: hover) and (any-pointer: fine)').matches;
}

export function isTouchFirst(): boolean {
  if (hasDesktopPointer()) {
    return false;
  }
  return window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(hover: none)').matches;
}

function needsLandscapePrompt(): boolean {
  return isTouchFirst() && window.matchMedia('(orientation: portrait)').matches;
}

export function getTouchState(): TouchState {
  return {
    left: moveAxis === 'left',
    right: moveAxis === 'right',
    jump: held.jump.size > 0,
    special: held.special.size > 0,
  };
}

type OrientationLocker = {
  lock: (orientation: 'landscape') => Promise<void>;
};

export function lockLandscape(): void {
  if (!isTouchFirst()) {
    return;
  }
  const orientation = screen.orientation as unknown as OrientationLocker | undefined;
  if (!orientation || typeof orientation.lock !== 'function') {
    return;
  }
  void orientation.lock('landscape').catch(() => undefined);
}

export function showTouchControls(): void {
  if (!isTouchFirst()) {
    return;
  }
  document.body.classList.add('touch-play');
  document.getElementById('touch-controls')?.setAttribute('aria-hidden', 'false');
}

export function hideTouchControls(): void {
  document.body.classList.remove('touch-play');
  document.getElementById('touch-controls')?.setAttribute('aria-hidden', 'true');
  releaseAll();
}

function syncLandscapePrompt(game: Phaser.Game): void {
  const desktop = hasDesktopPointer();
  const needs = needsLandscapePrompt();
  document.body.classList.toggle('desktop-pointer', desktop);
  document.body.classList.toggle('needs-landscape', needs);

  if (needs) {
    releaseAll();
    if (!pausedByRotate) {
      game.pause();
      pausedByRotate = true;
    }
    return;
  }

  if (pausedByRotate) {
    game.resume();
    pausedByRotate = false;
  }
}

export function bootTouchControls(): void {
  if (booted) {
    return;
  }
  booted = true;

  document.body.classList.toggle('desktop-pointer', hasDesktopPointer());
  document.querySelectorAll<HTMLButtonElement>('.touch-btn[data-touch]').forEach(bindButton);
  const pad = movePad();
  if (pad) {
    bindMovePad(pad);
  }
  bindGlobalPointers();

  const onFirstGesture = () => {
    lockLandscape();
  };
  window.addEventListener('pointerdown', onFirstGesture, { once: true, passive: true });

  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
      lockLandscape();
    }
  });
}

export function watchLandscapePrompt(game: Phaser.Game): void {
  const sync = () => {
    syncLandscapePrompt(game);
  };
  const portrait = window.matchMedia('(orientation: portrait)');
  const desktop = window.matchMedia('(any-hover: hover) and (any-pointer: fine)');
  portrait.addEventListener('change', sync);
  desktop.addEventListener('change', sync);
  window.addEventListener('resize', sync);
  window.addEventListener('orientationchange', sync);
  window.visualViewport?.addEventListener('resize', sync);
  sync();
}
