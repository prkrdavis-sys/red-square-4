import Phaser from 'phaser';
import { GROUND_Y, MAP_ROWS, TILE, launchVelocity } from '../config';
import type { ChaseLayout } from '../levels/grid';
import { audio } from '../systems/audio';
import {
  ENTITY_BASELINE,
  ENTITY_FRAME_COUNTS,
  ENTITY_FRAME_H,
  ENTITY_FRAME_W,
  ENTITY_GLITCH_KEY,
  ENTITY_HIP_X,
  entityFrameKey,
  type EntityFrameKind,
} from '../systems/backrooms-textures';
import {
  chaseSpeed,
  climbLipX,
  ENTITY_CLIMB_MS,
  ENTITY_INTRO_MS,
  ENTITY_LEAP_TILES,
  ENTITY_PIT_WAIT_MS,
  ENTITY_RECOVER_MS,
  footstepLoudness,
  pitOutcome,
  shouldLeap,
  tileAheadOf,
  type EntityState,
} from './backrooms-chase';

const BODY_W = 28;
const BODY_H = 150;
/** Sprite centre sits this far above the floor when standing. */
const STAND_OFFSET = ENTITY_BASELINE - ENTITY_FRAME_H / 2;
/** How far past its front edge it looks for a pillar to vault. */
const LEAP_PROBE_PX = 40;
const DEPTH_ABOVE = 19;
/** Behind the tile layer, so pit walls hide it while it falls or climbs. */
const DEPTH_IN_PIT = -5;

export type BackroomsEntityEvent = 'wake' | 'emerge' | 'gone';

export class BackroomsEntity extends Phaser.Physics.Arcade.Sprite {
  private mode: EntityState = 'stalk';
  private modeUntil = 0;
  private direction = 1;
  private pit: [number, number] = [0, 1];
  private awake = false;
  private lastFrame = -1;
  private nextGlitchAt = 0;
  private lastGap = TILE * 20;
  private readonly rows: readonly string[];
  private readonly chase: ChaseLayout;
  private readonly shadow: Phaser.GameObjects.Ellipse;

  constructor(scene: Phaser.Scene, tileX: number, rows: readonly string[], chase: ChaseLayout, introMs = ENTITY_INTRO_MS) {
    super(scene, tileX * TILE + TILE / 2, GROUND_Y * TILE - STAND_OFFSET, entityFrameKey('idle', 0));
    this.rows = rows;
    this.chase = chase;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.arcadeBody;
    body.setSize(BODY_W, BODY_H);
    body.setMaxVelocity(640, 1400);
    this.faceBody();
    this.setDepth(DEPTH_ABOVE);
    this.shadow = scene.add.ellipse(this.x, GROUND_Y * TILE - 2, 64, 12, 0x000000, 0.35).setDepth(DEPTH_ABOVE - 1);
    this.modeUntil = scene.time.now + introMs;
    this.nextGlitchAt = scene.time.now + 2400;
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.shadow.destroy());
  }

  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  get chaseState(): EntityState {
    return this.mode;
  }

  /** Touching it from any side is fatal, except while it is out of sight in a pit. */
  get lethal(): boolean {
    switch (this.mode) {
      case 'stalk':
      case 'chase':
      case 'leap':
        return this.visible && this.arcadeBody.enable;
      case 'climbing':
      case 'falling':
      case 'gone':
        return false;
      default: {
        const neverMode: never = this.mode;
        return neverMode;
      }
    }
  }

  get isGone(): boolean {
    return this.mode === 'gone';
  }

  /** Put it back on the floor at `tileX` after a checkpoint restart, idling briefly first. */
  placeAt(tileX: number, idleMs: number): void {
    this.setPosition(tileX * TILE + TILE / 2, GROUND_Y * TILE - STAND_OFFSET);
    this.arcadeBody.reset(this.x, this.y);
    this.mode = 'stalk';
    this.modeUntil = this.scene.time.now + idleMs;
  }

  /** Freeze in place, e.g. while the player's death plays out. */
  halt(): void {
    if (this.arcadeBody.enable) {
      this.arcadeBody.setVelocity(0, 0);
      this.arcadeBody.allowGravity = false;
    }
  }

  tick(target: { x: number; y: number } | undefined, playerMax: number): void {
    const now = this.scene.time.now;
    const body = this.arcadeBody;
    if (target) {
      this.lastGap = target.x - this.x;
    }
    switch (this.mode) {
      case 'stalk':
        if (body.enable) {
          body.setVelocityX(0);
        }
        this.animate('idle', 460, now);
        if (now >= this.modeUntil) {
          this.mode = 'chase';
          if (!this.awake) {
            this.awake = true;
            this.emit('wake');
          }
        }
        break;
      case 'chase':
        this.runToward(target, playerMax, now);
        break;
      case 'leap':
        body.setVelocityX(this.direction * chaseSpeed(this.lastGap, playerMax));
        this.animate('leap', 180, now, body.velocity.y < 0 ? 0 : 1);
        if (body.blocked.down && body.velocity.y >= 0) {
          this.mode = 'chase';
        }
        this.checkPit(now);
        break;
      case 'falling':
        this.animate('fall', 110, now);
        if (body.enable) {
          body.setVelocityX(0);
          if (this.y > MAP_ROWS * TILE + ENTITY_FRAME_H) {
            body.enable = false;
            this.setVisible(false);
          }
        }
        if (now >= this.modeUntil && pitOutcome(this.pit[0], this.chase.trapPits, this.chase.voidPit) === 'climb') {
          this.startClimb(target);
        }
        break;
      case 'climbing':
        this.animate('climb', 120, now);
        break;
      case 'gone':
        break;
      default: {
        const neverMode: never = this.mode;
        return neverMode;
      }
    }
    this.syncShadow();
  }

  private runToward(target: { x: number; y: number } | undefined, playerMax: number, now: number): void {
    const body = this.arcadeBody;
    if (!target) {
      body.setVelocityX(0);
      this.animate('idle', 460, now);
      return;
    }
    if (Math.abs(this.lastGap) > 8) {
      this.face(Math.sign(this.lastGap));
    }
    body.setVelocityX(this.direction * chaseSpeed(this.lastGap, playerMax));
    if (body.blocked.down) {
      const feetRow = Math.round(body.bottom / TILE);
      const probe = Math.floor((this.x + this.direction * (BODY_W / 2 + LEAP_PROBE_PX)) / TILE);
      if (shouldLeap(tileAheadOf(this.rows, probe - this.direction, this.direction, feetRow))) {
        body.setVelocityY(launchVelocity(this.scene.physics.world.gravity.y, ENTITY_LEAP_TILES));
        this.mode = 'leap';
        return;
      }
    }
    this.animate('run', 64, now);
    this.checkPit(now);
  }

  private checkPit(now: number): void {
    const body = this.arcadeBody;
    const column = Math.floor(this.x / TILE);
    if (body.bottom <= GROUND_Y * TILE + 10 || this.rows[GROUND_Y]?.[column] !== '.') {
      return;
    }
    const outcome = pitOutcome(column, this.chase.trapPits, this.chase.voidPit);
    this.pit =
      outcome === 'gone'
        ? this.chase.voidPit
        : (this.chase.trapPits.find(([x, w]) => column >= x && column < x + w) ?? [column, 1]);
    this.mode = 'falling';
    this.setDepth(DEPTH_IN_PIT);
    this.shadow.setVisible(false);
    if (outcome === 'gone') {
      this.fallIntoVoid();
      return;
    }
    audio.play(this.scene, 'entity-shriek');
    this.modeUntil = now + ENTITY_PIT_WAIT_MS;
  }

  /** The long drop: it stretches thin and fades while the scream bends away. */
  private fallIntoVoid(): void {
    audio.play(this.scene, 'entity-fall');
    this.scene.tweens.add({
      targets: this,
      scaleY: 2.6,
      scaleX: 0.55,
      alpha: 0,
      duration: 1150,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.mode = 'gone';
        this.arcadeBody.enable = false;
        this.setVisible(false);
        this.emit('gone');
      },
    });
  }

  private startClimb(target: { x: number; y: number } | undefined): void {
    const [pitX, pitW] = this.pit;
    const pitCenter = (pitX + pitW / 2) * TILE;
    const direction = target ? Math.sign(target.x - pitCenter) || 1 : this.direction;
    this.face(direction);
    const lip = climbLipX(this.pit, direction);
    const floorY = GROUND_Y * TILE;
    this.mode = 'climbing';
    this.arcadeBody.enable = false;
    this.setVisible(true);
    this.setAlpha(1);
    this.setPosition(lip - direction * 24, floorY + ENTITY_FRAME_H);
    this.scene.tweens.add({
      targets: this,
      y: floorY + 24,
      duration: ENTITY_CLIMB_MS,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.setTexture(entityFrameKey('leap', 0));
        this.scene.tweens.add({
          targets: this,
          x: lip + direction * 30,
          y: floorY - STAND_OFFSET,
          duration: 200,
          ease: 'Quad.easeOut',
          onComplete: () => this.finishClimb(),
        });
      },
    });
  }

  private finishClimb(): void {
    this.setDepth(DEPTH_ABOVE);
    this.arcadeBody.enable = true;
    this.arcadeBody.allowGravity = true;
    this.arcadeBody.reset(this.x, this.y);
    this.mode = 'stalk';
    this.modeUntil = this.scene.time.now + ENTITY_RECOVER_MS;
    audio.play(this.scene, 'entity-shriek');
    this.emit('emerge');
  }

  private face(direction: number): void {
    if (direction === 0 || direction === this.direction) {
      return;
    }
    this.direction = direction > 0 ? 1 : -1;
    this.setFlipX(this.direction < 0);
    this.faceBody();
  }

  /** Keep the body under the hips; the frame is not symmetric, so flipping moves it. */
  private faceBody(): void {
    const hipX = this.direction < 0 ? ENTITY_FRAME_W - ENTITY_HIP_X : ENTITY_HIP_X;
    this.arcadeBody.setOffset(hipX - BODY_W / 2, ENTITY_BASELINE - BODY_H);
  }

  private animate(kind: EntityFrameKind, frameMs: number, now: number, fixed?: number): void {
    const index = fixed ?? Math.floor(now / frameMs) % ENTITY_FRAME_COUNTS[kind];
    if (kind === 'run' && index !== this.lastFrame && (index === 1 || index === 5)) {
      audio.footstep(footstepLoudness(this.lastGap));
    }
    this.lastFrame = kind === 'run' ? index : -1;
    if (kind === 'run' && now >= this.nextGlitchAt) {
      this.setTexture(ENTITY_GLITCH_KEY);
      if (now >= this.nextGlitchAt + 70) {
        this.nextGlitchAt = now + Phaser.Math.Between(1800, 4200);
      }
      return;
    }
    this.setTexture(entityFrameKey(kind, index));
  }

  private syncShadow(): void {
    const onFloor = this.mode === 'chase' || this.mode === 'stalk' || this.mode === 'leap';
    this.shadow.setVisible(onFloor && this.visible);
    if (!onFloor) {
      return;
    }
    const lift = Math.max(0, GROUND_Y * TILE - this.arcadeBody.bottom);
    this.shadow.setPosition(this.x, GROUND_Y * TILE - 2);
    this.shadow.setScale(Math.max(0.3, 1 - lift / 260), 1);
    this.shadow.setAlpha(Math.max(0.08, 0.35 - lift / 900));
  }
}
