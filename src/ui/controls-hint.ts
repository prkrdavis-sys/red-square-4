import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, type SpecialKind, type Theme } from '../config';
import { airJumpHint } from '../systems/air-jump';
import { specialDescription, specialLabel } from '../systems/special-copy';
import { addPanel, dismissOnOutside, MenuButton, MenuNav, textStyle, UI } from './menu';

const CONTROL_ROWS: ReadonlyArray<{ action: string; keys: string }> = [
  { action: 'Move', keys: 'Arrows  or  A / D' },
  { action: 'Jump', keys: 'Up, W, or Space' },
  { action: 'Drop through', keys: 'Down or S' },
  { action: 'Pause', keys: 'P, Esc, or Pause' },
];

export function showControlsHint(
  scene: Phaser.Scene,
  kind: SpecialKind,
  theme: Theme,
  onDismiss: () => void,
): void {
  let closed = false;
  const bits: Phaser.GameObjects.GameObject[] = [];
  const cx = GAME_WIDTH / 2;
  const jumpHint = airJumpHint(theme);
  const extra = jumpHint ? 36 : 0;
  const panelHeight = 508 + extra;

  const finish = (): void => {
    if (closed) {
      return;
    }
    closed = true;
    nav.destroy();
    go.destroy();
    for (const bit of bits) {
      bit.destroy();
    }
    onDismiss();
  };

  const dim = scene.add
    .rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55)
    .setScrollFactor(0)
    .setDepth(82)
    .setInteractive(new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT), Phaser.Geom.Rectangle.Contains);
  const panel = addPanel(scene, cx, GAME_HEIGHT / 2, 580, panelHeight, 'CONTROLS');
  panel.setDepth(83);
  bits.push(dim, panel);

  const rowTop = GAME_HEIGHT / 2 - panelHeight / 2 + 72;
  CONTROL_ROWS.forEach((row, index) => {
    const y = rowTop + index * 34;
    bits.push(
      scene.add
        .text(cx - 236, y, row.action, textStyle('18px', UI.muted))
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(84),
      scene.add
        .text(cx + 236, y, row.keys, textStyle('18px'))
        .setOrigin(1, 0.5)
        .setScrollFactor(0)
        .setDepth(84),
    );
  });

  const specialY = rowTop + CONTROL_ROWS.length * 34 + 28 + extra;
  if (jumpHint) {
    bits.push(
      scene.add
        .text(cx, rowTop + CONTROL_ROWS.length * 34 + 6, jumpHint, textStyle('16px', UI.gold))
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(84),
    );
  }
  bits.push(
    scene.add
      .text(cx, specialY, 'Shift  is the special ability', textStyle('22px', UI.gold))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(84),
    scene.add
      .text(cx, specialY + 36, specialLabel(kind), textStyle('26px', UI.gold))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(84),
    scene.add
      .text(cx, specialY + 78, specialDescription(kind), {
        ...textStyle('18px'),
        align: 'center',
        wordWrap: { width: 500 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(84),
    scene.add
      .text(cx, specialY + 118, 'Touch: tap an arrow or drag the left half to move, Jump, and the bolt button', textStyle('16px', UI.muted))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(84),
  );

  const go = new MenuButton(scene, cx, GAME_HEIGHT / 2 + 176 + extra, 'GOT IT', finish);
  go.setDepth(90);
  go.disableInteractive();
  const nav = new MenuNav(scene, [go], finish);

  scene.time.delayedCall(180, () => {
    if (closed || !scene.scene.isActive() || !go.active) {
      return;
    }
    go.enablePointer();
    dismissOnOutside(scene, panel, finish, () => !closed);
  });
}
