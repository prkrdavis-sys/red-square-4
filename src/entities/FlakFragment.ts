import Phaser from 'phaser';
import {
  HERO_FLAK_SIZE,
  flakHeroTextureKey,
  flakPieceArea,
  flakPieceBounds,
  type FlakPieceIndex,
} from '../systems/flak-pieces';

export interface FlakSnapshot {
  piece: FlakPieceIndex;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVelocity: number;
  scale: number;
  flipX: boolean;
}

export class FlakFragment extends Phaser.Physics.Arcade.Sprite {
  readonly piece: FlakPieceIndex;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    piece: FlakPieceIndex,
    scale = 1,
    flipX = false,
  ) {
    super(scene, x, y, flakHeroTextureKey(piece));
    this.piece = piece;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(21);
    this.setScale(scale);
    const body = this.arcadeBody;
    body.setBounce(0.28, 0.16);
    body.setDrag(16, 0);
    body.setAngularDrag(40);
    body.setFriction(0.08, 0);
    body.setMass(Math.max(0.2, flakPieceArea(piece) / 1300));
    body.pushable = true;
    body.setCollideWorldBounds(false);
    body.setMaxVelocity(920, 1600);
    body.setAllowRotation(true);
    this.applyFacing(flipX);
  }

  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  applyFacing(flipX: boolean): void {
    this.setFlipX(flipX);
    const box = flakPieceBounds(this.piece);
    const insetX = box.w * 0.06;
    const insetY = box.h * 0.06;
    const body = this.arcadeBody;
    body.setSize(Math.max(10, box.w - insetX * 2), Math.max(10, box.h - insetY * 2));
    if (flipX) {
      body.setOffset(HERO_FLAK_SIZE - box.x - box.w + insetX, box.y + insetY);
    } else {
      body.setOffset(box.x + insetX, box.y + insetY);
    }
  }

  snapshot(): FlakSnapshot {
    const body = this.arcadeBody;
    return {
      piece: this.piece,
      x: this.x,
      y: this.y,
      vx: body.velocity.x,
      vy: body.velocity.y,
      angle: this.angle,
      angularVelocity: body.angularVelocity,
      scale: this.scaleX,
      flipX: this.flipX,
    };
  }

  applyMotion(vx: number, vy: number, angle: number, angularVelocity: number): void {
    this.setAngle(angle);
    this.arcadeBody.setVelocity(vx, vy);
    this.arcadeBody.setAngularVelocity(angularVelocity);
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    const body = this.body;
    if (!body || !(body instanceof Phaser.Physics.Arcade.Body) || !body.enable) {
      return;
    }
    const grounded = body.blocked.down || body.touching.down;
    if (grounded) {
      body.setDragX(42);
      body.setAngularDrag(220);
      return;
    }
    body.setDragX(14);
    body.setAngularDrag(28);
  }
}
