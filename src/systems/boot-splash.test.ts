import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dismissBootSplash } from './boot-splash';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('dismissBootSplash', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('is a no-op when the splash node is missing', () => {
    vi.stubGlobal('document', { getElementById: () => null });
    expect(() => dismissBootSplash()).not.toThrow();
  });

  it('removes the splash once', () => {
    const splash = {
      classList: {
        tokens: new Set<string>(),
        contains(name: string) {
          return this.tokens.has(name);
        },
        add(name: string) {
          this.tokens.add(name);
        },
      },
      remove: vi.fn(),
    };
    vi.stubGlobal('document', { getElementById: () => splash });

    dismissBootSplash();
    dismissBootSplash();

    expect(splash.classList.contains('is-done')).toBe(true);
    expect(splash.remove).toHaveBeenCalledTimes(1);
  });
});

describe('boot shell', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const orient = readFileSync(join(ROOT, 'public/boot-orient.js'), 'utf8');
  const fonts = readFileSync(join(ROOT, 'src/ui/fonts.css'), 'utf8');
  const main = readFileSync(join(ROOT, 'src/main.ts'), 'utf8');
  const vite = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');

  it('does not ask the browser to rotate', () => {
    expect(html).toContain('boot-orient.js');
    expect(orient).not.toMatch(/\.lock\s*\(/);
    expect(orient).not.toMatch(/\.unlock\s*\(/);
    expect(vite).not.toMatch(/orientation:/);
    expect(main).not.toMatch(/orientation\.(lock|unlock)/);
    expect(readFileSync(join(ROOT, 'src/systems/forced-landscape.ts'), 'utf8')).not.toMatch(/orientation\.(lock|unlock)/);
    expect(readFileSync(join(ROOT, 'src/systems/viewport.ts'), 'utf8')).not.toMatch(/orientation\.(lock|unlock)/);
  });

  it('does not pin the document to a precached shell', () => {
    expect(vite).toMatch(/navigateFallback:\s*null/);
    expect(vite).not.toMatch(/cacheName:\s*'rs4-pages'/);
    expect(readFileSync(join(ROOT, 'public/sw-force-reload.js'), 'utf8')).not.toMatch(/clients\.navigate/);
  });

  it('keeps one font and one splash layout', () => {
    expect(html).toContain('fonts.css');
    expect(html).not.toContain('loading...');
    expect(html).not.toContain('boot-splash-hero');
    expect(html).not.toContain('Segoe UI');
    expect(fonts).toContain('font-display: block');
    expect(fonts).not.toContain('swap');
    expect(main).not.toContain('fontsource');
  });
});
