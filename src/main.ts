import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-700.css';
import Phaser from 'phaser';
import { registerSW } from 'virtual:pwa-register';
import './style.css';
import { GAME_HEIGHT, GAME_WIDTH, TILE } from './config';
import { BootScene } from './scenes/BootScene';
import { CreditsScene } from './scenes/CreditsScene';
import { PlayScene } from './scenes/PlayScene';
import { SettingsScene } from './scenes/SettingsScene';
import { SkinsScene } from './scenes/SkinsScene';
import { TitleScene } from './scenes/TitleScene';
import { WorldMapScene } from './scenes/WorldMapScene';
import { audio } from './systems/audio';
import { dismissBootSplash } from './systems/boot-splash';
import { bootHudPause, layoutHudPause } from './systems/hud-pause';
import { bootTouchControls, watchLandscapePrompt } from './systems/touch-controls';
import { bindGameToViewport, bootViewport } from './systems/viewport';

function registerProductionSW(): void {
  if (!import.meta.env.PROD) {
    return;
  }
  const start = (): void => {
    registerSW({ immediate: true });
  };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(start, { timeout: 2500 });
    return;
  }
  globalThis.setTimeout(start, 2500);
}

registerProductionSW();
audio.install();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#5c94fc',
  pixelArt: true,
  roundPixels: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 1800 },
      fps: 120,
      tileBias: TILE,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    expandParent: false,
    autoRound: true,
  },
  input: {
    activePointers: 3,
  },
  scene: [BootScene, TitleScene, WorldMapScene, PlayScene, SettingsScene, SkinsScene, CreditsScene],
};

bootViewport();
bootTouchControls();
bootHudPause();
const game = new Phaser.Game(config);
bindGameToViewport(game);
watchLandscapePrompt(game);
game.scale.on('resize', layoutHudPause);
globalThis.setTimeout(() => {
  if (game.scene.isActive('BootScene') && !game.scene.isActive('TitleScene')) {
    game.scene.start('TitleScene');
  }
  dismissBootSplash();
}, 3500);
if (import.meta.env.DEV) {
  Object.assign(window, { __rs4: game });
}
