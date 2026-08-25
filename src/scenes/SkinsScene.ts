import Phaser from 'phaser';
import { parseLevelId, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { loadSave, purchaseSkin, setEquippedSkin } from '../data/progress';
import { isBossRewardSkin, SKINS, skinShopStatus, type SkinDef, type SkinShopStatus } from '../data/skins';
import { applySettings } from '../data/settings';
import { audio } from '../systems/audio';
import { applySkin, skinThumbKey } from '../systems/textures';
import {
  addCoinPurse,
  addPanel,
  beginOverlay,
  closeOverlay,
  dimScreen,
  dismissOnOutside,
  MenuButton,
  setCoinPurseAmount,
  shouldAcceptTap,
  textStyle,
  UI,
} from '../ui/menu';

interface OverlayData {
  returnKey?: string;
}

const COLUMNS = 7;
const CELL_W = 118;
const CELL_H = 116;

interface SkinCell {
  skin: SkinDef;
  frame: Phaser.GameObjects.Rectangle;
  thumb: Phaser.GameObjects.Image;
  mystery: Phaser.GameObjects.Text;
  badge: Phaser.GameObjects.Text;
}

export class SkinsScene extends Phaser.Scene {
  private returnKey = 'TitleScene';
  private cells: SkinCell[] = [];
  private index = 0;
  private nameText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private summaryText!: Phaser.GameObjects.Text;
  private actionBtn!: MenuButton;
  private purse!: Phaser.GameObjects.Container;
  private onKey!: (event: KeyboardEvent) => void;
  private lastActivateAt = Number.NEGATIVE_INFINITY;

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
    const panelW = COLUMNS * CELL_W + 60;
    const panelH = rows * CELL_H + 264;
    const panel = addPanel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, panelW, panelH, 'SKINS');
    dismissOnOutside(this, panel, () => this.goBack());

    this.summaryText = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - (rows * CELL_H) / 2 - 84,
        '',
        textStyle('18px', UI.muted),
      )
      .setOrigin(0.5)
      .setDepth(80);

    this.purse = addCoinPurse(this, GAME_WIDTH / 2 + panelW / 2 - 100, GAME_HEIGHT / 2 - panelH / 2 + 32, save.coins);

    const gridLeft = GAME_WIDTH / 2 - ((COLUMNS - 1) * CELL_W) / 2;
    const gridTop = GAME_HEIGHT / 2 - ((rows - 1) * CELL_H) / 2 - 34;

    SKINS.forEach((skin, i) => {
      const x = gridLeft + (i % COLUMNS) * CELL_W;
      const y = gridTop + Math.floor(i / COLUMNS) * CELL_H;
      const status = skinShopStatus(skin, save);

      const frame = this.add
        .rectangle(x, y, CELL_W - 14, CELL_H - 18, UI.buttonFill, 1)
        .setStrokeStyle(3, UI.buttonStroke, 1)
        .setDepth(80)
        .setInteractive({ useHandCursor: true });
      frame.on('pointerover', () => this.select(i, false));
      frame.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (!pointer.wasTouch || !this.claimPointer()) {
          return;
        }
        this.select(i, false);
        this.activate();
      });
      frame.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        if (pointer.wasTouch || !this.claimPointer()) {
          return;
        }
        this.select(i, false);
        this.activate();
      });

      const thumb = this.add.image(x, y - 8, skinThumbKey(skin.id)).setScale(1.25).setDepth(81);
      const mystery = this.add.text(x, y - 8, '?', textStyle('26px', UI.gold)).setOrigin(0.5).setDepth(82);
      mystery.setVisible(status === 'locked-course' || status === 'locked-boss');

      const badge = this.add
        .text(x, y + 34, '', textStyle('14px', UI.gold))
        .setOrigin(0.5)
        .setDepth(82);

      this.cells.push({ skin, frame, thumb, mystery, badge });
    });

    const infoY = GAME_HEIGHT / 2 + (rows * CELL_H) / 2 + 6;
    this.nameText = this.add.text(GAME_WIDTH / 2, infoY, '', textStyle('24px')).setOrigin(0.5).setDepth(82);
    this.hintText = this.add
      .text(GAME_WIDTH / 2, infoY + 32, '', textStyle('18px', UI.muted))
      .setOrigin(0.5)
      .setDepth(82);

    this.actionBtn = new MenuButton(this, GAME_WIDTH / 2 - 200, infoY + 82, 'EQUIP', () => this.activate(), 320);
    this.actionBtn.setDepth(85);
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
    const save = loadSave();
    this.cells.forEach((cell, i) => {
      const focused = i === this.index;
      const status = skinShopStatus(cell.skin, save);
      cell.frame.setFillStyle(focused ? UI.buttonFocus : UI.buttonFill, 1);
      cell.frame.setStrokeStyle(3, focused ? 0xffd0a8 : UI.buttonStroke, 1);
      cell.badge.setText(this.badgeText(cell.skin, status, save.equippedSkin));
      cell.badge.setColor(cell.skin.id === save.equippedSkin ? UI.gold : UI.muted);
      const hidden = status === 'locked-course' || status === 'locked-boss';
      cell.mystery.setVisible(hidden);
      if (hidden) {
        cell.thumb.setTintFill(0x2a2028);
      } else {
        cell.thumb.clearTint();
      }
    });

    const cell = this.cells[this.index];
    if (!cell) {
      return;
    }
    const status = skinShopStatus(cell.skin, save);
    this.nameText.setText(this.displayName(cell.skin, status));
    this.nameText.setColor(status === 'owned' || status === 'for-sale' ? UI.text : UI.muted);
    this.hintText.setText(this.hintFor(cell.skin, status, save.coins));
    this.actionBtn.setLabel(this.actionLabel(cell.skin, status, save.equippedSkin, save.coins));
    setCoinPurseAmount(this.purse, save.coins);
    const ownedCount = SKINS.filter((skin) => skinShopStatus(skin, save) === 'owned').length;
    this.summaryText.setText(
      `${ownedCount} / ${SKINS.length} owned  ·  clear a course, then buy  ·  x-4 from bosses`,
    );
  }

  private badgeText(skin: SkinDef, status: SkinShopStatus, equipped: string): string {
    if (skin.id === equipped) {
      return 'EQUIPPED';
    }
    switch (status) {
      case 'owned':
        return '';
      case 'for-sale':
        return `${skin.cost ?? 0}`;
      case 'locked-course':
      case 'locked-boss':
        return 'LOCKED';
      default: {
        const neverStatus: never = status;
        return neverStatus;
      }
    }
  }

  private displayName(skin: SkinDef, status: SkinShopStatus): string {
    switch (status) {
      case 'owned':
      case 'for-sale':
        return skin.name;
      case 'locked-course':
      case 'locked-boss':
        return '???';
      default: {
        const neverStatus: never = status;
        return neverStatus;
      }
    }
  }

  private hintFor(skin: SkinDef, status: SkinShopStatus, coins: number): string {
    switch (status) {
      case 'owned':
        return skin.level
          ? isBossRewardSkin(skin)
            ? `Won by beating the World ${parseLevelId(skin.level).world} boss`
            : `Cleared ${skin.level}  ·  bought for ${skin.cost ?? 0} coins`
          : 'Available from the start';
      case 'for-sale':
        return coins >= (skin.cost ?? 0)
          ? `Cleared ${skin.level}  ·  buy for ${skin.cost ?? 0} coins`
          : `Need ${skin.cost ?? 0} coins  ·  you have ${coins}`;
      case 'locked-course':
        return `Clear ${skin.level} to buy for ${skin.cost ?? 0} coins`;
      case 'locked-boss':
        return skin.level
          ? `Beat the World ${parseLevelId(skin.level).world} boss to unlock`
          : 'Beat the world boss to unlock';
      default: {
        const neverStatus: never = status;
        return neverStatus;
      }
    }
  }

  private actionLabel(skin: SkinDef, status: SkinShopStatus, equipped: string, coins: number): string {
    switch (status) {
      case 'owned':
        return skin.id === equipped ? 'EQUIPPED' : 'EQUIP';
      case 'for-sale':
        return coins >= (skin.cost ?? 0) ? `BUY ${skin.cost ?? 0}` : 'NEED COINS';
      case 'locked-course':
      case 'locked-boss':
        return 'LOCKED';
      default: {
        const neverStatus: never = status;
        return neverStatus;
      }
    }
  }

  private claimPointer(): boolean {
    const now = performance.now();
    if (!shouldAcceptTap(this.lastActivateAt, now)) {
      return false;
    }
    this.lastActivateAt = now;
    return true;
  }

  private activate(): void {
    const cell = this.cells[this.index];
    if (!cell) {
      return;
    }
    const save = loadSave();
    const status = skinShopStatus(cell.skin, save);
    switch (status) {
      case 'owned':
        if (cell.skin.id === save.equippedSkin) {
          audio.play(this, 'select');
          return;
        }
        setEquippedSkin(cell.skin.id);
        applySkin(this, cell.skin.id);
        audio.play(this, 'select');
        this.refresh();
        return;
      case 'for-sale': {
        const result = purchaseSkin(cell.skin.id);
        if (!result.ok) {
          audio.play(this, 'hurt');
          this.refresh();
          return;
        }
        audio.play(this, 'select');
        this.refresh();
        return;
      }
      case 'locked-course':
      case 'locked-boss':
        audio.play(this, 'hurt');
        return;
      default: {
        const neverStatus: never = status;
        return neverStatus;
      }
    }
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
        this.activate();
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
