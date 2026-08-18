import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { hasCampaignProgress, loadSave, resetSave, resetSessionLives, resumeLevelId } from '../data/progress';
import { applySettings } from '../data/settings';
import { audio } from '../systems/audio';
import { Parallax } from '../systems/parallax';
import { launchOverlay, MenuButton, MenuNav, textStyle, UI } from '../ui/menu';

export class TitleScene extends Phaser.Scene {
  private parallax!: Parallax;
  private drift = 0;

  constructor() {
    super('TitleScene');
  }

  create(): void {
    applySettings(this);
    this.cameras.main.setBackgroundColor(0x5c94fc);
    this.parallax = new Parallax(this, 'grass');
    audio.playTheme(this, 'grass');

    const heroX = GAME_WIDTH / 2;
    const shadow = this.add.ellipse(heroX, 216, 92, 22, 0x3a1010, 0.28);
    this.add.ellipse(heroX, 164, 96, 96, 0xff3d42, 0.16);
    const square = this.add.image(heroX, 160, 'player').setScale(2.35);
    this.tweens.add({
      targets: square,
      y: 142,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: shadow,
      scaleX: 0.78,
      scaleY: 0.78,
      alpha: 0.14,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.time.addEvent({
      delay: 2600,
      loop: true,
      callback: () => {
        square.setTexture('player-blink');
        this.time.delayedCall(100, () => square.setTexture('player'));
      },
    });

    const baddie = this.add.image(GAME_WIDTH / 2 + 210, 430, 'baddie').setScale(1.6);
    this.tweens.add({
      targets: baddie,
      x: GAME_WIDTH / 2 + 250,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add
      .text(GAME_WIDTH / 2, 258, 'RED SQUARE 4', {
        fontFamily: UI.font,
        fontSize: '64px',
        color: '#ffffff',
        stroke: '#7a1212',
        strokeThickness: 10,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 312, 'A Mario-inspired platforming campaign', textStyle('18px', UI.gold))
      .setOrigin(0.5);

    const save = loadSave();
    const hasProgress = hasCampaignProgress(save);
    if (hasProgress) {
      this.add
        .text(
          GAME_WIDTH / 2,
          338,
          `Saved  ·  ${save.cleared.length} cleared  ·  resume ${resumeLevelId(save)}`,
          textStyle('16px', UI.gold),
        )
        .setOrigin(0.5);
    }
    const buttons: MenuButton[] = [];

    const startCampaign = (fresh: boolean) => {
      if (this.scene.isPaused()) {
        return;
      }
      audio.unlock();
      if (fresh) {
        resetSave();
      }
      resetSessionLives();
      this.scene.start('WorldMapScene');
    };

    const entries: Array<{ label: string; action: () => void }> = [
      { label: hasProgress ? 'CONTINUE' : 'PLAY', action: () => startCampaign(false) },
    ];
    if (hasProgress) {
      entries.push({ label: 'NEW GAME', action: () => startCampaign(true) });
    }
    entries.push(
      { label: 'SKINS', action: () => launchOverlay(this, 'SkinsScene') },
      { label: 'SETTINGS', action: () => launchOverlay(this, 'SettingsScene') },
      { label: 'CREDITS', action: () => launchOverlay(this, 'CreditsScene') },
    );
    const spacing = 60;
    const firstY = 626 - (entries.length - 1) * spacing;
    entries.forEach((entry, index) => {
      buttons.push(new MenuButton(this, GAME_WIDTH / 2, firstY + index * spacing, entry.label, entry.action));
    });

    new MenuNav(this, buttons);

    this.add
      .text(GAME_WIDTH / 2, 678, 'Tap a button     Arrows / WASD     Enter confirm', textStyle('16px', '#e8f0ff'))
      .setOrigin(0.5);
  }

  update(time: number, delta: number): void {
    void time;
    this.drift += delta * 0.02;
    this.parallax.update(this.drift);
  }
}
