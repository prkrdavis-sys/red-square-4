import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_URL ?? 'http://127.0.0.1:5173';
const levels = Array.from({ length: 8 }, (_, worldIndex) =>
  Array.from({ length: 4 }, (_, stageIndex) => `${worldIndex + 1}-${stageIndex + 1}`),
).flat();
const requestedLevels = process.env.SMOKE_LEVELS?.split(',').filter((id) => levels.includes(id));
const desktopLevels = requestedLevels?.length ? requestedLevels : levels;

function saveFor(levelId) {
  return {
    unlocked: levels,
    cleared: ['1-1'],
    lastPlayed: levelId,
    collectibles: Object.fromEntries(levels.map((id) => [id, 7])),
    checkpoints: {},
    creatureCards: [],
  };
}

async function enterLevel(page, levelId) {
  await page.route('**/__save', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(saveFor(levelId)),
      });
      return;
    }
    await route.fulfill({ status: 204, body: '' });
  });
  await page.addInitScript(
    ({ key, save }) => localStorage.setItem(key, JSON.stringify(save)),
    { key: 'red-square-4-save-v2', save: saveFor(levelId) },
  );
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#app canvas').waitFor({ state: 'visible' });
  await page.waitForFunction(() => window.__rs4?.scene.isActive('TitleScene') === true);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__rs4?.scene.isActive('WorldMapScene') === true);
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    (expected) => document.querySelector('#app canvas')?.dataset.levelId === expected,
    levelId,
  );
}

async function smokeViewport(browser, viewportName, contextOptions, levelIds) {
  const failures = [];
  for (const levelId of levelIds) {
    console.log(`Smoke ${viewportName} ${levelId}`);
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    page.setDefaultNavigationTimeout(30_000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(`console: ${message.text()}`);
      }
    });
    page.on('requestfailed', (request) => {
      if (!request.url().endsWith('/__save')) {
        errors.push(`request: ${request.url()} ${request.failure()?.errorText ?? 'failed'}`);
      }
    });

    try {
      await enterLevel(page, levelId);
      if (levelId.endsWith('-1')) {
        await page.waitForFunction(
          () => document.querySelector('#app canvas')?.dataset.controlsHint === '1',
        );
        await page.evaluate((id) => {
          window.__rs4?.scene.start('PlayScene', { levelId: id, skipControlsHint: true });
        }, levelId);
        await page.waitForFunction(
          () => document.querySelector('#app canvas')?.dataset.controlsHint !== '1',
        );
      }
      await page.keyboard.down('Shift');
      await page.waitForTimeout(80);
      await page.keyboard.up('Shift');
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(180);

      const canvas = page.locator('#app canvas');
      const box = await canvas.boundingBox();
      if (!box || box.width < 300 || box.height < 180) {
        errors.push(`canvas: invalid bounds ${JSON.stringify(box)}`);
      }
      const renderedLevel = await canvas.getAttribute('data-level-id');
      if (renderedLevel !== levelId) {
        errors.push(`level: expected ${levelId}, rendered ${renderedLevel}`);
      }
      const touchState = await page.locator('#touch-controls').getAttribute('aria-hidden');
      if (contextOptions.hasTouch) {
        if (touchState !== 'false') {
          errors.push(`touch controls: expected active scene, aria-hidden=${touchState}`);
        }
        const special = page.locator('[data-touch="special"]');
        if (!(await special.isVisible())) {
          errors.push('touch controls: special button is not visible');
        } else {
          await special.tap();
        }
      }

      if (levelId === '1-1' || levelId === '5-4') {
        await page.screenshot({ path: `/tmp/red-square-${viewportName}-${levelId}.png` });
      }
    } catch (error) {
      const detail = error instanceof Error ? error.stack ?? error.message : String(error);
      console.error(`Smoke ${viewportName} ${levelId} failed: ${detail}`);
      errors.push(detail);
    }

    if (errors.length > 0) {
      failures.push({ levelId, errors });
    }
    await context.close();
  }
  return failures;
}

const browser = await chromium.launch({ headless: true });
const desktopFailures = await smokeViewport(
  browser,
  'desktop',
  { viewport: { width: 1280, height: 720 } },
  desktopLevels,
);
const mobileFailures = await smokeViewport(
  browser,
  'touch',
  {
    viewport: { width: 844, height: 390 },
    screen: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  },
  requestedLevels?.length ? [] : ['1-1', '2-2', '3-3', '4-4', '5-4', '6-4', '7-4', '8-4'],
);
await browser.close();

const failures = [...desktopFailures, ...mobileFailures];
if (failures.length > 0) {
  console.error(JSON.stringify(failures, null, 2));
  process.exitCode = 1;
} else {
  console.log(`Smoke-tested ${desktopLevels.length} desktop levels and ${requestedLevels?.length ? 0 : 8} landscape-touch representatives.`);
}
