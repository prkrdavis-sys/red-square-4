import Phaser from 'phaser';
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
import { bootTouchControls, watchLandscapePrompt } from './systems/touch-controls';

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
const game = new Phaser.Game(config);
watchLandscapePrompt(game);
if (import.meta.env.DEV) {
  Object.assign(window, { __rs4: game });
}
