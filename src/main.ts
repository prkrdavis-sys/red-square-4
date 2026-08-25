import '@fontsource/vt323/latin-400.css';
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
import { bootHudPause, layoutHudPause } from './systems/hud-pause';
import { bootTouchControls, watchLandscapePrompt } from './systems/touch-controls';

if (import.meta.env.PROD) {
  registerSW({ immediate: true });
}
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
  },
  scene: [BootScene, TitleScene, WorldMapScene, PlayScene, SettingsScene, SkinsScene, CreditsScene],
};

bootTouchControls();
bootHudPause();
const game = new Phaser.Game(config);
watchLandscapePrompt(game);
game.scale.on('resize', layoutHudPause);
if (import.meta.env.DEV) {
  Object.assign(window, { __rs4: game });
}
