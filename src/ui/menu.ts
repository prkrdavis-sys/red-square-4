import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, THEMES, themeSky } from '../config';
import { audio } from '../systems/audio';
import { coinCounterLabel } from './coin-counter';
import { MENU_OPEN_GUARD_MS, menuDismissIsArmed, shouldAcceptTap } from './menu-tap';

export { MENU_OPEN_GUARD_MS, MENU_TAP_LOCK_MS, menuDismissIsArmed, shouldAcceptTap } from './menu-tap';

export const GAME_FONT_FAMILY = 'Nunito';

export const UI = {
  font: `${GAME_FONT_FAMILY}, Trebuchet MS, sans-serif`,
  panelFill: 0x140c10,
  panelStroke: 0xe23b3b,
  buttonFill: 0x2a1418,
  buttonHover: 0x4a2228,
  buttonFocus: 0x6a1820,
  buttonStroke: 0x8a3038,
  text: '#fff8f0',
  muted: '#d0c0b8',
  gold: '#ffe9a8',
} as const;

export type MenuButtonTone = 'default' | 'gold' | 'muted';

const WORLD_ACCENTS = THEMES.map((theme) => themeSky(theme));

export async function waitForUiFont(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) {
    return;
  }
  try {
    await document.fonts.load(`600 18px "${GAME_FONT_FAMILY}"`);
  } catch {
    return;
  }
}

export function textStyle(size: string, color: string = UI.text): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: UI.font,
    fontSize: size,
    fontStyle: '600',
    color,
    stroke: '#12080a',
    strokeThickness: 1,
    resolution: 2,
    shadow: {
      offsetX: 2,
      offsetY: 2,
      color: '#12080a',
      blur: 0,
      fill: true,
      stroke: false,
    },
  };
}

export function addPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  title?: string,
): Phaser.GameObjects.Container {
  const bg = scene.add.rectangle(0, 0, width, height, UI.panelFill, 0.94).setInteractive();
  const border = scene.add.rectangle(0, 0, width, height, UI.panelFill, 0).setStrokeStyle(4, UI.panelStroke, 1);
  const inner = scene.add.rectangle(0, 0, width - 12, height - 12, 0x000000, 0).setStrokeStyle(2, 0xffd0a8, 0.28);
  const kids: Phaser.GameObjects.GameObject[] = [bg, border, inner];
  const slot = (width - 40) / WORLD_ACCENTS.length;
  WORLD_ACCENTS.forEach((color, index) => {
    kids.push(
      scene.add.rectangle(-width / 2 + 20 + slot * index + slot / 2, height / 2 - 12, slot - 6, 8, color),
    );
  });
  if (title) {
    kids.push(
      scene.add
        .text(0, -height / 2 + 28, title, textStyle('28px', UI.gold))
        .setOrigin(0.5),
    );
  }
  const panel = scene.add.container(x, y, kids).setScrollFactor(0).setDepth(70);
  panel.setSize(width, height);
  return panel;
}

export class MenuButton extends Phaser.GameObjects.Container {
  onActivate: () => void;
  onAdjust?: (dir: -1 | 1) => void;
  focused = false;
  private lastCommitAt = Number.NEGATIVE_INFINITY;
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly border: Phaser.GameObjects.Rectangle;
  private readonly labelText: Phaser.GameObjects.Text;
  private readonly widthPx: number;
  private readonly heightPx: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    label: string,
    onActivate: () => void,
    width = 380,
    height = 54,
  ) {
    super(scene, x, y);
    this.onActivate = onActivate;
    this.widthPx = width;
    this.heightPx = height;
    this.bg = scene.add.rectangle(0, 0, width, height, UI.buttonFill, 1);
    this.border = scene.add.rectangle(0, 0, width, height, UI.buttonFill, 0).setStrokeStyle(3, UI.buttonStroke, 1);
    this.labelText = scene.add.text(0, 0, label, textStyle('24px')).setOrigin(0.5);
    this.add([this.bg, this.border, this.labelText]);
    this.setSize(width, height);
    this.setScrollFactor(0);
    this.enablePointer();
    this.on('pointerover', () => this.emit('menu-focus'));
    this.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.bg.setScale(0.97);
      this.border.setScale(0.97);
      if (pointer.wasTouch) {
        this.commit();
      }
    });
    this.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      this.bg.setScale(1);
      this.border.setScale(1);
      if (!pointer.wasTouch) {
        this.commit();
      }
    });
    this.on('pointerout', () => {
      this.bg.setScale(1);
      this.border.setScale(1);
    });
    scene.add.existing(this);
    this.setDepth(90);
  }

  private commit(): void {
    if (!this.active || !this.scene.scene.isActive()) {
      return;
    }
    const now = performance.now();
    if (!shouldAcceptTap(this.lastCommitAt, now)) {
      return;
    }
    this.lastCommitAt = now;
    audio.play(this.scene, 'select');
    this.onActivate();
  }

  enablePointer(hitPad = 20): void {
    this.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-hitPad, -hitPad, this.widthPx + hitPad * 2, this.heightPx + hitPad * 2),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
  }

  setLabel(label: string): void {
    this.labelText.setText(label);
  }

  setTone(tone: MenuButtonTone): void {
    switch (tone) {
      case 'default':
        this.bg.setFillStyle(UI.buttonFill, 1);
        this.border.setStrokeStyle(3, UI.buttonStroke, 1);
        this.labelText.setColor(UI.text);
        return;
      case 'gold':
        this.bg.setFillStyle(0x3a2a0c, 1);
        this.border.setStrokeStyle(3, 0xd4a84a, 1);
        this.labelText.setColor(UI.gold);
        return;
      case 'muted':
        this.bg.setFillStyle(0x1a1014, 1);
        this.border.setStrokeStyle(3, 0x4a3038, 1);
        this.labelText.setColor(UI.muted);
        return;
      default: {
        const neverTone: never = tone;
        return neverTone;
      }
    }
  }

  setFocused(focused: boolean): void {
    this.focused = focused;
    this.bg.setFillStyle(focused ? UI.buttonFocus : UI.buttonFill);
    this.border.setStrokeStyle(3, focused ? 0xffd0a8 : UI.buttonStroke, 1);
    this.labelText.setColor(focused ? UI.gold : UI.text);
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      scale: focused ? 1.05 : 1,
      duration: 90,
      ease: 'Sine.easeOut',
    });
  }

  get hitWidth(): number {
    return this.widthPx;
  }

  get hitHeight(): number {
    return this.heightPx;
  }
}

export class MenuNav {
  private index = 0;
  private enabled = true;
  private readonly cursor: Phaser.GameObjects.Image;
  private readonly onKey: (event: KeyboardEvent) => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly buttons: MenuButton[],
    private readonly onBack?: () => void,
  ) {
    this.cursor = scene.add.image(0, 0, 'player').setScrollFactor(0).setDepth(91).setScale(0.72);
    scene.tweens.add({
      targets: this.cursor,
      y: '+=7',
      duration: 420,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.buttons.forEach((button, index) => {
      button.on('menu-focus', () => this.select(index, false));
    });
    this.onKey = (event: KeyboardEvent) => this.handleKey(event);
    scene.input.keyboard?.on('keydown', this.onKey);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    this.select(0, false);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.cursor.setVisible(enabled);
    for (const button of this.buttons) {
      button.setVisible(enabled);
      if (enabled) {
        button.enablePointer();
      } else {
        button.disableInteractive();
      }
    }
    if (enabled) {
      this.select(this.index, false);
    }
  }

  select(index: number, playSound: boolean): void {
    if (index < 0 || index >= this.buttons.length) {
      return;
    }
    if (playSound && index !== this.index) {
      audio.play(this.scene, 'map');
    }
    this.index = index;
    this.buttons.forEach((button, i) => button.setFocused(i === index));
    const button = this.buttons[index];
    if (!button) {
      return;
    }
    this.cursor.x = button.x - button.hitWidth / 2 - 34;
    this.cursor.y = button.y;
  }

  destroy(): void {
    this.scene.input.keyboard?.off('keydown', this.onKey);
    this.cursor.destroy();
  }

  private handleKey(event: KeyboardEvent): void {
    if (!this.enabled || this.scene.scene.isPaused()) {
      return;
    }
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        event.preventDefault();
        this.select((this.index + this.buttons.length - 1) % this.buttons.length, true);
        break;
      case 'ArrowDown':
      case 'KeyS':
        event.preventDefault();
        this.select((this.index + 1) % this.buttons.length, true);
        break;
      case 'ArrowLeft':
      case 'KeyA': {
        const left = this.buttons[this.index];
        if (left?.onAdjust) {
          event.preventDefault();
          left.onAdjust(-1);
        }
        break;
      }
      case 'ArrowRight':
      case 'KeyD': {
        const right = this.buttons[this.index];
        if (right?.onAdjust) {
          event.preventDefault();
          right.onAdjust(1);
        }
        break;
      }
      case 'Enter':
      case 'Space':
        event.preventDefault();
        audio.play(this.scene, 'select');
        this.buttons[this.index]?.onActivate();
        break;
      case 'Escape':
        if (this.onBack) {
          event.preventDefault();
          this.onBack();
        }
        break;
      default:
        break;
    }
  }
}

export function launchOverlay(
  from: Phaser.Scene,
  key: 'SettingsScene' | 'CreditsScene' | 'SkinsScene',
): void {
  if (from.scene.isPaused()) {
    return;
  }
  audio.unlock();
  from.input.enabled = false;
  from.scene.launch(key, { returnKey: from.scene.key });
  from.scene.pause();
}

export function closeOverlay(overlay: Phaser.Scene, returnKey: string): void {
  if (!overlay.scene.isActive()) {
    return;
  }
  const parent = overlay.scene.get(returnKey);
  overlay.scene.stop();
  overlay.scene.resume(returnKey);
  if (parent) {
    parent.input.enabled = true;
  }
}

function afterOpenGesture(scene: Phaser.Scene, done: () => void): void {
  const opened = performance.now();
  const poll = (): void => {
    if (!scene.scene.isActive()) {
      return;
    }
    if (scene.input.activePointer.isDown || performance.now() - opened < MENU_OPEN_GUARD_MS) {
      scene.time.delayedCall(40, poll);
      return;
    }
    done();
  };
  scene.time.delayedCall(40, poll);
}

export function beginOverlay(scene: Phaser.Scene): void {
  scene.input.enabled = false;
  afterOpenGesture(scene, () => {
    if (scene.scene.isActive()) {
      scene.input.enabled = true;
    }
  });
}

export function dimScreen(
  scene: Phaser.Scene,
  alpha = 0.55,
  onDismiss?: () => void,
): Phaser.GameObjects.Rectangle {
  const dim = scene.add
    .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, alpha)
    .setScrollFactor(0)
    .setDepth(60)
    .setInteractive(new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT), Phaser.Geom.Rectangle.Contains);
  if (onDismiss) {
    let ready = false;
    afterOpenGesture(scene, () => {
      ready = true;
    });
    dim.on('pointerup', () => {
      if (ready && scene.input.enabled) {
        onDismiss();
      }
    });
  }
  return dim;
}

function pointerOutsidePanel(panel: Phaser.GameObjects.Container, pointer: Phaser.Input.Pointer): boolean {
  const halfW = panel.width / 2;
  const halfH = panel.height / 2;
  return pointer.x < panel.x - halfW || pointer.x > panel.x + halfW || pointer.y < panel.y - halfH || pointer.y > panel.y + halfH;
}

/** Close a popup when the pointer is released outside its panel, including letterboxed chrome. */
export function dismissOnOutside(
  scene: Phaser.Scene,
  panel: Phaser.GameObjects.Container,
  onDismiss: () => void,
  isOpen: () => boolean = () => true,
): void {
  let wasOpen = false;
  let openSince: number | undefined;
  const noteOpen = (): boolean => {
    const open = isOpen();
    if (open && !wasOpen) {
      openSince = performance.now();
    }
    if (!open) {
      openSince = undefined;
    }
    wasOpen = open;
    return open;
  };
  const tryDismiss = (pointer: Phaser.Input.Pointer) => {
    if (
      !scene.input.enabled ||
      !scene.scene.isActive() ||
      !noteOpen() ||
      !menuDismissIsArmed(openSince, performance.now()) ||
      !pointerOutsidePanel(panel, pointer)
    ) {
      return;
    }
    onDismiss();
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, noteOpen);
  scene.input.on('pointerup', tryDismiss);
  scene.input.on('pointerupoutside', tryDismiss);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, noteOpen);
    scene.input.off('pointerup', tryDismiss);
    scene.input.off('pointerupoutside', tryDismiss);
  });
}

export function addCoinPurse(
  scene: Phaser.Scene,
  x: number,
  y: number,
  coins: number,
): Phaser.GameObjects.Container {
  const width = 176;
  const height = 42;
  const bg = scene.add.rectangle(0, 0, width, height, 0x10080c, 0.94).setStrokeStyle(3, 0xd4a84a, 1);
  const inner = scene.add.rectangle(0, 0, width - 8, height - 8, 0x000000, 0).setStrokeStyle(1, 0xffe9a8, 0.4);
  const icon = scene.add.image(-width / 2 + 22, 0, 'coin').setScale(0.62);
  const label = scene.add.text(10, 0, coinCounterLabel(coins), textStyle('18px', UI.gold)).setOrigin(0, 0.5);
  const box = scene.add.container(x, y, [bg, inner, icon, label]).setScrollFactor(0).setDepth(90);
  box.setSize(width, height);
  box.setData('coinLabel', label);
  return box;
}

export function setCoinPurseAmount(box: Phaser.GameObjects.Container, coins: number): void {
  const label = box.getData('coinLabel');
  if (label instanceof Phaser.GameObjects.Text) {
    label.setText(coinCounterLabel(coins));
  }
}
