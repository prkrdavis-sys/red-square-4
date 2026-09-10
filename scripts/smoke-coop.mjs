import { chromium } from 'playwright';

const baseUrl = process.env.RS4_URL ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const host = await context.newPage();
const guest = await context.newPage();

try {
  await Promise.all([host.goto(baseUrl), guest.goto(baseUrl)]);
  await Promise.all([
    host.waitForFunction(() => window.__rs4CoopSmoke),
    guest.waitForFunction(() => window.__rs4CoopSmoke),
  ]);
  const channel = `rs4-smoke-${Date.now()}`;
  await host.evaluate(([name]) => window.__rs4CoopSmoke.start('host', name, '1-1'), [channel]);
  await guest.evaluate(([name]) => window.__rs4CoopSmoke.start('guest', name, '1-1'), [channel]);
  await Promise.all([
    host.waitForFunction(() => document.querySelector('canvas')?.dataset.levelId === '1-1'),
    guest.waitForFunction(() => document.querySelector('canvas')?.dataset.levelId === '1-1'),
  ]);

  const playerCounts = await Promise.all([host, guest].map((page) => page.evaluate(() => {
    const scene = window.__rs4.scene.getScene('PlayScene');
    return scene.players.length;
  })));
  if (playerCounts.some((count) => count !== 2)) {
    throw new Error(`Expected two players on both peers, received ${playerCounts.join(', ')}`);
  }

  await host.evaluate(() => {
    const scene = window.__rs4.scene.getScene('PlayScene');
    scene.players[1].y = scene.built.heightPx + 100;
  });
  await Promise.all([host, guest].map((page) => page.waitForFunction(() => {
    const scene = window.__rs4.scene.getScene('PlayScene');
    return scene.runtime?.isActive(scene.players[1].role) === false;
  })));
  const spectatingVisible = await guest.evaluate(() => {
    const scene = window.__rs4.scene.getScene('PlayScene');
    return scene.hudSpectating.visible && scene.hudSpectating.text.includes('SPECTATING');
  });
  if (!spectatingVisible) {
    throw new Error('Expected the eliminated guest to see the spectating HUD.');
  }

  await host.evaluate(() => {
    const scene = window.__rs4.scene.getScene('PlayScene');
    const checkpoint = scene.built.checkpoints.getChildren()[0];
    scene.activateCheckpoint(checkpoint);
  });
  await Promise.all([host, guest].map((page) => page.waitForFunction(() => {
    const scene = window.__rs4.scene.getScene('PlayScene');
    return scene.runtime?.isActive(scene.players[1].role) === true && !scene.players[1].frozen;
  })));

  const bounced = await host.evaluate(() => {
    const scene = window.__rs4.scene.getScene('PlayScene');
    const [hostPlayer, guestPlayer] = scene.players;
    hostPlayer.setPosition(420, 300);
    guestPlayer.setPosition(420, 334);
    hostPlayer.arcadeBody.setVelocityY(240);
    guestPlayer.arcadeBody.setVelocityY(0);
    scene.onPlayersCollide();
    return hostPlayer.arcadeBody.velocity.y < 0;
  });
  if (!bounced) {
    throw new Error('Expected teammate head collision to bounce the upper player.');
  }

  await host.evaluate(() => {
    const scene = window.__rs4.scene.getScene('PlayScene');
    const boss = scene.built.worldBoss ?? scene.built.miniBoss;
    boss.hp = 1;
    boss.invulnUntil = 0;
    boss.bossState = 'recovery';
    scene.onBossHeadStomp(scene.players[1], boss, Boolean(scene.built.worldBoss));
  });
  await Promise.all([host, guest].map((page) => page.waitForFunction(() => {
    const scene = window.__rs4.scene.getScene('PlayScene');
    return scene.completing === true;
  })));

  console.log('Co-op smoke passed: two peers, collision, spectating, checkpoint revival, boss clear.');
} finally {
  await context.close();
  await browser.close();
}
