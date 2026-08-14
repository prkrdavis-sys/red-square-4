import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { loadSave, resetSave, resetSessionLives, resumeLevelId } from '../data/progress';
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

    const heroX = GAME_WIDTH / 2;
    const shadow = this.add.ellipse(heroX, 216, 92, 22, 0x3a1010, 0.28);
    this.add.ellipse(heroX, 164, 96, 96, 0xf0c75a, 0.14);
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
    const hasProgress = save.cleared.length > 0 || save.unlocked.length > 1;
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

    buttons.push(
      new MenuButton(this, GAME_WIDTH / 2, 390, hasProgress ? 'CONTINUE' : 'PLAY', () => startCampaign(false)),
    );
    if (hasProgress) {
      buttons.push(new MenuButton(this, GAME_WIDTH / 2, 454, 'NEW GAME', () => startCampaign(true)));
    }
    const y0 = hasProgress ? 518 : 454;
    buttons.push(new MenuButton(this, GAME_WIDTH / 2, y0, 'SETTINGS', () => launchOverlay(this, 'SettingsScene')));
    buttons.push(new MenuButton(this, GAME_WIDTH / 2, y0 + 64, 'CREDITS', () => launchOverlay(this, 'CreditsScene')));

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
