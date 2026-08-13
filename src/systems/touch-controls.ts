import type Phaser from 'phaser';

export type TouchAction = 'left' | 'right' | 'jump';

export interface TouchState {
  left: boolean;
  right: boolean;
  jump: boolean;
}

const ACTIONS: readonly TouchAction[] = ['left', 'right', 'jump'];

const held: Record<TouchAction, Set<number>> = {
  left: new Set(),
  right: new Set(),
  jump: new Set(),
};

let booted = false;
let pausedByRotate = false;

function isTouchAction(value: string | undefined): value is TouchAction {
  switch (value) {
    case 'left':
    case 'right':
    case 'jump':
      return true;
    default:
      return false;
  }
}

function syncPressed(action: TouchAction): void {
  const button = document.querySelector<HTMLButtonElement>(`.touch-btn[data-touch="${action}"]`);
  button?.classList.toggle('is-pressed', held[action].size > 0);
}

function press(action: TouchAction, pointerId: number): void {
  held[action].add(pointerId);
  syncPressed(action);
}

function releasePointer(pointerId: number): void {
  for (const action of ACTIONS) {
    if (held[action].delete(pointerId)) {
      syncPressed(action);
    }
  }
}

function releaseAll(): void {
  for (const action of ACTIONS) {
    held[action].clear();
    syncPressed(action);
  }
}

function bindButton(button: HTMLButtonElement): void {
  const action = button.dataset.touch;
  if (!isTouchAction(action)) {
    return;
  }

  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    press(action, event.pointerId);
    lockLandscape();
  });

  const end = (event: PointerEvent) => {
    releasePointer(event.pointerId);
  };
  button.addEventListener('pointerup', end);
  button.addEventListener('pointercancel', end);
  button.addEventListener('lostpointercapture', end);
  button.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });
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
    left: held.left.size > 0,
    right: held.right.size > 0,
    jump: held.jump.size > 0,
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
  sync();
}
