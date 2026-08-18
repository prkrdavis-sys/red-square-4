import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { loadSave, setEquippedSkin } from '../data/progress';
import { isSkinUnlocked, SKINS, type SkinDef } from '../data/skins';
import { applySettings } from '../data/settings';
import { audio } from '../systems/audio';
import { applySkin, skinThumbKey } from '../systems/textures';
import { addPanel, beginOverlay, closeOverlay, dimScreen, dismissOnOutside, MenuButton, textStyle, UI } from '../ui/menu';

interface OverlayData {
  returnKey?: string;
}

const COLUMNS = 7;
const CELL_W = 118;
const CELL_H = 116;

interface SkinCell {
  skin: SkinDef;
  unlocked: boolean;
  frame: Phaser.GameObjects.Rectangle;
  thumb: Phaser.GameObjects.Image;
  badge: Phaser.GameObjects.Text;
}

export class SkinsScene extends Phaser.Scene {
  private returnKey = 'TitleScene';
  private cells: SkinCell[] = [];
  private index = 0;
  private nameText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private equipBtn!: MenuButton;
  private onKey!: (event: KeyboardEvent) => void;

  constructor() {
    super('SkinsScene');
  }

  create(data: OverlayData): void {
    this.returnKey = data.returnKey ?? 'TitleScene';
    this.cells = [];
    beginOverlay(this);
    dimScreen(this, 0.66, () => this.goBack());
    applySettings(this);

    const save = loadSave();
    const rows = Math.ceil(SKINS.length / COLUMNS);
    const panel = addPanel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, COLUMNS * CELL_W + 60, rows * CELL_H + 264, 'SKINS');
    dismissOnOutside(this, panel, () => this.goBack());

    const unlockedCount = SKINS.filter((skin) => isSkinUnlocked(skin, save)).length;
    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - (rows * CELL_H) / 2 - 84,
        `${unlockedCount} / ${SKINS.length} unlocked  ·  clear a level to earn its skin`,
        textStyle('16px', UI.muted),
      )
      .setOrigin(0.5)
      .setDepth(80);

    const gridLeft = GAME_WIDTH / 2 - ((COLUMNS - 1) * CELL_W) / 2;
    const gridTop = GAME_HEIGHT / 2 - ((rows - 1) * CELL_H) / 2 - 34;

    SKINS.forEach((skin, i) => {
      const x = gridLeft + (i % COLUMNS) * CELL_W;
      const y = gridTop + Math.floor(i / COLUMNS) * CELL_H;
      const unlocked = isSkinUnlocked(skin, save);

      const frame = this.add
        .rectangle(x, y, CELL_W - 14, CELL_H - 18, UI.buttonFill, 1)
        .setStrokeStyle(3, UI.buttonStroke, 1)
        .setDepth(80)
        .setInteractive({ useHandCursor: true });
      frame.on('pointerover', () => this.select(i, false));
      frame.on('pointerup', () => {
        this.select(i, false);
        this.equip();
      });

      const thumb = this.add.image(x, y - 8, skinThumbKey(skin.id)).setScale(1.25).setDepth(81);
      if (!unlocked) {
        thumb.setTintFill(0x2a2028);
      }
      if (!unlocked) {
        this.add.text(x, y - 8, '?', textStyle('26px', UI.gold)).setOrigin(0.5).setDepth(82);
      }

      const badge = this.add
        .text(x, y + 34, '', textStyle('13px', UI.gold))
        .setOrigin(0.5)
        .setDepth(82);

      this.cells.push({ skin, unlocked, frame, thumb, badge });
    });

    const infoY = GAME_HEIGHT / 2 + (rows * CELL_H) / 2 + 6;
    this.nameText = this.add.text(GAME_WIDTH / 2, infoY, '', textStyle('24px')).setOrigin(0.5).setDepth(82);
    this.hintText = this.add
      .text(GAME_WIDTH / 2, infoY + 32, '', textStyle('16px', UI.muted))
      .setOrigin(0.5)
      .setDepth(82);

    this.equipBtn = new MenuButton(this, GAME_WIDTH / 2 - 200, infoY + 82, 'EQUIP', () => this.equip(), 320);
    this.equipBtn.setDepth(85);
    const back = new MenuButton(this, GAME_WIDTH / 2 + 200, infoY + 82, 'BACK', () => this.goBack(), 320);
    back.setDepth(85);

    this.onKey = (event: KeyboardEvent) => this.handleKey(event);
    this.input.keyboard?.on('keydown', this.onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', this.onKey);
    });

    const equippedIndex = SKINS.findIndex((skin) => skin.id === save.equippedSkin);
    this.select(equippedIndex >= 0 ? equippedIndex : 0, false);
  }

  private select(index: number, playSound: boolean): void {
    if (index < 0 || index >= this.cells.length) {
      return;
    }
    if (playSound && index !== this.index) {
      audio.play(this, 'map');
    }
    this.index = index;
    this.refresh();
  }

  private refresh(): void {
    const equipped = loadSave().equippedSkin;
    this.cells.forEach((cell, i) => {
      const focused = i === this.index;
      cell.frame.setFillStyle(focused ? UI.buttonFocus : UI.buttonFill, 1);
      cell.frame.setStrokeStyle(3, focused ? 0xffd0a8 : UI.buttonStroke, 1);
      cell.badge.setText(cell.skin.id === equipped ? 'EQUIPPED' : cell.unlocked ? '' : 'LOCKED');
      cell.badge.setColor(cell.skin.id === equipped ? UI.gold : UI.muted);
    });

    const cell = this.cells[this.index];
    if (!cell) {
      return;
    }
    this.nameText.setText(cell.unlocked ? cell.skin.name : '???');
    this.nameText.setColor(cell.unlocked ? UI.text : UI.muted);
    this.hintText.setText(
      cell.unlocked
        ? cell.skin.level
          ? `Earned by clearing ${cell.skin.level}`
          : 'Available from the start'
        : `Clear ${cell.skin.level} to unlock`,
    );
    this.equipBtn.setLabel(
      cell.skin.id === equipped ? 'EQUIPPED' : cell.unlocked ? 'EQUIP' : 'LOCKED',
    );
  }

  private equip(): void {
    const cell = this.cells[this.index];
    if (!cell || !cell.unlocked) {
      audio.play(this, 'hurt');
      return;
    }
    setEquippedSkin(cell.skin.id);
    applySkin(this, cell.skin.id);
    audio.play(this, 'select');
    this.refresh();
  }

  private handleKey(event: KeyboardEvent): void {
    switch (event.code) {
      case 'ArrowLeft':
      case 'KeyA':
        event.preventDefault();
        this.select((this.index + this.cells.length - 1) % this.cells.length, true);
        break;
      case 'ArrowRight':
      case 'KeyD':
        event.preventDefault();
        this.select((this.index + 1) % this.cells.length, true);
        break;
      case 'ArrowUp':
      case 'KeyW':
        event.preventDefault();
        this.select((this.index + this.cells.length - COLUMNS) % this.cells.length, true);
        break;
      case 'ArrowDown':
      case 'KeyS':
        event.preventDefault();
        this.select((this.index + COLUMNS) % this.cells.length, true);
        break;
      case 'Enter':
      case 'Space':
        event.preventDefault();
        this.equip();
        break;
      case 'Escape':
        event.preventDefault();
        this.goBack();
        break;
      default:
        break;
    }
  }

  private goBack(): void {
    closeOverlay(this, this.returnKey);
  }
}
