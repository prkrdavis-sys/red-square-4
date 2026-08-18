import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { addPanel, beginOverlay, closeOverlay, dimScreen, dismissOnOutside, MenuButton, MenuNav, textStyle, UI } from '../ui/menu';

interface OverlayData {
  returnKey?: string;
}

const LINES = [
  'Original campaign, creature roles, boss phases, and encounters.',
  '',
  'Kenney.nl  ·  CC0 creature sprites, tiles, jingles, SFX',
  'New Platformer Pack  ·  Platformer Art Deluxe',
  'Background Elements  ·  Music Jingles  ·  Digital Audio',
  '',
  'Luis Zuno @ansimuz  ·  public-domain ocean pack',
  '',
  'Engine  ·  Phaser 3 Arcade Physics',
  '',
  'Original platforming campaign. No Nintendo art or level layouts.',
];

export class CreditsScene extends Phaser.Scene {
  private returnKey = 'TitleScene';

  constructor() {
    super('CreditsScene');
  }

  create(data: OverlayData): void {
    this.returnKey = data.returnKey ?? 'TitleScene';
    beginOverlay(this);
    dimScreen(this, 0.62, () => closeOverlay(this, this.returnKey));
    const panel = addPanel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 720, 560, 'CREDITS');
    dismissOnOutside(this, panel, () => closeOverlay(this, this.returnKey));

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
