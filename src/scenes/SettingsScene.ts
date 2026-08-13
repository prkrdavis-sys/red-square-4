import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { applySettings, loadSettings, setFullscreen, writeSettings } from '../data/settings';
import { addPanel, closeOverlay, dimScreen, MenuButton, MenuNav, textStyle } from '../ui/menu';

interface OverlayData {
  returnKey?: string;
}

function onOff(value: boolean): string {
  return value ? 'ON' : 'OFF';
}

function volumeBar(volume: number): string {
  const filled = Math.round(volume * 10);
  return `${'#'.repeat(filled)}${'-'.repeat(10 - filled)}`;
}

export class SettingsScene extends Phaser.Scene {
  private returnKey = 'TitleScene';
  private volumeBtn!: MenuButton;
  private muteBtn!: MenuButton;
  private shakeBtn!: MenuButton;
  private fullBtn!: MenuButton;

  constructor() {
    super('SettingsScene');
  }

  create(data: OverlayData): void {
    this.returnKey = data.returnKey ?? 'TitleScene';
    dimScreen(this, 0.62);
    addPanel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 620, 520, 'SETTINGS');

    this.volumeBtn = new MenuButton(this, GAME_WIDTH / 2, 250, '', () => this.nudgeVolume(1));
    this.volumeBtn.onAdjust = (dir) => this.nudgeVolume(dir);
    this.muteBtn = new MenuButton(this, GAME_WIDTH / 2, 318, '', () => this.toggle('muted'));
    this.shakeBtn = new MenuButton(this, GAME_WIDTH / 2, 386, '', () => this.toggle('screenshake'));
    this.fullBtn = new MenuButton(this, GAME_WIDTH / 2, 454, '', () => this.toggleFullscreen());
    const back = new MenuButton(this, GAME_WIDTH / 2, 522, 'BACK', () => this.goBack());

    this.refresh();
    applySettings(this);

    new MenuNav(this, [this.volumeBtn, this.muteBtn, this.shakeBtn, this.fullBtn, back], () => this.goBack());

    this.add
      .text(GAME_WIDTH / 2, 188, 'Arrows / WASD  ·  Enter confirm  ·  Esc back', textStyle('16px', '#d0c0b8'))
      .setOrigin(0.5)
      .setDepth(80);

    this.scale.on('fullscreenchange', () => {
      writeSettings({ fullscreen: this.scale.isFullscreen });
      this.refresh();
    });
  }

  private refresh(): void {
    const settings = loadSettings();
    this.volumeBtn.setLabel(`SFX  ${volumeBar(settings.volume)}  ${Math.round(settings.volume * 100)}%`);
    this.muteBtn.setLabel(`MUTE                 ${onOff(settings.muted)}`);
    this.shakeBtn.setLabel(`SCREEN SHAKE         ${onOff(settings.screenshake)}`);
    this.fullBtn.setLabel(`FULLSCREEN           ${onOff(this.scale.isFullscreen)}`);
  }

  private nudgeVolume(dir: -1 | 1): void {
    const volume = Math.min(1, Math.max(0, Math.round((loadSettings().volume + dir * 0.1) * 10) / 10));
    writeSettings({ volume, muted: volume === 0 });
    applySettings(this);
    this.refresh();
  }

  private toggle(key: 'muted' | 'screenshake'): void {
    const settings = loadSettings();
    writeSettings({ [key]: !settings[key] });
    applySettings(this);
    this.refresh();
  }

  private toggleFullscreen(): void {
    setFullscreen(this, !this.scale.isFullscreen);
  }

  private goBack(): void {
    closeOverlay(this, this.returnKey);
  }
}
