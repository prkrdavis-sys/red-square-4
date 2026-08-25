import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { textStyle, UI } from '../ui/menu';
import { clamp01, specialMeterFillWidth } from './special-cooldown';

export const SPECIAL_METER = {
  width: 276,
  height: 56,
  barWidth: 244,
  barHeight: 16,
  x: GAME_WIDTH - 160,
  y: GAME_HEIGHT - 48,
} as const;

const READY_FILL = 0xffe08a;
const CHARGE_FILL = 0xd4a24a;
const TRACK = 0x2a1418;

let lastTouchChargeToken = '';

export interface SpecialMeter {
  setCharge(charge: number): void;
  setVisible(visible: boolean): void;
}

export function createSpecialMeter(scene: Phaser.Scene, label: string): SpecialMeter {
  const { width, height, barWidth, barHeight, x, y } = SPECIAL_METER;
  const inner = barWidth - 4;
  const bg = scene.add.rectangle(0, 0, width, height, UI.panelFill, 0.82).setStrokeStyle(3, UI.buttonStroke);
  const keyHint = scene.add
    .text(-width / 2 + 14, -12, 'SHIFT', textStyle('16px', UI.gold))
    .setOrigin(0, 0.5);
  const name = scene.add
    .text(width / 2 - 14, -12, label.toUpperCase(), textStyle('20px', UI.gold))
    .setOrigin(1, 0.5);
  const track = scene.add
    .rectangle(0, 12, barWidth, barHeight, TRACK, 1)
    .setStrokeStyle(1, 0xffd0a8, 0.28);
  const fill = scene.add
    .rectangle(-barWidth / 2 + 2, 12, inner, barHeight - 6, READY_FILL, 1)
    .setOrigin(0, 0.5);

  const root = scene.add.container(x, y, [bg, keyHint, name, track, fill]).setScrollFactor(0).setDepth(50);

  return {
    setCharge(charge: number) {
      const ratio = clamp01(charge);
      const ready = ratio >= 0.999;
      const drawn = specialMeterFillWidth(ratio, inner);
      fill.setVisible(drawn > 0.5);
      fill.setDisplaySize(Math.max(drawn, 0.5), barHeight - 6);
      fill.setFillStyle(ready ? READY_FILL : CHARGE_FILL);
      name.setColor(ready ? UI.gold : UI.muted);
    },
    setVisible(visible: boolean) {
      root.setVisible(visible);
    },
  };
}

export function applyTouchSpecialCharge(charge: number): void {
  if (typeof document === 'undefined') {
    return;
  }
  const button = document.querySelector<HTMLButtonElement>('.touch-btn[data-touch="special"]');
  if (!button) {
    return;
  }
  const ratio = clamp01(charge);
  const token = ratio.toFixed(3);
  if (token === lastTouchChargeToken) {
    return;
  }
  lastTouchChargeToken = token;
  button.style.setProperty('--special-ready', token);
  button.classList.toggle('is-ready', ratio >= 0.999);
  button.dataset.specialCharge = String(Math.round(ratio * 100));
}

export function resetTouchSpecialCharge(): void {
  lastTouchChargeToken = '';
  applyTouchSpecialCharge(1);
}
