import type Phaser from 'phaser';

export interface ViewportBox {
  width: number;
  height: number;
  offsetLeft: number;
  offsetTop: number;
}

export interface ViewportFallback {
  innerWidth: number;
  innerHeight: number;
}

export interface TouchControlSize {
  button: number;
  gap: number;
}

const CLUSTER_HEIGHT = 1.95;
const SLIDER_WIDTH = 2.2;
const SHELL_PAD = 20;

let booted = false;
let gameRef: Phaser.Game | undefined;
let lastSize: { width: number; height: number } | undefined;

function clamp(min: number, value: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function readViewportBox(
  view: Pick<VisualViewport, 'width' | 'height' | 'offsetLeft' | 'offsetTop'> | null | undefined,
  fallback: ViewportFallback,
): ViewportBox {
  return {
    width: Math.max(1, Math.round(view?.width ?? fallback.innerWidth)),
    height: Math.max(1, Math.round(view?.height ?? fallback.innerHeight)),
    offsetLeft: Math.round(view?.offsetLeft ?? 0),
    offsetTop: Math.round(view?.offsetTop ?? 0),
  };
}

export function touchControlSize(box: Pick<ViewportBox, 'width' | 'height'>): TouchControlSize {
  const shortest = Math.min(box.width, box.height);
  const preferred =
    box.height <= 360
      ? clamp(72, shortest * 0.24, 96)
      : box.height <= 500
        ? clamp(100, shortest * 0.28, 132)
        : clamp(124, shortest * 0.21, 172);
  const maxByHeight = (box.height - SHELL_PAD) / CLUSTER_HEIGHT;
  const maxByWidth = (box.width * 0.46) / SLIDER_WIDTH;
  const button = Math.round(clamp(56, Math.min(preferred, maxByHeight, maxByWidth), 172));
  const gap = Math.round(clamp(8, button * 0.12, 24));
  return { button, gap };
}

export function applyViewportBox(style: CSSStyleDeclaration, box: ViewportBox): void {
  style.setProperty('--vv-width', `${box.width}px`);
  style.setProperty('--vv-height', `${box.height}px`);
  const touch = touchControlSize(box);
  style.setProperty('--touch-btn-size', `${touch.button}px`);
  style.setProperty('--touch-btn-gap', `${touch.gap}px`);
}

export function isPortraitBox(box: Pick<ViewportBox, 'width' | 'height'>): boolean {
  return box.height > box.width;
}

export function viewportSizeChanged(
  prev: Pick<ViewportBox, 'width' | 'height'> | undefined,
  next: Pick<ViewportBox, 'width' | 'height'>,
): boolean {
  return !prev || prev.width !== next.width || prev.height !== next.height;
}

export function rectFitsBounds(
  rect: { left: number; top: number; right: number; bottom: number },
  bounds: Pick<ViewportBox, 'width' | 'height' | 'offsetLeft' | 'offsetTop'>,
  slack = 2,
): boolean {
  return (
    rect.left >= bounds.offsetLeft - slack &&
    rect.top >= bounds.offsetTop - slack &&
    rect.right <= bounds.offsetLeft + bounds.width + slack &&
    rect.bottom <= bounds.offsetTop + bounds.height + slack
  );
}

export function currentViewportBox(): ViewportBox {
  return readViewportBox(window.visualViewport, window);
}

export function applyCurrentViewport(): ViewportBox {
  const box = currentViewportBox();
  applyViewportBox(document.documentElement.style, box);
  if (window.scrollX !== 0 || window.scrollY !== 0) {
    window.scrollTo(0, 0);
  }
  return box;
}

function onViewportChange(): void {
  const box = applyCurrentViewport();
  if (!viewportSizeChanged(lastSize, box)) {
    return;
  }
  lastSize = { width: box.width, height: box.height };
  gameRef?.scale.refresh();
}

export function bootViewport(): void {
  if (booted) {
    return;
  }
  booted = true;
  applyCurrentViewport();
  window.visualViewport?.addEventListener('resize', onViewportChange);
  window.visualViewport?.addEventListener('scroll', onViewportChange);
  window.addEventListener('resize', onViewportChange);
  window.addEventListener('orientationchange', onViewportChange);
  window.addEventListener('fullscreenchange', onViewportChange);
  window.addEventListener(
    'scroll',
    () => {
      if (window.scrollX !== 0 || window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
    },
    { passive: true },
  );
}

export function bindGameToViewport(game: Phaser.Game): void {
  gameRef = game;
  onViewportChange();
}
