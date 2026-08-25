import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { lockLandscape } from './touch-controls';

export const HUD_PAUSE = {
  width: 176,
  height: 52,
  x: GAME_WIDTH - 104,
  y: 42,
} as const;

const MIN_TAP_PX = 48;
const POINTER_MODE_EVENT = 'rs4-pointer-mode';

let booted = false;
let pauseHandler: (() => void) | undefined;

export function hudPauseUsesDom(): boolean {
  return Boolean(typeof document !== 'undefined' && document.getElementById('hud-pause'));
}

export function pauseButtonScreenRect(canvas: {
  left: number;
  top: number;
  width: number;
  height: number;
}): { left: number; top: number; width: number; height: number } {
  const scaleX = canvas.width / GAME_WIDTH;
  const scaleY = canvas.height / GAME_HEIGHT;
  const width = Math.max(MIN_TAP_PX, HUD_PAUSE.width * scaleX);
  const height = Math.max(MIN_TAP_PX, HUD_PAUSE.height * scaleY);
  const minLeft = canvas.left + 8;
  const minTop = canvas.top + 8;
  const left = Math.min(
    Math.max(canvas.left + HUD_PAUSE.x * scaleX - width / 2, minLeft),
    canvas.left + canvas.width - width - 8,
  );
  const top = Math.min(
    Math.max(canvas.top + HUD_PAUSE.y * scaleY - height / 2, minTop),
    canvas.top + canvas.height - height - 8,
  );
  return { left, top, width, height };
}

export function setHudPauseHandler(handler: (() => void) | undefined): void {
  pauseHandler = handler;
  if (!handler) {
    hideHudPause();
  }
}

export function showHudPause(): void {
  const button = document.getElementById('hud-pause');
  if (!hudPauseUsesDom() || !button) {
    hideHudPause();
    return;
  }
  document.body.classList.add('hud-pause-on');
  button.setAttribute('aria-hidden', 'false');
  layoutHudPause();
}

export function hideHudPause(): void {
  document.body.classList.remove('hud-pause-on');
  document.getElementById('hud-pause')?.setAttribute('aria-hidden', 'true');
}

export function layoutHudPause(): void {
  const button = document.getElementById('hud-pause');
  const canvas = document.querySelector<HTMLCanvasElement>('#app canvas');
  if (!button || !canvas || !document.body.classList.contains('hud-pause-on')) {
    return;
  }
  const box = pauseButtonScreenRect(canvas.getBoundingClientRect());
  const view = window.visualViewport;
  if (view) {
    const pad = 8;
    const maxLeft = view.offsetLeft + view.width - box.width - pad;
    const maxTop = view.offsetTop + view.height - box.height - pad;
    box.left = Math.min(Math.max(box.left, view.offsetLeft + pad), maxLeft);
    box.top = Math.min(Math.max(box.top, view.offsetTop + pad), maxTop);
  }
  button.style.left = `${box.left}px`;
  button.style.top = `${box.top}px`;
  button.style.width = `${box.width}px`;
  button.style.height = `${box.height}px`;
}

export function onPointerModeChange(handler: () => void): () => void {
  window.addEventListener(POINTER_MODE_EVENT, handler);
  return () => window.removeEventListener(POINTER_MODE_EVENT, handler);
}

export function bootHudPause(): void {
  if (booted) {
    return;
  }
  booted = true;
  const button = document.getElementById('hud-pause');
  if (!button) {
    return;
  }

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    pauseHandler?.();
  });
  button.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    button.classList.add('is-pressed');
    if (event.pointerType !== 'mouse') {
      lockLandscape();
    }
  });
  const unpress = () => {
    button.classList.remove('is-pressed');
  };
  button.addEventListener('pointerup', unpress);
  button.addEventListener('pointercancel', unpress);
  button.addEventListener('lostpointercapture', unpress);
  button.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });

  const emitPointerMode = () => {
    window.dispatchEvent(new Event(POINTER_MODE_EVENT));
    layoutHudPause();
  };
  window.addEventListener('resize', emitPointerMode);
  window.visualViewport?.addEventListener('resize', emitPointerMode);
  window.addEventListener('scroll', layoutHudPause, true);
  window.matchMedia('(any-pointer: coarse)').addEventListener('change', emitPointerMode);
  window.matchMedia('(any-hover: hover) and (any-pointer: fine)').addEventListener('change', emitPointerMode);
  window.matchMedia('(pointer: coarse)').addEventListener('change', emitPointerMode);
}
