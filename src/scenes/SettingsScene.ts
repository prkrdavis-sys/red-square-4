import Phaser from 'phaser';
import { ALL_LEVEL_IDS, GAME_HEIGHT, GAME_WIDTH, isPlayableInEdition, type LevelId } from '../config';
import { applySettings, loadSettings, setFullscreen, writeSettings } from '../data/settings';
import { refreshEditionArt } from '../systems/textures';
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
  private classicAtOpen = false;
  private musicBtn!: MenuButton;
  private sfxBtn!: MenuButton;
  private volumeBtn!: MenuButton;
  private shakeBtn!: MenuButton;
  private fullBtn!: MenuButton;
  private classicBtn!: MenuButton;

  constructor() {
    super('SettingsScene');
  }

  create(data: OverlayData): void {
    this.returnKey = data.returnKey ?? 'TitleScene';
    this.classicAtOpen = loadSettings().classic;
    beginOverlay(this);
    dimScreen(this, 0.62, () => this.goBack());
    const panel = addPanel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 680, 680, 'SETTINGS');
    dismissOnOutside(this, panel, () => this.goBack());

    const cx = GAME_WIDTH / 2;
    this.musicBtn = new MenuButton(this, cx, 196, '', () => this.toggle('music'));
    this.sfxBtn = new MenuButton(this, cx, 254, '', () => this.toggle('sfx'));
    this.volumeBtn = new MenuButton(this, cx, 312, '', () => this.nudgeVolume(1));
    this.volumeBtn.onAdjust = (dir) => this.nudgeVolume(dir);
    this.shakeBtn = new MenuButton(this, cx, 370, '', () => this.toggle('screenshake'));
    this.fullBtn = new MenuButton(this, cx, 428, '', () => this.toggleFullscreen());
    this.classicBtn = new MenuButton(this, cx, 486, '', () => this.toggleClassic());
    const back = new MenuButton(this, cx, 544, 'BACK', () => this.goBack());

    this.refresh();
    applySettings(this);

    new MenuNav(
      this,
      [this.musicBtn, this.sfxBtn, this.volumeBtn, this.shakeBtn, this.fullBtn, this.classicBtn, back],
      () => this.goBack(),
    );

    this.add
      .text(cx, 148, 'Tap to change  ·  Arrows / Enter  ·  Esc back', textStyle('18px', '#d0c0b8'))
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
    this.classicBtn.setLabel(toggleLabel('CLASSIC v1.0', settings.classic));
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

  private toggleClassic(): void {
    writeSettings({ classic: !loadSettings().classic });
    this.refresh();
  }

  private goBack(): void {
    if (loadSettings().classic !== this.classicAtOpen) {
      this.restartForEdition();
      return;
    }
    closeOverlay(this, this.returnKey);
  }

  private restartForEdition(): void {
    refreshEditionArt(this);
    const returnKey = this.returnKey;
    const rawLevel = this.game.canvas.dataset.levelId;
    const levelId =
      rawLevel && (ALL_LEVEL_IDS as readonly string[]).includes(rawLevel) ? (rawLevel as LevelId) : undefined;
    this.scene.stop();
    if (returnKey === 'PlayScene') {
      this.scene.stop('PlayScene');
      if (levelId && isPlayableInEdition(levelId)) {
        this.scene.start('PlayScene', { levelId });
        return;
      }
      this.scene.start('WorldMapScene');
      return;
    }
    this.scene.stop(returnKey);
    this.scene.start(returnKey);
  }
}
