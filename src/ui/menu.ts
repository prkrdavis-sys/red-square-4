import Phaser from 'phaser';
import { GAME_WIDTH, themeSky } from '../config';
import { audio } from '../systems/audio';

export const UI = {
  font: 'Courier New, monospace',
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

const WORLD_ACCENTS = [themeSky('grass'), themeSky('snow'), themeSky('desert'), themeSky('ocean'), themeSky('castle')];

export function textStyle(size: string, color: string = UI.text): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: UI.font,
    fontSize: size,
    color,
    stroke: '#12080a',
    strokeThickness: 5,
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
  const bg = scene.add.rectangle(0, 0, width, height, UI.panelFill, 0.94);
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
  return panel;
}

export class MenuButton extends Phaser.GameObjects.Container {
  onActivate: () => void;
  onAdjust?: (dir: -1 | 1) => void;
  focused = false;
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
    this.labelText = scene.add.text(0, 0, label, textStyle('22px')).setOrigin(0.5);
    this.add([this.bg, this.border, this.labelText]);
    this.setSize(width, height);
    this.setScrollFactor(0);
    this.enablePointer();
    this.on('pointerover', () => this.emit('menu-focus'));
    this.on('pointerdown', () => {
      this.bg.setScale(0.97);
      this.border.setScale(0.97);
    });
    this.on('pointerup', () => {
      this.bg.setScale(1);
      this.border.setScale(1);
      audio.play(this.scene, 'select');
      this.onActivate();
    });
    this.on('pointerout', () => {
      this.bg.setScale(1);
      this.border.setScale(1);
    });
    scene.add.existing(this);
  }

  enablePointer(): void {
    this.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-12, -12, this.widthPx + 24, this.heightPx + 24),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
  }

  setLabel(label: string): void {
    this.labelText.setText(label);
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
    this.cursor = scene.add.image(0, 0, 'player').setScrollFactor(0).setDepth(90).setScale(0.72);
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

export function launchOverlay(from: Phaser.Scene, key: 'SettingsScene' | 'CreditsScene'): void {
  audio.unlock();
  from.scene.launch(key, { returnKey: from.scene.key });
  from.scene.pause();
}

export function closeOverlay(overlay: Phaser.Scene, returnKey: string): void {
  overlay.scene.stop();
  overlay.scene.resume(returnKey);
}

export function dimScreen(scene: Phaser.Scene, alpha = 0.55): Phaser.GameObjects.Rectangle {
  return scene.add
    .rectangle(GAME_WIDTH / 2, scene.scale.height / 2, GAME_WIDTH, scene.scale.height, 0x000000, alpha)
    .setScrollFactor(0)
    .setDepth(60)
    .setInteractive();
}
