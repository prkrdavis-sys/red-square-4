import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { loadSave, purchaseSkin, setEquippedSkin } from '../data/progress';
import { SKINS, type SkinDef } from '../data/skins';
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
  type MenuButtonTone,
} from '../ui/menu';
import {
  SKIN_SHOP_FILTERS,
  SKIN_SHOP_FILTER_ACCENT,
  skinMatchesFilter,
  skinShopCard,
  skinShopEmptyHint,
  skinShopFilterCounts,
  skinShopFilterLabel,
  skinShopTone,
  type SkinShopActionTone,
  type SkinShopFilter,
  type SkinShopSave,
} from '../ui/skin-shop';

interface OverlayData {
  returnKey?: string;
}

const COLUMNS = 7;
const CELL_W = 112;
const CELL_H = 102;
const FRAME_W = CELL_W - 12;
const FRAME_H = CELL_H - 14;
const BAND_H = 24;
const PANEL_H = 656;

interface SkinCell {
  skin: SkinDef;
  root: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Rectangle;
  rail: Phaser.GameObjects.Rectangle;
  band: Phaser.GameObjects.Rectangle;
  veil: Phaser.GameObjects.Rectangle;
  focusRing: Phaser.GameObjects.Rectangle;
  thumb: Phaser.GameObjects.Image;
  mystery: Phaser.GameObjects.Text;
  coin: Phaser.GameObjects.Image;
  badge: Phaser.GameObjects.Text;
}

interface FilterChip {
  filter: SkinShopFilter;
  root: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

export class SkinsScene extends Phaser.Scene {
  private returnKey = 'TitleScene';
  private cells: SkinCell[] = [];
  private chips: FilterChip[] = [];
  private filter: SkinShopFilter = 'all';
  private index = 0;
  private nameText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private emptyText!: Phaser.GameObjects.Text;
  private actionBtn!: MenuButton;
  private actionCoin!: Phaser.GameObjects.Image;
  private purse!: Phaser.GameObjects.Container;
  private onKey!: (event: KeyboardEvent) => void;
  private lastActivateAt = Number.NEGATIVE_INFINITY;

  constructor() {
    super('SkinsScene');
  }

  create(data: OverlayData): void {
    this.returnKey = data.returnKey ?? 'TitleScene';
    this.cells = [];
    this.chips = [];
    this.filter = 'all';
    beginOverlay(this);
    dimScreen(this, 0.66, () => this.goBack());
    applySettings(this);

    const save = loadSave();
    const panelW = COLUMNS * CELL_W + 48;
    const panel = addPanel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, panelW, PANEL_H, 'SKINS');
    dismissOnOutside(this, panel, () => this.goBack());

    this.purse = addCoinPurse(this, GAME_WIDTH / 2 + panelW / 2 - 100, GAME_HEIGHT / 2 - PANEL_H / 2 + 32, save.coins);

    const filterY = GAME_HEIGHT / 2 - PANEL_H / 2 + 72;
    const chipW = 176;
    const chipH = 38;
    const chipGap = 12;
    const chipRowW = SKIN_SHOP_FILTERS.length * chipW + (SKIN_SHOP_FILTERS.length - 1) * chipGap;
    SKIN_SHOP_FILTERS.forEach((filter, i) => {
      const x = GAME_WIDTH / 2 - chipRowW / 2 + chipW / 2 + i * (chipW + chipGap);
      this.chips.push(this.makeChip(x, filterY, chipW, chipH, filter));
    });

    SKINS.forEach((skin, i) => {
      this.cells.push(this.makeCell(skin, i));
    });

    const gridTop = filterY + 64;
    this.emptyText = this.add
      .text(GAME_WIDTH / 2, gridTop + CELL_H * 1.4, '', textStyle('20px', UI.muted))
      .setOrigin(0.5)
      .setDepth(82)
      .setVisible(false);

    const infoY = gridTop + 3 * CELL_H + 62;
    this.nameText = this.add.text(GAME_WIDTH / 2, infoY, '', textStyle('24px')).setOrigin(0.5).setDepth(82);
    this.hintText = this.add
      .text(GAME_WIDTH / 2, infoY + 30, '', textStyle('18px', UI.muted))
      .setOrigin(0.5)
      .setDepth(82);

    this.actionBtn = new MenuButton(this, GAME_WIDTH / 2 - 200, infoY + 78, 'EQUIP', () => this.activate(), 320);
    this.actionBtn.setDepth(85);
    this.actionCoin = this.add.image(GAME_WIDTH / 2 - 318, infoY + 78, 'coin').setScale(0.55).setDepth(86);
    const back = new MenuButton(this, GAME_WIDTH / 2 + 200, infoY + 78, 'BACK', () => this.goBack(), 320);
    back.setDepth(85);

    this.onKey = (event: KeyboardEvent) => this.handleKey(event);
    this.input.keyboard?.on('keydown', this.onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', this.onKey);
    });

    const equippedIndex = SKINS.findIndex((skin) => skin.id === save.equippedSkin);
    this.index = equippedIndex >= 0 ? equippedIndex : 0;
    this.refresh();
  }

  private makeChip(x: number, y: number, width: number, height: number, filter: SkinShopFilter): FilterChip {
    const frame = this.add.rectangle(0, 0, width, height, UI.buttonFill, 1).setStrokeStyle(3, UI.buttonStroke, 1);
    const accent = this.add.rectangle(-width / 2 + 5, 0, 8, height - 8, SKIN_SHOP_FILTER_ACCENT[filter], 1);
    const label = this.add.text(6, 0, '', textStyle('16px', UI.muted)).setOrigin(0.5);
    const root = this.add.container(x, y, [frame, accent, label]).setDepth(82);
    root.setSize(width, height);
    root.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    root.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch || !this.claimPointer()) {
        return;
      }
      this.setFilter(filter);
    });
    root.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.wasTouch || !this.claimPointer()) {
        return;
      }
      this.setFilter(filter);
    });
    return { filter, root, frame, label };
  }

  private makeCell(skin: SkinDef, index: number): SkinCell {
    const frame = this.add.rectangle(0, 0, FRAME_W, FRAME_H, UI.buttonFill, 1).setStrokeStyle(3, UI.buttonStroke, 1);
    const rail = this.add.rectangle(-FRAME_W / 2 + 5, 0, 8, FRAME_H - 6, 0x3a2428, 1);
    const band = this.add.rectangle(0, FRAME_H / 2 - BAND_H / 2, FRAME_W, BAND_H, 0x1c1014, 1);
    const veil = this.add.rectangle(0, -10, FRAME_W - 4, FRAME_H - BAND_H - 4, 0x080508, 0.55).setVisible(false);
    const focusRing = this.add
      .rectangle(0, 0, FRAME_W + 10, FRAME_H + 10, 0x000000, 0)
      .setStrokeStyle(4, 0xffd0a8, 1)
      .setVisible(false);
    const thumb = this.add.image(0, -12, skinThumbKey(skin.id)).setScale(1.2);
    const mystery = this.add.text(0, -12, '?', textStyle('26px', UI.gold)).setOrigin(0.5);
    const coin = this.add.image(0, FRAME_H / 2 - BAND_H / 2, 'coin').setScale(0.38);
    const badge = this.add
      .text(0, FRAME_H / 2 - BAND_H / 2, '', textStyle('15px', UI.gold))
      .setOrigin(0.5);
    const root = this.add
      .container(0, 0, [frame, rail, band, thumb, veil, mystery, coin, badge, focusRing])
      .setDepth(80);
    root.setSize(FRAME_W, FRAME_H);
    root.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-FRAME_W / 2, -FRAME_H / 2, FRAME_W, FRAME_H),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    root.on('pointerover', () => this.select(index, false));
    root.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.wasTouch || !this.claimPointer()) {
        return;
      }
      this.select(index, true);
    });
    root.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch || !this.claimPointer()) {
        return;
      }
      this.select(index, true);
    });
    return { skin, root, frame, rail, band, veil, focusRing, thumb, mystery, coin, badge };
  }

  private snapshot(): SkinShopSave {
    const save = loadSave();
    return {
      cleared: save.cleared,
      purchasedSkins: save.purchasedSkins,
      equippedSkin: save.equippedSkin,
      coins: save.coins,
    };
  }

  private visibleCells(save: SkinShopSave = this.snapshot()): SkinCell[] {
    return this.cells.filter((cell) => skinMatchesFilter(skinShopTone(cell.skin, save), this.filter));
  }

  private setFilter(filter: SkinShopFilter): void {
    if (filter === this.filter) {
      return;
    }
    audio.play(this, 'map');
    this.filter = filter;
    const save = this.snapshot();
    const visible = this.visibleCells(save);
    const current = this.cells[this.index];
    const keep = current && visible.includes(current);
    if (!keep) {
      const equipped = visible.find((cell) => cell.skin.id === save.equippedSkin);
      this.index = this.cells.indexOf(equipped ?? visible[0] ?? this.cells[0]!);
    }
    this.refresh();
  }

  private select(index: number, playSound: boolean): void {
    if (index < 0 || index >= this.cells.length) {
      return;
    }
    const save = this.snapshot();
    if (!skinMatchesFilter(skinShopTone(this.cells[index]!.skin, save), this.filter)) {
      return;
    }
    if (playSound && index !== this.index) {
      audio.play(this, 'map');
    }
    this.index = index;
    this.refresh();
  }

  private moveVisible(delta: number): void {
    const visible = this.visibleCells();
    if (visible.length === 0) {
      return;
    }
    const current = this.cells[this.index];
    const here = Math.max(0, visible.findIndex((cell) => cell === current));
    const next = visible[(here + delta + visible.length) % visible.length];
    if (!next) {
      return;
    }
    this.select(this.cells.indexOf(next), true);
  }

  private refresh(): void {
    const save = this.snapshot();
    const counts = skinShopFilterCounts(SKINS, save);
    const visible = this.visibleCells(save);
    const gridTop = GAME_HEIGHT / 2 - PANEL_H / 2 + 136;
    const gridLeft = GAME_WIDTH / 2 - ((COLUMNS - 1) * CELL_W) / 2;

    this.chips.forEach((chip) => {
      const active = chip.filter === this.filter;
      chip.label.setText(skinShopFilterLabel(chip.filter, counts[chip.filter]));
      chip.label.setColor(active ? UI.gold : UI.muted);
      chip.frame.setFillStyle(active ? UI.buttonFocus : UI.buttonFill, 1);
      chip.frame.setStrokeStyle(3, active ? 0xffd0a8 : UI.buttonStroke, 1);
    });

    this.cells.forEach((cell) => {
      const card = skinShopCard(cell.skin, save);
      const shown = skinMatchesFilter(card.tone, this.filter);
      cell.root.setVisible(shown);
      if (shown) {
        cell.root.setInteractive({
          hitArea: new Phaser.Geom.Rectangle(-FRAME_W / 2, -FRAME_H / 2, FRAME_W, FRAME_H),
          hitAreaCallback: Phaser.Geom.Rectangle.Contains,
          useHandCursor: true,
        });
      } else {
        cell.root.disableInteractive();
      }
      cell.frame.setFillStyle(card.fill, 1);
      cell.frame.setStrokeStyle(card.strokeWidth, card.stroke, 1);
      cell.rail.setFillStyle(card.stroke, 1);
      cell.band.setFillStyle(card.band, 1);
      cell.veil.setVisible(card.hidden);
      cell.badge.setText(card.badge);
      cell.badge.setColor(card.badgeColor);
      cell.mystery.setVisible(card.hidden);
      cell.coin.setVisible(card.showCoin);
      if (card.hidden) {
        cell.thumb.setTintFill(0x1a1216);
      } else {
        cell.thumb.clearTint();
      }
      const bandY = FRAME_H / 2 - BAND_H / 2;
      if (card.showCoin) {
        const pairW = cell.badge.width + 16;
        cell.coin.setPosition(-pairW / 2 + 5, bandY);
        cell.badge.setPosition(pairW / 2 - 4, bandY);
      } else {
        cell.badge.setPosition(0, bandY);
      }
    });

    visible.forEach((cell, i) => {
      cell.root.setPosition(gridLeft + (i % COLUMNS) * CELL_W, gridTop + Math.floor(i / COLUMNS) * CELL_H);
    });

    const focused = this.cells[this.index];
    this.cells.forEach((cell) => {
      cell.focusRing.setVisible(cell === focused && visible.includes(cell));
    });

    setCoinPurseAmount(this.purse, save.coins);

    if (!focused || visible.length === 0) {
      this.emptyText.setText(skinShopEmptyHint(this.filter)).setVisible(true);
      this.nameText.setText('');
      this.hintText.setText('');
      this.actionBtn.setVisible(false);
      this.actionCoin.setVisible(false);
      return;
    }

    const card = skinShopCard(focused.skin, save);
    this.emptyText.setVisible(false);
    this.nameText.setText(card.displayName);
    this.nameText.setColor(card.nameColor);
    this.hintText.setText(card.hint);
    this.actionBtn.setVisible(true);
    this.actionBtn.setLabel(card.actionLabel);
    this.actionBtn.setTone(actionButtonTone(card.actionTone));
    this.actionCoin.setVisible(card.actionTone === 'buy');
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
    const save = this.snapshot();
    if (!skinMatchesFilter(skinShopTone(cell.skin, save), this.filter)) {
      return;
    }
    const card = skinShopCard(cell.skin, save);
    switch (card.status) {
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
        this.keepSelectionVisible();
        this.refresh();
        return;
      }
      case 'locked-course':
      case 'locked-boss':
        audio.play(this, 'hurt');
        return;
      default: {
        const neverStatus: never = card.status;
        return neverStatus;
      }
    }
  }

  private keepSelectionVisible(): void {
    const save = this.snapshot();
    const visible = this.visibleCells(save);
    const current = this.cells[this.index];
    if (current && visible.includes(current)) {
      return;
    }
    const equipped = visible.find((cell) => cell.skin.id === save.equippedSkin);
    this.index = this.cells.indexOf(equipped ?? visible[0] ?? this.cells[0]!);
  }

  private handleKey(event: KeyboardEvent): void {
    switch (event.code) {
      case 'ArrowLeft':
      case 'KeyA':
        event.preventDefault();
        this.moveVisible(-1);
        break;
      case 'ArrowRight':
      case 'KeyD':
        event.preventDefault();
        this.moveVisible(1);
        break;
      case 'ArrowUp':
      case 'KeyW':
        event.preventDefault();
        this.moveVisible(-COLUMNS);
        break;
      case 'ArrowDown':
      case 'KeyS':
        event.preventDefault();
        this.moveVisible(COLUMNS);
        break;
      case 'KeyQ':
        event.preventDefault();
        this.cycleFilter(-1);
        break;
      case 'KeyE':
        event.preventDefault();
        this.cycleFilter(1);
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

  private cycleFilter(dir: -1 | 1): void {
    const here = SKIN_SHOP_FILTERS.indexOf(this.filter);
    const next = SKIN_SHOP_FILTERS[(here + dir + SKIN_SHOP_FILTERS.length) % SKIN_SHOP_FILTERS.length];
    if (next) {
      this.setFilter(next);
    }
  }

  private goBack(): void {
    closeOverlay(this, this.returnKey);
  }
}

function actionButtonTone(tone: SkinShopActionTone): MenuButtonTone {
  switch (tone) {
    case 'equip':
      return 'default';
    case 'buy':
      return 'gold';
    case 'muted':
      return 'muted';
    default: {
      const neverTone: never = tone;
      return neverTone;
    }
  }
}
