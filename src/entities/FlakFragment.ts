import Phaser from 'phaser';

export type FlakKind = 'chunk' | 'shard' | 'sliver' | 'char' | 'gold';

export interface FlakSnapshot {
  kind: FlakKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVelocity: number;
  scale: number;
}

export function flakTexture(kind: FlakKind): string {
  switch (kind) {
    case 'chunk':
      return 'flak-chunk';
    case 'shard':
      return 'flak-shard';
    case 'sliver':
      return 'flak-sliver';
    case 'char':
      return 'flak-char';
    case 'gold':
      return 'flak-gold';
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

function flakMass(kind: FlakKind): number {
  switch (kind) {
    case 'chunk':
      return 0.48;
    case 'shard':
      return 0.3;
    case 'sliver':
      return 0.14;
    case 'char':
      return 0.24;
    case 'gold':
      return 0.16;
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

export class FlakFragment extends Phaser.Physics.Arcade.Sprite {
  readonly kind: FlakKind;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: FlakKind, scale = 1) {
    super(scene, x, y, flakTexture(kind));
    this.kind = kind;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(21);
    this.setScale(scale);
    const body = this.arcadeBody;
    body.setBounce(0.34, 0.18);
    body.setDrag(16, 0);
    body.setAngularDrag(40);
    body.setFriction(0.08, 0);
    body.setMass(flakMass(kind));
    body.pushable = true;
    body.setCollideWorldBounds(false);
    body.setMaxVelocity(920, 1600);
    body.setAllowRotation(true);
    const hit = Math.max(8, Math.min(this.displayWidth, this.displayHeight) * 0.82);
    body.setSize(hit, hit, true);
  }

  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  snapshot(): FlakSnapshot {
    const body = this.arcadeBody;
    return {
      kind: this.kind,
      x: this.x,
      y: this.y,
      vx: body.velocity.x,
      vy: body.velocity.y,
      angle: this.angle,
      angularVelocity: body.angularVelocity,
      scale: this.scaleX,
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
