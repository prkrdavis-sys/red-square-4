import { describe, expect, it } from 'vitest';
import {
  applyViewportBox,
  readViewportBox,
  rectFitsBounds,
  touchControlSize,
} from './viewport';

describe('readViewportBox', () => {
  it('prefers the visual viewport, including URL-bar offset', () => {
    expect(
      readViewportBox({ width: 851, height: 340, offsetLeft: 0, offsetTop: 56 }, { innerWidth: 851, innerHeight: 396 }),
    ).toEqual({ width: 851, height: 340, offsetLeft: 0, offsetTop: 56 });
  });

  it('falls back to the window when visualViewport is missing', () => {
    expect(readViewportBox(null, { innerWidth: 640, innerHeight: 360 })).toEqual({
      width: 640,
      height: 360,
      offsetLeft: 0,
      offsetTop: 0,
    });
  });
});

describe('touchControlSize', () => {
  it('keeps landscape-phone buttons in the current size band', () => {
    expect(touchControlSize({ width: 851, height: 393 }).button).toBeGreaterThanOrEqual(100);
    expect(touchControlSize({ width: 851, height: 393 }).button).toBeLessThanOrEqual(132);
  });

  it('shrinks so the cluster still fits a short Chrome landscape', () => {
    const box = { width: 640, height: 280 };
    const size = touchControlSize(box);
    expect(size.button * 1.95 + 20).toBeLessThanOrEqual(box.height);
    expect(size.button * 2.2).toBeLessThanOrEqual(box.width * 0.46);
  });
});

describe('applyViewportBox', () => {
  it('writes visual-viewport CSS variables', () => {
    const style = {
      props: new Map<string, string>(),
      setProperty(name: string, value: string) {
        this.props.set(name, value);
      },
    };
    applyViewportBox(style as unknown as CSSStyleDeclaration, {
      width: 915,
      height: 412,
      offsetLeft: 0,
      offsetTop: 24,
    });
    expect(style.props.get('--vv-width')).toBe('915px');
    expect(style.props.get('--vv-height')).toBe('412px');
    expect(style.props.get('--vv-top')).toBe('24px');
    expect(style.props.get('--touch-btn-size')).toMatch(/^\d+px$/);
  });
});

describe('rectFitsBounds', () => {
  it('accepts a canvas that fills a phone landscape and rejects overflow', () => {
    const bounds = { width: 851, height: 393, offsetLeft: 0, offsetTop: 0 };
    expect(rectFitsBounds({ left: 76, top: 0, right: 775, bottom: 393 }, bounds)).toBe(true);
    expect(rectFitsBounds({ left: 0, top: 0, right: 851, bottom: 720 }, bounds)).toBe(false);
  });
});
