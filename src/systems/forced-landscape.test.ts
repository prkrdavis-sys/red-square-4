import { describe, expect, it } from 'vitest';
import {
  applyForcedLandscapeDom,
  clientToStage,
  isOsLandscape,
  mapPageToStage,
  nextLandscapeAngle,
  portraitRotateDeg,
  remapSafeInsets,
  resolveForcedLandscape,
  shouldForceLandscape,
} from './forced-landscape';

const portraitPhone = { width: 390, height: 844, offsetLeft: 0, offsetTop: 0 };
const landscapePhone = { width: 844, height: 390, offsetLeft: 0, offsetTop: 0 };

describe('shouldForceLandscape', () => {
  it('skips desktop even in a tall window', () => {
    expect(shouldForceLandscape(portraitPhone, 'portrait-primary', false)).toBe(false);
  });

  it('skips when the OS is already landscape', () => {
    expect(shouldForceLandscape(portraitPhone, 'landscape-primary', true)).toBe(false);
    expect(shouldForceLandscape(portraitPhone, 'landscape-secondary', true)).toBe(false);
    expect(shouldForceLandscape(portraitPhone, 'portrait-primary', true, 90)).toBe(false);
  });

  it('forces touch-first portrait windows', () => {
    expect(shouldForceLandscape(portraitPhone, 'portrait-primary', true)).toBe(true);
    expect(shouldForceLandscape(portraitPhone, undefined, true)).toBe(true);
  });

  it('skips landscape-shaped boxes', () => {
    expect(shouldForceLandscape(landscapePhone, 'portrait-primary', true)).toBe(false);
  });
});

describe('isOsLandscape', () => {
  it('treats type or angle as landscape', () => {
    expect(isOsLandscape('landscape-primary')).toBe(true);
    expect(isOsLandscape('portrait-primary', -90)).toBe(true);
    expect(isOsLandscape('portrait-primary', 0)).toBe(false);
  });
});

describe('portraitRotateDeg', () => {
  it('defaults to landscape-primary 90', () => {
    expect(portraitRotateDeg(undefined)).toBe(90);
    expect(portraitRotateDeg(90)).toBe(90);
  });

  it('uses the last landscape-secondary as -90', () => {
    expect(portraitRotateDeg(270)).toBe(-90);
  });
});

describe('nextLandscapeAngle', () => {
  it('remembers the last landscape side and ignores portrait', () => {
    expect(nextLandscapeAngle('landscape-secondary', 270, 90)).toBe(270);
    expect(nextLandscapeAngle('landscape-primary', 90, 270)).toBe(90);
    expect(nextLandscapeAngle(undefined, -90, 90)).toBe(270);
    expect(nextLandscapeAngle('portrait-primary', 0, 270)).toBe(270);
  });
});

describe('resolveForcedLandscape', () => {
  it('swaps the stage when forcing portrait', () => {
    const next = resolveForcedLandscape(portraitPhone, 'portrait-primary', true, 90);
    expect(next.forced).toBe(true);
    expect(next.rotate).toBe(90);
    expect(next.stage).toEqual({ width: 844, height: 390, offsetLeft: 0, offsetTop: 0 });
  });

  it('does not CSS-rotate when the OS is already landscape', () => {
    const next = resolveForcedLandscape(portraitPhone, 'landscape-primary', true, 90);
    expect(next.forced).toBe(false);
    expect(next.rotate).toBe(0);
    expect(next.stage).toEqual(portraitPhone);
  });
});

describe('clientToStage', () => {
  const box = { width: 390, height: 844 };

  it('is identity at 0', () => {
    expect(clientToStage(10, 20, box, 0)).toEqual({ x: 10, y: 20 });
  });

  it('maps 90deg so stage origin is the physical bottom-left', () => {
    expect(clientToStage(0, 844, box, 90)).toEqual({ x: 0, y: 0 });
    expect(clientToStage(0, 0, box, 90)).toEqual({ x: 844, y: 0 });
    expect(clientToStage(390, 844, box, 90)).toEqual({ x: 0, y: 390 });
  });

  it('maps -90deg so stage origin is the physical top-right', () => {
    expect(clientToStage(390, 0, box, -90)).toEqual({ x: 0, y: 0 });
    expect(clientToStage(0, 0, box, -90)).toEqual({ x: 0, y: 390 });
    expect(clientToStage(390, 844, box, -90)).toEqual({ x: 844, y: 0 });
  });
});

describe('mapPageToStage', () => {
  it('subtracts scroll before rotating', () => {
    const current = resolveForcedLandscape(portraitPhone, 'portrait-primary', true, 90);
    expect(mapPageToStage(12, 856, current, 12, 12)).toEqual({ x: 0, y: 0 });
  });
});

describe('applyForcedLandscapeDom', () => {
  function fakeStyle(): CSSStyleDeclaration & { props: Map<string, string> } {
    const props = new Map<string, string>();
    return {
      props,
      setProperty(name: string, value: string) {
        props.set(name, value);
      },
    } as unknown as CSSStyleDeclaration & { props: Map<string, string> };
  }

  function fakeClassList(): DOMTokenList & { values: Set<string> } {
    const values = new Set<string>();
    return {
      values,
      toggle(name: string, force?: boolean) {
        if (force) {
          values.add(name);
        } else {
          values.delete(name);
        }
        return Boolean(force);
      },
    } as unknown as DOMTokenList & { values: Set<string> };
  }

  it('marks a clockwise portrait stage and remaps safe insets', () => {
    const style = fakeStyle();
    const body = fakeClassList();
    const next = resolveForcedLandscape(portraitPhone, 'portrait-primary', true, 90);
    applyForcedLandscapeDom(next, style, body, { top: 1, right: 2, bottom: 3, left: 4 });
    expect(body.values.has('forced-landscape')).toBe(true);
    expect(body.values.has('forced-landscape-ccw')).toBe(false);
    expect(style.props.get('--vv-phys-width')).toBe('390px');
    expect(style.props.get('--vv-phys-height')).toBe('844px');
    expect(style.props.get('--safe-top')).toBe('4px');
    expect(style.props.get('--safe-right')).toBe('1px');
  });

  it('marks the last landscape-secondary as counterclockwise', () => {
    const style = fakeStyle();
    const body = fakeClassList();
    const next = resolveForcedLandscape(portraitPhone, 'portrait-primary', true, 270);
    applyForcedLandscapeDom(next, style, body, { top: 0, right: 0, bottom: 0, left: 0 });
    expect(next.rotate).toBe(-90);
    expect(body.values.has('forced-landscape')).toBe(true);
    expect(body.values.has('forced-landscape-ccw')).toBe(true);
  });

  it('clears force classes when the OS is already landscape', () => {
    const style = fakeStyle();
    const body = fakeClassList();
    body.toggle('forced-landscape', true);
    const next = resolveForcedLandscape(portraitPhone, 'landscape-primary', true, 90);
    applyForcedLandscapeDom(next, style, body, { top: 0, right: 0, bottom: 0, left: 0 });
    expect(body.values.has('forced-landscape')).toBe(false);
    expect(body.values.has('forced-landscape-ccw')).toBe(false);
  });
});

describe('remapSafeInsets', () => {
  const phys = { top: 1, right: 2, bottom: 3, left: 4 };

  it('keeps insets when not rotated', () => {
    expect(remapSafeInsets(phys, 0)).toEqual(phys);
  });

  it('rotates clockwise', () => {
    expect(remapSafeInsets(phys, 90)).toEqual({ top: 4, right: 1, bottom: 2, left: 3 });
  });

  it('rotates counterclockwise', () => {
    expect(remapSafeInsets(phys, -90)).toEqual({ top: 2, right: 3, bottom: 4, left: 1 });
  });
});
