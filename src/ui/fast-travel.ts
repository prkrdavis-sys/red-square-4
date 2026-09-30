import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, THEMES, themeName, themeSky, type LevelId } from '../config';
import { audio } from '../systems/audio';
import { isIslandFogged } from '../systems/world-map-layout';
import { shouldAcceptTap, textStyle, UI } from './menu';

const BUTTON_W = 340;
const BUTTON_H = 44;
const ROW_H = 36;
const LIST_PAD = 8;
const LIST_H = THEMES.length * ROW_H + LIST_PAD * 2;

interface TravelRow {
  world: number;
  locked: boolean;
  root: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

/** Dropdown on the world map that jumps the token to a reached world. */
export class WorldFastTravelMenu {
  readonly buttonX: number;
  readonly buttonY: number;
  private openState = false;
  private world = 1;
  private highlight = 1;
  private lastToggleAt = Number.NEGATIVE_INFINITY;
  private readonly rows: TravelRow[] = [];
  private readonly label: Phaser.GameObjects.Text;
  private readonly chevron: Phaser.GameObjects.Text;
  private readonly listBg: Phaser.GameObjects.Rectangle;
  private readonly listFrame: Phaser.GameObjects.Rectangle;
  private readonly blocker: Phaser.GameObjects.Zone;
  private readonly onKey: (event: KeyboardEvent) => void;

  constructor(
    private readonly scene: Phaser.Scene,
    cleared: readonly LevelId[],
    world: number,
    private readonly onChoose: (world: number) => void,
  ) {
    this.world = world;
    this.highlight = world;
    this.buttonX = 16 + BUTTON_W / 2;
    this.buttonY = 48;

    this.blocker = scene.add
      .zone(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT)
      .setScrollFactor(0)
      .setDepth(99);
    this.blocker.on('pointerdown', () => this.close(true));

    const trigger = scene.add.container(this.buttonX, this.buttonY).setScrollFactor(0).setDepth(102);
    const bg = scene.add.rectangle(0, 0, BUTTON_W, BUTTON_H, UI.buttonFill, 1);
    const border = scene.add.rectangle(0, 0, BUTTON_W, BUTTON_H, UI.buttonFill, 0).setStrokeStyle(3, UI.buttonStroke, 1);
    this.label = scene.add.text(-BUTTON_W / 2 + 16, 0, 'FAST TRAVEL', textStyle('18px')).setOrigin(0, 0.5);
    this.chevron = scene.add.text(BUTTON_W / 2 - 16, 0, '▾', textStyle('18px', UI.gold)).setOrigin(1, 0.5);
    trigger.add([bg, border, this.label, this.chevron]);
    trigger.setSize(BUTTON_W, BUTTON_H);
    trigger.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(0, 0, BUTTON_W, BUTTON_H),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    trigger.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.wasTouch) {
        this.toggle();
      }
    });
    trigger.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch) {
        this.toggle();
      }
    });

    const listY = this.buttonY + BUTTON_H / 2 + 6 + LIST_H / 2;
    this.listBg = scene.add
      .rectangle(this.buttonX, listY, BUTTON_W, LIST_H, UI.panelFill, 0.98)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);
    this.listFrame = scene.add
      .rectangle(this.buttonX, listY, BUTTON_W, LIST_H, UI.panelFill, 0)
      .setStrokeStyle(3, UI.panelStroke, 1)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

    THEMES.forEach((theme, index) => {
      const worldNumber = index + 1;
      const locked = isIslandFogged(worldNumber, cleared);
      const y = listY - LIST_H / 2 + LIST_PAD + ROW_H / 2 + index * ROW_H;
      const row = scene.add.container(this.buttonX, y).setScrollFactor(0).setDepth(101).setVisible(false);
      const rowBg = scene.add.rectangle(0, 0, BUTTON_W - 12, ROW_H - 4, UI.buttonFill, 1);
      const swatch = scene.add
        .rectangle(-BUTTON_W / 2 + 22, 0, 10, 18, themeSky(theme), locked ? 0.35 : 1)
        .setStrokeStyle(1, 0xfff4d0, locked ? 0.25 : 0.7);
      const rowLabel = scene.add
        .text(-BUTTON_W / 2 + 36, 0, `${worldNumber}   ${themeName(theme)}`, textStyle('16px'))
        .setOrigin(0, 0.5);
      const kids: Phaser.GameObjects.GameObject[] = [rowBg, swatch, rowLabel];
      if (locked) {
        kids.push(
          scene.add.text(BUTTON_W / 2 - 18, 0, 'LOCKED', textStyle('13px', UI.muted)).setOrigin(1, 0.5),
        );
      }
      row.add(kids);
      row.setSize(BUTTON_W - 12, ROW_H - 4);
      if (!locked) {
        row.setInteractive({
          hitArea: new Phaser.Geom.Rectangle(0, 0, BUTTON_W - 12, ROW_H - 4),
          hitAreaCallback: Phaser.Geom.Rectangle.Contains,
          useHandCursor: true,
        });
        row.on('pointerover', () => {
          this.highlight = worldNumber;
          this.paint();
        });
        row.on('pointerup', (pointer: Phaser.Input.Pointer) => {
          if (!pointer.wasTouch) {
            this.choose(worldNumber);
          }
        });
        row.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          if (pointer.wasTouch) {
            this.choose(worldNumber);
          }
        });
      }
      this.rows.push({ world: worldNumber, locked, root: row, bg: rowBg, label: rowLabel });
    });

    this.onKey = (event: KeyboardEvent) => this.handleKey(event);
    scene.input.keyboard?.on('keydown', this.onKey);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.keyboard?.off('keydown', this.onKey);
    });
    this.paint();
    this.applyOpenChrome();
  }

  get open(): boolean {
    return this.openState;
  }

  setWorld(world: number): void {
    if (world === this.world) {
      return;
    }
    this.world = world;
    if (!this.openState) {
      this.highlight = world;
    }
    this.paint();
  }

  close(playSound: boolean): void {
    if (!this.openState) {
      return;
    }
    this.openState = false;
    this.highlight = this.world;
    this.applyOpenChrome();
    this.paint();
    if (playSound) {
      audio.play(this.scene, 'map');
    }
  }

  /** Enter / Space while the list is open. Returns true when the key should not start a course. */
  confirm(): boolean {
    if (!this.openState) {
      return false;
    }
    const row = this.rows.find((item) => item.world === this.highlight);
    if (row && !row.locked) {
      this.close(false);
      this.onChoose(row.world);
    }
    return true;
  }

  private toggle(): void {
    if (this.scene.scene.isPaused()) {
      return;
    }
    const now = performance.now();
    if (!shouldAcceptTap(this.lastToggleAt, now)) {
      return;
    }
    this.lastToggleAt = now;
    this.openState = !this.openState;
    if (this.openState) {
      this.highlight = this.rows.some((row) => row.world === this.world && !row.locked)
        ? this.world
        : (this.rows.find((row) => !row.locked)?.world ?? this.world);
    }
    audio.play(this.scene, 'map');
    this.applyOpenChrome();
    this.paint();
  }

  private choose(world: number): void {
    if (!this.openState || this.scene.scene.isPaused()) {
      return;
    }
    const row = this.rows.find((item) => item.world === world);
    if (!row || row.locked) {
      return;
    }
    const now = performance.now();
    if (!shouldAcceptTap(this.lastToggleAt, now)) {
      return;
    }
    this.lastToggleAt = now;
    this.close(false);
    this.onChoose(world);
  }

  private handleKey(event: KeyboardEvent): void {
    if (!this.openState || this.scene.scene.isPaused()) {
      return;
    }
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        event.preventDefault();
        this.move(-1);
        break;
      case 'ArrowDown':
      case 'KeyS':
        event.preventDefault();
        this.move(1);
        break;
      default:
        break;
    }
  }

  private move(dir: -1 | 1): void {
    const count = this.rows.length;
    let index = this.rows.findIndex((row) => row.world === this.highlight);
    if (index < 0) {
      index = 0;
    }
    for (let step = 0; step < count; step += 1) {
      index = (index + dir + count) % count;
      const row = this.rows[index];
      if (row && !row.locked) {
        this.highlight = row.world;
        audio.play(this.scene, 'map');
        this.paint();
        return;
      }
    }
  }

  private applyOpenChrome(): void {
    const show = this.openState;
    this.listBg.setVisible(show);
    this.listFrame.setVisible(show);
    this.chevron.setText(show ? '▴' : '▾');
    if (show) {
      this.blocker.setInteractive();
      this.listBg.setInteractive({
        hitArea: new Phaser.Geom.Rectangle(0, 0, BUTTON_W, LIST_H),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      });
    } else {
      this.blocker.disableInteractive();
      this.listBg.disableInteractive();
    }
    for (const row of this.rows) {
      row.root.setVisible(show);
      if (row.locked) {
        continue;
      }
      if (show) {
        row.root.setInteractive({
          hitArea: new Phaser.Geom.Rectangle(0, 0, BUTTON_W - 12, ROW_H - 4),
          hitAreaCallback: Phaser.Geom.Rectangle.Contains,
          useHandCursor: true,
        });
      } else {
        row.root.disableInteractive();
      }
    }
  }

  private paint(): void {
    for (const row of this.rows) {
      const current = row.world === this.world;
      const focused = this.openState && row.world === this.highlight;
      if (row.locked) {
        row.bg.setFillStyle(0x1a1014, 1);
        row.label.setColor(UI.muted);
        continue;
      }
      if (focused) {
        row.bg.setFillStyle(UI.buttonFocus, 1);
        row.label.setColor(UI.gold);
        continue;
      }
      row.bg.setFillStyle(current ? 0x3a1820 : UI.buttonFill, 1);
      row.label.setColor(current ? UI.gold : UI.text);
    }
  }
}
