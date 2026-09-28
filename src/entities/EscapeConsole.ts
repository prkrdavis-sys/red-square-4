import Phaser from 'phaser';
import { GROUND_Y, TILE } from '../config';
import { audio } from '../systems/audio';
import {
  ALARM_GLOW_KEY,
  CONSOLE_BUTTON_H,
  CONSOLE_BUTTON_KEY,
  CONSOLE_BUTTON_LIT_KEY,
  CONSOLE_BUTTON_SEAT,
  CONSOLE_H,
  CONSOLE_KEY,
  CONSOLE_READOUT,
  CONSOLE_W,
} from '../systems/escape-textures';

const DEPTH = 11;
const LOCKED_COLOR = 0xffa21a;
const ARMED_COLOR = 0x48ff7a;

/** Red-button pedestal at the end of Level 0. Decorative; PlayScene decides when it is pressed. */
export class EscapeConsole {
  readonly x: number;
  readonly floorY: number;
  private readonly scene: Phaser.Scene;
  private readonly left: number;
  private readonly top: number;
  private readonly button: Phaser.GameObjects.Image;
  private readonly alarm: Phaser.GameObjects.Image;
  private readonly readout: Phaser.GameObjects.Graphics;
  private readonly ticker: Phaser.Time.TimerEvent;
  private step = 0;
  private isArmed = false;
  private pressed = false;

  constructor(scene: Phaser.Scene, tileX: number) {
    this.scene = scene;
    this.x = tileX * TILE + TILE / 2;
    this.floorY = GROUND_Y * TILE;
    this.left = this.x - CONSOLE_W / 2;
    this.top = this.floorY - CONSOLE_H + 3;
    scene.add.image(this.left, this.top, CONSOLE_KEY).setOrigin(0, 0).setDepth(DEPTH);
    this.button = scene.add
      .image(this.left + CONSOLE_BUTTON_SEAT.x, this.top + CONSOLE_BUTTON_SEAT.y + 6, CONSOLE_BUTTON_KEY)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH + 0.1);
    this.alarm = scene.add
      .image(this.button.x, this.button.y - CONSOLE_BUTTON_H / 2, ALARM_GLOW_KEY)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH + 0.2)
      .setAlpha(0);
    this.readout = scene.add.graphics().setDepth(DEPTH + 0.1);
    this.ticker = scene.time.addEvent({ delay: 170, loop: true, callback: () => this.drawReadout() });
    this.drawReadout();
  }

  get armed(): boolean {
    return this.isArmed;
  }

  /** The stalker is gone: the readout turns green and the button starts to glow. */
  arm(): void {
    if (this.isArmed) {
      return;
    }
    this.isArmed = true;
    this.button.setTexture(CONSOLE_BUTTON_LIT_KEY);
    this.scene.tweens.add({
      targets: this.alarm,
      alpha: { from: 0.05, to: 0.35 },
      scale: { from: 0.55, to: 0.7 },
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Slam the button: it sinks, the alarm strobes, then `onPressed` fires. */
  press(onPressed: () => void): void {
    if (this.pressed) {
      return;
    }
    this.pressed = true;
    audio.play(this.scene, 'button');
    this.scene.tweens.killTweensOf(this.alarm);
    this.scene.tweens.add({
      targets: this.button,
      y: this.button.y + 7,
      scaleY: 0.72,
      scaleX: 1.06,
      duration: 90,
      ease: 'Quad.easeOut',
    });
    this.scene.tweens.add({
      targets: this.alarm,
      alpha: { from: 1, to: 0.15 },
      scale: { from: 1.6, to: 0.9 },
      duration: 160,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        this.alarm.setAlpha(0);
        onPressed();
      },
    });
  }

  private drawReadout(): void {
    this.step += 1;
    const g = this.readout;
    const r = CONSOLE_READOUT;
    g.clear();
    const x = this.left + r.x;
    const y = this.top + r.y;
    if (!this.isArmed) {
      if (this.step % 4 < 2) {
        g.fillStyle(LOCKED_COLOR, 0.95);
        g.fillRect(x + 3, y + 3, r.w - 6, r.h - 6);
      }
      return;
    }
    const bars = 5;
    const barW = (r.w - 4) / bars;
    for (let i = 0; i < bars; i += 1) {
      const on = (this.step + i) % bars !== 0;
      g.fillStyle(ARMED_COLOR, on ? 0.95 : 0.25);
      g.fillRect(x + 2 + i * barW, y + 2, barW - 1.5, r.h - 4);
    }
  }

  destroy(): void {
    this.ticker.remove();
  }
}
