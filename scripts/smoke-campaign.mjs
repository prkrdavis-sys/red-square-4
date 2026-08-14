import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_URL ?? 'http://127.0.0.1:5173';
const levels = Array.from({ length: 5 }, (_, worldIndex) =>
  Array.from({ length: 4 }, (_, stageIndex) => `${worldIndex + 1}-${stageIndex + 1}`),
).flat();

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
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.locator('#app canvas').waitFor({ state: 'visible' });
  await page.waitForTimeout(350);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(280);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(520);
}

async function smokeViewport(browser, viewportName, contextOptions, levelIds) {
  const failures = [];
  for (const levelId of levelIds) {
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
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
      errors.push(error instanceof Error ? error.stack ?? error.message : String(error));
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
  levels,
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
  ['1-1', '2-2', '3-3', '4-4', '5-4'],
);
await browser.close();

const failures = [...desktopFailures, ...mobileFailures];
if (failures.length > 0) {
  console.error(JSON.stringify(failures, null, 2));
  process.exitCode = 1;
} else {
  console.log(`Smoke-tested ${levels.length} desktop levels and 5 landscape-touch representatives.`);
}
