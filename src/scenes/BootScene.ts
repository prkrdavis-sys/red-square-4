import Phaser from 'phaser';
import { hydrateSave } from '../data/progress';
import { applySettings } from '../data/settings';
import { dismissBootSplash } from '../systems/boot-splash';
import { applySkin, createGameTextures } from '../systems/textures';
import { waitForUiFont } from '../ui/font';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    createGameTextures(this);
    applySettings(this);
    const saveReady = hydrateSave();
    void Promise.all([saveReady, waitForUiFont()]).then(([save]) => {
      applySkin(this, save.equippedSkin);
      if (this.scene.isActive()) {
        this.scene.start('TitleScene');
      }
      dismissBootSplash();
    });
  }
}
