import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, GROUND_Y, TILE } from '../config';
import { dreadLevel } from '../entities/backrooms-chase';
import type { ChaseLayout } from '../levels/grid';
import {
  BR_GRAIN_KEY,
  BR_LIGHTS_H,
  BR_LIGHTS_KEY,
  BR_SCANLINES_KEY,
  BR_VIGNETTE_KEY,
  BR_VOID_MOTE_KEY,
} from './backrooms-scenery';

const LIGHTS_ON = 0.62;
const LIGHTS_FACTOR = 0.5;
const PIT_DEPTH = -8;
const VIGNETTE_REST = 0.32;
const VIGNETTE_DREAD = 0.62;

/**
 * Level 0 dressing that lives outside the tile grid: flickering fluorescent glow, pit
 * shafts, a found-footage VHS pass, and a vignette that closes in with the stalker.
 */
export class BackroomsAtmosphere {
  private readonly scene: Phaser.Scene;
  private readonly lights: Phaser.GameObjects.TileSprite;
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly grain: Phaser.GameObjects.TileSprite;
  private readonly vignette: Phaser.GameObjects.Image;
  private readonly rec: Phaser.GameObjects.Text;
  private readonly recDot: Phaser.GameObjects.Arc;
  private readonly startedAt: number;
  private dread = 0;

  constructor(scene: Phaser.Scene, heightPx: number, chase: ChaseLayout, intro: boolean) {
    this.scene = scene;
    this.startedAt = scene.time.now;
    this.lights = scene.add
      .tileSprite(0, 0, GAME_WIDTH, BR_LIGHTS_H, BR_LIGHTS_KEY)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-29)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(intro ? 0 : LIGHTS_ON);
    this.dim = scene.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0c0802, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(43);
    this.addPits(heightPx, chase);
    this.vignette = scene.add
      .image(0, 0, BR_VIGNETTE_KEY)
      .setOrigin(0, 0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setScrollFactor(0)
      .setDepth(44)
      .setAlpha(VIGNETTE_REST);
    scene.add
      .tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, BR_SCANLINES_KEY)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(46)
      .setAlpha(0.12);
    this.grain = scene.add
      .tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, BR_GRAIN_KEY)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(46)
      .setAlpha(0.05);
    this.recDot = scene.add.circle(GAME_WIDTH / 2 - 92, 29, 7, 0xff2a2a).setScrollFactor(0).setDepth(50);
    this.rec = scene.add
      .text(GAME_WIDTH / 2 - 78, 18, '', {
        fontFamily: '"Courier New", monospace',
        fontSize: '22px',
        color: '#f4ecc8',
        stroke: '#1a1408',
        strokeThickness: 4,
      })
      .setScrollFactor(0)
      .setDepth(50)
      .setResolution(2);
    this.scheduleTracking();
    if (intro) {
      this.flickerOn();
    } else {
      this.scheduleFlicker();
    }
  }

  update(scrollX: number, entityGapPx: number | undefined): void {
    const now = this.scene.time.now;
    this.lights.tilePositionX = scrollX * LIGHTS_FACTOR;
    this.grain.tilePositionX = Math.random() * 256;
    this.grain.tilePositionY = Math.random() * 256;
    this.dread = Phaser.Math.Linear(this.dread, dreadLevel(entityGapPx), 0.08);
    const pulse = this.dread > 0.6 ? Math.sin(now / 90) * 0.04 * this.dread : 0;
    this.vignette.setAlpha(VIGNETTE_REST + VIGNETTE_DREAD * this.dread + pulse);
    const seconds = Math.floor((now - this.startedAt) / 1000);
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    this.rec.setText(`REC  00:${mm}:${ss}`);
    this.recDot.setVisible(Math.floor(now / 600) % 2 === 0);
  }

  /** Trap pits are dark carpet-lined shafts; the void pit is nothing at all. */
  private addPits(heightPx: number, chase: ChaseLayout): void {
    const top = GROUND_Y * TILE;
    const depth = heightPx - top + 400;
    for (const [x, w] of chase.trapPits) {
      const shaft = this.scene.add.graphics().setDepth(PIT_DEPTH);
      shaft.fillGradientStyle(0x4a3c18, 0x4a3c18, 0x0a0804, 0x0a0804, 1);
      shaft.fillRect(x * TILE, top, w * TILE, depth);
      shaft.fillStyle(0x1a1408, 0.6);
      shaft.fillRect(x * TILE, top, 6, depth);
      shaft.fillRect((x + w) * TILE - 6, top, 6, depth);
    }
    const [vx, vw] = chase.voidPit;
    const voidShaft = this.scene.add.graphics().setDepth(PIT_DEPTH);
    voidShaft.fillGradientStyle(0x1a1408, 0x1a1408, 0x000000, 0x000000, 1);
    voidShaft.fillRect(vx * TILE, top, vw * TILE, 60);
    voidShaft.fillStyle(0x000000, 1);
    voidShaft.fillRect(vx * TILE, top + 60, vw * TILE, depth);
    this.scene.add
      .particles(0, 0, BR_VOID_MOTE_KEY, {
        x: { min: vx * TILE + 8, max: (vx + vw) * TILE - 8 },
        y: { min: top + 60, max: heightPx },
        speedY: { min: -18, max: -6 },
        alpha: { start: 0.5, end: 0 },
        scale: { start: 1, end: 0.4 },
        lifespan: 2600,
        frequency: 160,
      })
      .setDepth(PIT_DEPTH + 1);
  }

  /** Lights stutter on after the fall in, like a tube warming up. */
  private flickerOn(): void {
    const steps = [0.15, 0, 0.4, 0.05, 0.25, 0, LIGHTS_ON];
    steps.forEach((level, index) => {
      this.scene.time.delayedCall(260 + index * 110, () => this.setLights(level));
    });
    this.scene.time.delayedCall(260 + steps.length * 110, () => this.scheduleFlicker());
  }

  private scheduleFlicker(): void {
    this.scene.time.delayedCall(Phaser.Math.Between(1600, 5200), () => {
      const blinks = Phaser.Math.Between(1, 3);
      for (let i = 0; i < blinks; i += 1) {
        this.scene.time.delayedCall(i * 140, () => this.setLights(0.08));
        this.scene.time.delayedCall(i * 140 + Phaser.Math.Between(50, 90), () => this.setLights(LIGHTS_ON));
      }
      this.scheduleFlicker();
    });
  }

  private setLights(level: number): void {
    this.lights.setAlpha(level);
    this.dim.setAlpha((LIGHTS_ON - level) * 0.5);
  }

  /** A VHS tracking band that rolls down the frame every so often. */
  private scheduleTracking(): void {
    this.scene.time.delayedCall(Phaser.Math.Between(3000, 7000), () => {
      const band = this.scene.add
        .rectangle(0, -24, GAME_WIDTH, 18, 0xfff8e0, 0.07)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(46);
      this.scene.tweens.add({
        targets: band,
        y: GAME_HEIGHT + 24,
        duration: 1400,
        ease: 'Linear',
        onComplete: () => band.destroy(),
      });
      this.scheduleTracking();
    });
  }
}
