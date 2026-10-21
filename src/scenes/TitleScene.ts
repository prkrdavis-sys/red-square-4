import Phaser from 'phaser';
import { GAME_WIDTH, HALLOWEEN, themeSky } from '../config';
import { hasCampaignProgress, loadSave, resetSessionLives, resumeLevelId } from '../data/progress';
import { applySettings } from '../data/settings';
import { audio } from '../systems/audio';
import { preloadOptionalAssets } from '../systems/optional-assets';
import { Parallax } from '../systems/parallax';
import { launchOverlay, MenuButton, MenuNav, textStyle, UI } from '../ui/menu';

export class TitleScene extends Phaser.Scene {
  private parallax!: Parallax;
  private drift = 0;

  constructor() {
    super('TitleScene');
  }

  create(): void {
    preloadOptionalAssets(this);
    applySettings(this);
    const theme = HALLOWEEN ? 'castle' : 'grass';
    this.cameras.main.setBackgroundColor(themeSky(theme));
    this.parallax = new Parallax(this, theme);
    audio.playTheme(this, theme);
    if (HALLOWEEN) {
      this.addHalloweenDressing();
    }

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
      .text(GAME_WIDTH / 2, HALLOWEEN ? 248 : 258, 'RED SQUARE 4', {
        ...textStyle('64px', '#ffffff'),
        stroke: HALLOWEEN ? '#e07020' : '#7a1212',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    if (HALLOWEEN) {
      this.add
        .text(GAME_WIDTH / 2, 296, 'HAPPY HALLOWEEN', textStyle('18px', '#ffb25a'))
        .setOrigin(0.5);
    }

    this.add
      .text(
        GAME_WIDTH / 2,
        HALLOWEEN ? 322 : 312,
        'A Mario-inspired platforming campaign',
        textStyle('20px', UI.gold),
      )
      .setOrigin(0.5);

    const save = loadSave();
    const hasProgress = hasCampaignProgress(save);
    if (hasProgress) {
      this.add
        .text(
          GAME_WIDTH / 2,
          HALLOWEEN ? 348 : 338,
          `Saved  ·  ${save.cleared.length} cleared  ·  resume ${resumeLevelId(save)}`,
          textStyle('18px', UI.gold),
        )
        .setOrigin(0.5);
    }
    const buttons: MenuButton[] = [];

    const startCampaign = () => {
      if (this.scene.isPaused()) {
        return;
      }
      audio.unlock();
      resetSessionLives();
      this.scene.start('WorldMapScene');
    };

    const entries: Array<{ label: string; action: () => void }> = [
      { label: hasProgress ? 'CONTINUE' : 'PLAY', action: startCampaign },
      { label: 'PLAY WITH FRIENDS', action: () => this.scene.start('CoopScene') },
      { label: 'SKINS', action: () => launchOverlay(this, 'SkinsScene') },
      { label: 'SETTINGS', action: () => launchOverlay(this, 'SettingsScene') },
      { label: 'CREDITS', action: () => launchOverlay(this, 'CreditsScene') },
    ];
    const spacing = 60;
    const firstY = 626 - (entries.length - 1) * spacing;
    entries.forEach((entry, index) => {
      buttons.push(new MenuButton(this, GAME_WIDTH / 2, firstY + index * spacing, entry.label, entry.action));
    });

    new MenuNav(this, buttons);

    this.add
      .text(GAME_WIDTH / 2, 678, 'Tap a button     Arrows / WASD     Enter confirm', textStyle('18px', '#e8f0ff'))
      .setOrigin(0.5);
  }

  update(time: number, delta: number): void {
    void time;
    this.drift += delta * 0.02;
    this.parallax.update(this.drift);
  }

  private addHalloweenDressing(): void {
    this.paintPumpkinTexture('title-pumpkin', false);
    this.paintPumpkinTexture('title-jack', true);
    const props: Array<{ x: number; key: string; scale: number }> = [
      { x: 78, key: 'title-pumpkin', scale: 1.15 },
      { x: 168, key: 'title-jack', scale: 1 },
      { x: 1110, key: 'title-jack', scale: 1.05 },
      { x: 1204, key: 'title-pumpkin', scale: 1.2 },
    ];
    for (const prop of props) {
      const pumpkin = this.add.image(prop.x, 692, prop.key).setScale(prop.scale).setDepth(1).setOrigin(0.5, 1);
      if (prop.key === 'title-jack') {
        this.tweens.add({
          targets: pumpkin,
          alpha: 0.72,
          duration: 420,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }
    if (!this.textures.exists('enemy-swoop-bat-move')) {
      return;
    }
    const flock = [
      { y: 58, delay: 0, scale: 0.82, duration: 7600 },
      { y: 118, delay: 1400, scale: 0.58, duration: 6400 },
      { y: 86, delay: 2800, scale: 0.7, duration: 8200 },
    ];
    for (const bat of flock) {
      const sprite = this.add
        .image(-48, bat.y, 'enemy-swoop-bat-move')
        .setScale(bat.scale)
        .setDepth(2);
      this.tweens.add({
        targets: sprite,
        x: GAME_WIDTH + 64,
        duration: bat.duration,
        delay: bat.delay,
        repeat: -1,
      });
    }
  }

  private paintPumpkinTexture(key: string, face: boolean): void {
    if (this.textures.exists(key)) {
      return;
    }
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x2a1408, 1);
    g.fillEllipse(36, 46, 62, 52);
    g.fillStyle(face ? 0xff8a1a : 0xe06810, 1);
    g.fillEllipse(36, 44, 54, 46);
    g.fillStyle(0xc44808, 1);
    g.fillEllipse(24, 44, 16, 42);
    g.fillEllipse(36, 44, 16, 44);
    g.fillEllipse(48, 44, 16, 42);
    g.fillStyle(face ? 0xff9a32 : 0xe87818, 1);
    g.fillEllipse(28, 40, 8, 36);
    g.fillEllipse(44, 40, 8, 36);
    g.fillStyle(0x2f8a32, 1);
    g.fillRoundedRect(32, 16, 8, 14, 3);
    if (face) {
      g.fillStyle(0x1a0808, 1);
      g.fillTriangle(24, 38, 32, 38, 28, 48);
      g.fillTriangle(40, 38, 48, 38, 44, 48);
      g.fillTriangle(28, 54, 44, 54, 36, 62);
      g.fillStyle(0xffe08a, 0.85);
      g.fillTriangle(27, 42, 31, 42, 29, 46);
      g.fillTriangle(43, 42, 47, 42, 45, 46);
    }
    g.generateTexture(key, 72, 78);
    g.destroy();
  }
}
