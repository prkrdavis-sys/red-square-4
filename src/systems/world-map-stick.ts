import Phaser from 'phaser';
import { GAME_HEIGHT } from '../config';
import { isTouchFirst } from './touch-controls';

export class MapAnalogStick {
  private readonly origin: Phaser.Math.Vector2;
  private readonly pointer = new Phaser.Math.Vector2();
  private active = false;
  private pointerId: number | null = null;
  private readonly base: Phaser.GameObjects.Arc;
  private readonly thumb: Phaser.GameObjects.Arc;
  private readonly zone: Phaser.GameObjects.Zone;

  constructor(scene: Phaser.Scene) {
    const x = 118;
    const y = GAME_HEIGHT - 196;
    this.origin = new Phaser.Math.Vector2(x, y);
    this.base = scene.add.circle(x, y, 62, 0x10161c, 0.55).setStrokeStyle(3, 0xe23b3b, 0.7);
    this.base.setScrollFactor(0).setDepth(96);
    this.thumb = scene.add.circle(x, y, 26, 0xffe9a8, 0.9).setStrokeStyle(2, 0x12080a, 0.8);
    this.thumb.setScrollFactor(0).setDepth(97);
    this.zone = scene.add.zone(x, y, 150, 150).setScrollFactor(0).setDepth(96);
    this.zone.setInteractive();
    const show = isTouchFirst();
    this.base.setVisible(show);
    this.thumb.setVisible(show);
    this.zone.setVisible(show);
    if (!show) {
      return;
    }
    this.zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.grab(pointer));
    scene.input.on('pointermove', this.onMove);
    scene.input.on('pointerup', this.onUp);
    scene.input.on('pointerupoutside', this.onUp);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off('pointermove', this.onMove);
      scene.input.off('pointerup', this.onUp);
      scene.input.off('pointerupoutside', this.onUp);
    });
  }

  vector(): Phaser.Math.Vector2 {
    const out = new Phaser.Math.Vector2();
    if (!this.active) {
      return out;
    }
    out.copy(this.pointer).subtract(this.origin);
    const max = 48;
    if (out.length() > max) {
      out.normalize().scale(max);
    }
    if (out.length() < 10) {
      return new Phaser.Math.Vector2();
    }
    return out.scale(1 / max);
  }

  private readonly onMove = (pointer: Phaser.Input.Pointer): void => {
    this.steer(pointer);
  };

  private readonly onUp = (pointer: Phaser.Input.Pointer): void => {
    this.release(pointer);
  };

  private grab(pointer: Phaser.Input.Pointer): void {
    this.active = true;
    this.pointerId = pointer.id;
    this.pointer.set(pointer.x, pointer.y);
    this.thumb.setPosition(pointer.x, pointer.y);
  }

  private steer(pointer: Phaser.Input.Pointer): void {
    if (!this.active || pointer.id !== this.pointerId) {
      return;
    }
    this.pointer.set(pointer.x, pointer.y);
    const delta = this.pointer.clone().subtract(this.origin);
    const max = 48;
    if (delta.length() > max) {
      delta.normalize().scale(max);
    }
    this.thumb.setPosition(this.origin.x + delta.x, this.origin.y + delta.y);
  }

  private release(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) {
      return;
    }
    this.active = false;
    this.pointerId = null;
    this.thumb.setPosition(this.origin.x, this.origin.y);
  }
}
