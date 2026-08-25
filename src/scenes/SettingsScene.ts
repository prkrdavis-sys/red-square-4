import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { applySettings, loadSettings, setFullscreen, writeSettings } from '../data/settings';
import { addPanel, beginOverlay, closeOverlay, dimScreen, dismissOnOutside, MenuButton, MenuNav, textStyle } from '../ui/menu';

interface OverlayData {
  returnKey?: string;
}

function onOff(value: boolean): string {
  return value ? 'ON' : 'OFF';
}

function toggleLabel(name: string, value: boolean): string {
  return `${name.padEnd(18)}${onOff(value)}`;
}

function volumeBar(volume: number): string {
  const filled = Math.round(volume * 10);
  return `${'#'.repeat(filled)}${'-'.repeat(10 - filled)}`;
}

export class SettingsScene extends Phaser.Scene {
  private returnKey = 'TitleScene';
  private musicBtn!: MenuButton;
  private sfxBtn!: MenuButton;
  private volumeBtn!: MenuButton;
  private shakeBtn!: MenuButton;
  private fullBtn!: MenuButton;

  constructor() {
    super('SettingsScene');
  }

  create(data: OverlayData): void {
    this.returnKey = data.returnKey ?? 'TitleScene';
    beginOverlay(this);
    dimScreen(this, 0.62, () => this.goBack());
    const panel = addPanel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 620, 590, 'SETTINGS');
    dismissOnOutside(this, panel, () => this.goBack());

    const cx = GAME_WIDTH / 2;
    this.musicBtn = new MenuButton(this, cx, 228, '', () => this.toggle('music'));
    this.sfxBtn = new MenuButton(this, cx, 290, '', () => this.toggle('sfx'));
    this.volumeBtn = new MenuButton(this, cx, 352, '', () => this.nudgeVolume(1));
    this.volumeBtn.onAdjust = (dir) => this.nudgeVolume(dir);
    this.shakeBtn = new MenuButton(this, cx, 414, '', () => this.toggle('screenshake'));
    this.fullBtn = new MenuButton(this, cx, 476, '', () => this.toggleFullscreen());
    const back = new MenuButton(this, cx, 538, 'BACK', () => this.goBack());

    this.refresh();
    applySettings(this);

    new MenuNav(this, [this.musicBtn, this.sfxBtn, this.volumeBtn, this.shakeBtn, this.fullBtn, back], () => this.goBack());

    this.add
      .text(cx, 172, 'Tap to change  ·  Arrows / Enter  ·  Esc back', textStyle('18px', '#d0c0b8'))
      .setOrigin(0.5)
      .setDepth(80);

    this.scale.on('fullscreenchange', () => {
      writeSettings({ fullscreen: this.scale.isFullscreen });
      this.refresh();
    });
  }

  private refresh(): void {
    const settings = loadSettings();
    this.musicBtn.setLabel(toggleLabel('MUSIC', settings.music));
    this.sfxBtn.setLabel(toggleLabel('SOUND EFFECTS', settings.sfx));
    this.volumeBtn.setLabel(`VOLUME  ${volumeBar(settings.volume)}  ${Math.round(settings.volume * 100)}%`);
    this.shakeBtn.setLabel(toggleLabel('SCREEN SHAKE', settings.screenshake));
    this.fullBtn.setLabel(toggleLabel('FULLSCREEN', this.scale.isFullscreen));
  }

  private nudgeVolume(dir: -1 | 1): void {
    const volume = Math.min(1, Math.max(0, Math.round((loadSettings().volume + dir * 0.1) * 10) / 10));
    writeSettings({ volume });
    applySettings(this);
    this.refresh();
  }

  private toggle(key: 'music' | 'sfx' | 'screenshake'): void {
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
