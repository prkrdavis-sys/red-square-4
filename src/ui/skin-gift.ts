import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { SkinDef } from '../data/skins';
import { addPanel, dismissOnOutside, textStyle, UI } from './menu';

const PANEL_W = 560;
const PANEL_H = 360;

export function showSkinGift(scene: Phaser.Scene, skin: SkinDef, onDismiss: () => void): void {
  let closed = false;
  const bits: Phaser.GameObjects.GameObject[] = [];
  const cx = GAME_WIDTH / 2;
  const cy = 400;
  let previewTimer: Phaser.Time.TimerEvent | undefined;

  const finish = (): void => {
    if (closed) {
      return;
    }
    closed = true;
    scene.input.keyboard?.off('keydown', onKey);
    previewTimer?.destroy();
    for (const bit of bits) {
      bit.destroy();
    }
    onDismiss();
  };

  const onKey = (event: KeyboardEvent): void => {
    if (event.code === 'Escape') {
      finish();
    }
  };

  const dim = scene.add
    .rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.62)
    .setScrollFactor(0)
    .setDepth(100)
    .setInteractive(new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT), Phaser.Geom.Rectangle.Contains);
  const panel = addPanel(scene, cx, cy, PANEL_W, PANEL_H, 'NEW SKIN UNLOCKED');
  panel.setDepth(101);
  bits.push(dim, panel);

  const frames = ['player', 'player-run-a', 'player-run-b', 'player-jump', 'player-fall', 'player-blink'];
  let frame = 0;
  const preview = scene.add
    .image(cx, cy - 8, 'player')
    .setScale(3.1)
    .setScrollFactor(0)
    .setDepth(102);
  previewTimer = scene.time.addEvent({
    delay: 160,
    loop: true,
    callback: () => {
      frame = (frame + 1) % frames.length;
      const next = frames[frame];
      if (next) {
        preview.setTexture(next);
      }
    },
  });
  bits.push(
    preview,
    scene.add
      .text(cx, cy + 108, skin.name, textStyle('28px', UI.gold))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(102),
    scene.add
      .text(cx, cy + 146, 'Equipped and ready to wear', textStyle('18px', UI.muted))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(102),
  );

  const closeX = cx + PANEL_W / 2 - 28;
  const closeY = cy - PANEL_H / 2 + 28;
  const close = scene.add
    .circle(closeX, closeY, 18, 0x2a1418, 1)
    .setStrokeStyle(3, 0xffd0a8, 1)
    .setScrollFactor(0)
    .setDepth(110)
    .setInteractive({ useHandCursor: true });
  const mark = scene.add
    .text(closeX, closeY, 'X', textStyle('20px', UI.gold))
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(111);
  close.on('pointerup', finish);
  bits.push(close, mark);

  scene.input.keyboard?.on('keydown', onKey);
  scene.time.delayedCall(180, () => {
    if (closed || !scene.scene.isActive()) {
      return;
    }
    dismissOnOutside(scene, panel, finish, () => !closed);
  });
}
