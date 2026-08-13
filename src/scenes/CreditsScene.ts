import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { addPanel, closeOverlay, dimScreen, MenuButton, MenuNav, textStyle, UI } from '../ui/menu';

interface OverlayData {
  returnKey?: string;
}

const LINES = [
  'Original red square, circle baddies, and bosses.',
  '',
  'Kenney.nl  ·  CC0 tiles, backgrounds, jingles, SFX',
  'New Platformer Pack  ·  Platformer Art Deluxe',
  'Background Elements  ·  Music Jingles  ·  Digital Audio',
  '',
  'Luis Zuno @ansimuz  ·  public-domain ocean pack',
  '',
  'Engine  ·  Phaser 3 Arcade Physics',
  '',
  'Not a Nintendo remake. No Mario, Goomba, or Bowser art.',
];

export class CreditsScene extends Phaser.Scene {
  private returnKey = 'TitleScene';

  constructor() {
    super('CreditsScene');
  }

  create(data: OverlayData): void {
    this.returnKey = data.returnKey ?? 'TitleScene';
    dimScreen(this, 0.62);
    addPanel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 720, 560, 'CREDITS');

    this.add
      .text(GAME_WIDTH / 2, 228, LINES.join('\n'), {
        ...textStyle('18px', UI.muted),
        align: 'center',
        lineSpacing: 6,
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0)
      .setDepth(80);

    const back = new MenuButton(this, GAME_WIDTH / 2, 600, 'BACK', () => closeOverlay(this, this.returnKey));
    new MenuNav(this, [back], () => closeOverlay(this, this.returnKey));
  }
}
