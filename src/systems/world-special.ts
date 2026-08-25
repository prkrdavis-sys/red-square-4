import Phaser from 'phaser';
import { GAME_WIDTH, TILE, type PuzzleKind, type SpecialKind, type Theme } from '../config';
import { Baddie } from '../entities/Baddie';
import { EnemyProjectile } from '../entities/EnemyProjectile';
import { Player } from '../entities/Player';
import { TerrainHazard } from '../entities/TerrainHazard';
import type { BuiltLevel } from '../levels/builder';
import { enableOneWayCollision, ONEWAY_HEIGHT } from '../levels/colliders';
import { specialChargeRatio } from './special-cooldown';
import { specialLabel } from './special-copy';
import { onewayTileKey } from './textures';

const COOLDOWNS: Record<SpecialKind, number> = {
  grow: 1100,
  'frost-path': 1000,
  'sand-surge': 1100,
  'bubble-pulse': 1000,
  'shadow-blink': 1050,
  'liana-swing': 1000,
};

export class WorldSpecial {
  private readyAt = 0;
  private readonly scene: Phaser.Scene;
  private readonly built: BuiltLevel;
  private readonly theme: Theme;
  readonly kind: SpecialKind;

  constructor(scene: Phaser.Scene, built: BuiltLevel, theme: Theme, kind: SpecialKind) {
    this.scene = scene;
    this.built = built;
    this.theme = theme;
    this.kind = kind;
  }

  get label(): string {
    return specialLabel(this.kind);
  }

  get ready(): boolean {
    return this.scene.time.now >= this.readyAt;
  }

  get cooldownRatio(): number {
    const remaining = Math.max(0, this.readyAt - this.scene.time.now);
    return remaining / COOLDOWNS[this.kind];
  }

  get chargeRatio(): number {
    return specialChargeRatio(this.cooldownRatio);
  }

  activate(player: Player, direction: number): boolean {
    if (!this.ready || player.frozen) {
      return false;
    }
    this.readyAt = this.scene.time.now + COOLDOWNS[this.kind];
    const reach = this.kind === 'bubble-pulse' ? 260 : 190;
    this.exposeNearbyEnemies(player.x, player.y, reach);
    this.silenceNearbyHazards(player.x, player.y, reach);

    switch (this.kind) {
      case 'grow':
        this.growPlatform(player, direction);
        break;
      case 'frost-path':
        this.frostPath(player, direction);
        break;
      case 'sand-surge':
        this.sandSurge(player, direction);
        break;
      case 'bubble-pulse':
        this.bubblePulse(player);
        break;
      case 'shadow-blink':
        this.shadowBlink(player, direction);
        break;
      case 'liana-swing':
        this.lianaSwing(player, direction);
        break;
      default: {
        const neverKind: never = this.kind;
        return neverKind;
      }
    }
    return true;
  }

  private growPlatform(player: Player, direction: number): void {
    this.affectPuzzleTargets(player.x, 'vine-bed', 220);
    const ahead = TILE * 0.75;
    const x = Phaser.Math.Clamp(player.x + direction * ahead, TILE, this.built.widthPx - TILE);
    const y = Phaser.Math.Clamp(player.y + 70, TILE * 2, this.built.heightPx - TILE * 2);
    const platform = this.built.oneways.create(x - TILE, y, onewayTileKey(this.theme)) as Phaser.Physics.Arcade.Sprite;
    platform.setOrigin(0, 0);
    platform.setDisplaySize(TILE * 2, ONEWAY_HEIGHT);
    platform.setTint(0x8ee36d);
    const body = platform.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(TILE * 2, ONEWAY_HEIGHT);
    body.updateFromGameObject();
    enableOneWayCollision(body);
    this.scene.tweens.add({
      targets: platform,
      alpha: 0,
      delay: 2200,
      duration: 350,
      onComplete: () => platform.destroy(),
    });
  }

  private frostPath(player: Player, direction: number): void {
    this.affectPuzzleTargets(player.x, 'ice-wall', 240);
    player.grantSafety(420);
    player.burstSpeed(520, 420);
    player.arcadeBody.setVelocityX(direction * 500);
    player.arcadeBody.setVelocityY(Math.min(player.arcadeBody.velocity.y, -60));
    player.flashTint(0xbcecff, 400);
    const y = Phaser.Math.Clamp(player.arcadeBody.bottom - 4, TILE * 2, this.built.heightPx - TILE);
    for (let i = 0; i < 4; i += 1) {
      const along = 28 + i * TILE;
      const x = Phaser.Math.Clamp(
        player.x + (direction > 0 ? along : -along - TILE),
        TILE,
        this.built.widthPx - TILE * 2,
      );
      this.spawnTempOneway(x, y, TILE, 0xbcecff, 1600 + i * 80);
    }
    this.neutralizeProjectiles(player.x, player.y, 200, direction);
  }

  private sandSurge(player: Player, direction: number): void {
    this.affectPuzzleTargets(player.x, 'sand-wall', 240);
    player.grantSafety(480);
    player.burstSpeed(540, 400);
    player.arcadeBody.setVelocity(direction * 520, Math.min(player.arcadeBody.velocity.y, -280));
    player.flashTint(0xe7bd61, 380);
    const y = Phaser.Math.Clamp(player.arcadeBody.bottom + 8, TILE * 2, this.built.heightPx - TILE);
    const along = 24;
    this.spawnTempOneway(
      Phaser.Math.Clamp(
        player.x + (direction > 0 ? along : -along - TILE * 2),
        TILE,
        this.built.widthPx - TILE * 3,
      ),
      y,
      TILE * 2,
      0xe7bd61,
      1500,
    );
    this.neutralizeProjectiles(player.x, player.y, 200, direction);
  }

  private bubblePulse(player: Player): void {
    this.affectPuzzleTargets(player.x, 'down-current', 260);
    player.arcadeBody.setVelocityY(-620);
    const lift = this.built.oneways.create(player.x - 34, player.y + 58, 'special-anchor-ocean') as Phaser.Physics.Arcade.Sprite;
    lift.setOrigin(0, 0);
    lift.setDisplaySize(68, ONEWAY_HEIGHT);
    lift.setVisible(false);
    const body = lift.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(68, ONEWAY_HEIGHT);
    body.updateFromGameObject();
    enableOneWayCollision(body);
    const shell = this.scene.add.image(player.x, player.y + 6, 'special-bubble');
    shell.setDepth(21);
    shell.setDisplaySize(108, 116);
    this.scene.tweens.add({
      targets: lift,
      y: lift.y - 170,
      duration: 1900,
      onUpdate: () => {
        body.updateFromGameObject();
        if (player.active) {
          shell.setPosition(player.x, player.y + 6);
        }
      },
      onComplete: () => {
        lift.destroy();
        shell.destroy();
      },
    });
    this.scene.tweens.add({
      targets: shell,
      alpha: 0,
      duration: 1900,
    });
    this.neutralizeProjectiles(player.x, player.y, 260, player.flipX ? -1 : 1);
  }

  private shadowBlink(player: Player, direction: number): void {
    const targetX = Phaser.Math.Clamp(player.x + direction * 190, TILE, this.built.widthPx - TILE);
    player.setAlpha(0.2);
    player.setX(targetX);
    player.arcadeBody.setVelocityX(direction * 210);
    player.arcadeBody.setVelocityY(Math.min(player.arcadeBody.velocity.y, -120));
    player.grantSafety(480);
    this.neutralizeProjectiles(player.x, player.y, GAME_WIDTH * 0.18, direction);
    this.scene.time.delayedCall(100, () => player.setAlpha(1));
  }

  private lianaSwing(player: Player, direction: number): void {
    this.affectPuzzleTargets(player.x, 'moss-curtain', 240);
    this.neutralizeProjectiles(player.x, player.y, 200, direction);

    const pivotX = Phaser.Math.Clamp(player.x + direction * 48, TILE, this.built.widthPx - TILE);
    const pivotY = Math.max(20, player.y - 164);
    const length = Math.max(8, Phaser.Math.Distance.Between(pivotX, pivotY, player.x, player.y));
    const startAngle = Math.atan2(player.x - pivotX, player.y - pivotY);
    const endAngle = Phaser.Math.Clamp(startAngle + direction * 1.42, -1.25, 1.25);

    const vine = this.scene.add.graphics();
    vine.setDepth(18);
    player.beginSwing();
    player.grantSafety(520);
    player.flashTint(0x8ee36d, 420);

    const swing = { t: 0 };
    let settled = false;
    const settle = (launch: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (launch) {
        player.burstSpeed(520, 420);
      }
      player.endSwing(launch ? direction * 420 : 0, launch ? -480 : 0);
      if (!vine.active) {
        return;
      }
      if (!launch) {
        vine.destroy();
        return;
      }
      this.scene.tweens.add({
        targets: vine,
        alpha: 0,
        duration: 220,
        onComplete: () => vine.destroy(),
      });
    };

    const place = (t: number): void => {
      if (settled || !player.active || player.frozen) {
        settle(false);
        return;
      }
      const angle = Phaser.Math.Linear(startAngle, endAngle, t);
      const x = Phaser.Math.Clamp(
        pivotX + Math.sin(angle) * length,
        TILE * 0.5,
        this.built.widthPx - TILE * 0.5,
      );
      const y = Phaser.Math.Clamp(
        pivotY + Math.cos(angle) * length,
        TILE * 0.5,
        this.built.heightPx - TILE * 0.5,
      );
      player.setPosition(x, y);
      player.arcadeBody.allowGravity = false;
      player.arcadeBody.setVelocity(0, 0);
      player.poseOnVine(Phaser.Math.RadToDeg(angle) * 0.55);
      drawSwingVine(vine, pivotX, pivotY, x + direction * 8, y - 14, t, direction);
    };

    place(0);
    this.scene.tweens.add({
      targets: swing,
      t: 1,
      duration: 420,
      ease: 'Sine.easeIn',
      onUpdate: () => place(swing.t),
      onComplete: () => settle(true),
    });
  }

  private spawnTempOneway(x: number, y: number, width: number, tint: number, life: number): void {
    const platform = this.built.oneways.create(x, y, onewayTileKey(this.theme)) as Phaser.Physics.Arcade.Sprite;
    platform.setOrigin(0, 0);
    platform.setDisplaySize(width, ONEWAY_HEIGHT);
    platform.setTint(tint);
    const body = platform.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(width, ONEWAY_HEIGHT);
    body.updateFromGameObject();
    enableOneWayCollision(body);
    this.scene.tweens.add({
      targets: platform,
      alpha: 0,
      delay: life,
      duration: 280,
      onComplete: () => platform.destroy(),
    });
  }

  private affectPuzzleTargets(x: number, kind: PuzzleKind, radius: number): void {
    for (const child of this.built.puzzleTargets.getChildren()) {
      const target = child as Phaser.Physics.Arcade.Sprite;
      if (!target.active || target.getData('kind') !== kind || puzzleReach(target, x) > radius) {
        continue;
      }
      switch (kind) {
        case 'ice-wall':
        case 'sand-wall':
        case 'moss-curtain':
          this.scene.tweens.add({
            targets: target,
            scaleY: 0,
            alpha: 0,
            duration: 180,
            onComplete: () => target.destroy(),
          });
          break;
        case 'vine-bed':
        case 'down-current':
        case 'shadow-wall': {
          const body = target.body as Phaser.Physics.Arcade.StaticBody;
          body.enable = false;
          target.setAlpha(kind === 'down-current' ? 0 : 0.12);
          setDownCurrentFx(target, false);
          this.scene.time.delayedCall(1200, () => {
            if (target.active) {
              body.enable = true;
              target.setAlpha(kind === 'down-current' ? 0 : 0.9);
              setDownCurrentFx(target, true);
            }
          });
          break;
        }
        default: {
          const neverKind: never = kind;
          return neverKind;
        }
      }
    }
  }

  private exposeNearbyEnemies(x: number, y: number, radius: number): void {
    for (const child of this.built.baddies.getChildren()) {
      if (child instanceof Baddie && Phaser.Math.Distance.Between(x, y, child.x, child.y) <= radius) {
        child.exposeBySpecial();
      }
    }
  }

  private silenceNearbyHazards(x: number, y: number, radius: number): void {
    for (const child of this.built.traps.getChildren()) {
      if (child instanceof TerrainHazard && Phaser.Math.Distance.Between(x, y, child.x, child.y) <= radius) {
        child.silence();
      }
    }
  }

  private neutralizeProjectiles(x: number, y: number, radius: number, direction: number): void {
    for (const child of this.built.projectiles.getChildren()) {
      if (child instanceof EnemyProjectile && Phaser.Math.Distance.Between(x, y, child.x, child.y) <= radius) {
        child.neutralize(direction);
      }
    }
  }
}

function puzzleReach(target: Phaser.Physics.Arcade.Sprite, x: number): number {
  const body = target.body as Phaser.Physics.Arcade.StaticBody | null;
  if (!body) {
    return Math.abs(target.x - x);
  }
  const nearest = Phaser.Math.Clamp(x, body.left, body.right);
  return Math.abs(nearest - x);
}

function setDownCurrentFx(target: Phaser.Physics.Arcade.Sprite, enabled: boolean): void {
  const flow = target.getData('flow') as Phaser.GameObjects.TileSprite | undefined;
  const badge = target.getData('badge') as Phaser.GameObjects.Image | undefined;
  const edges = target.getData('edges') as Phaser.GameObjects.Rectangle[] | undefined;
  flow?.setAlpha(enabled ? 0.58 : 0.1);
  badge?.setAlpha(enabled ? 1 : 0.22);
  for (const edge of edges ?? []) {
    edge.setAlpha(enabled ? 0.42 : 0.08);
  }
}

function quadPoint(
  t: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u * u * x0 + 2 * u * t * x1 + t * t * x2,
    y: u * u * y0 + 2 * u * t * y1 + t * t * y2,
  };
}

function quadTangent(
  t: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: 2 * u * (x1 - x0) + 2 * t * (x2 - x1),
    y: 2 * u * (y1 - y0) + 2 * t * (y2 - y1),
  };
}

function drawLeaf(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  angle: number,
  length: number,
  color: number,
): void {
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const tipX = x + ca * length;
  const tipY = y + sa * length;
  const wx = -sa * length * 0.38;
  const wy = ca * length * 0.38;
  g.fillStyle(color, 1);
  g.fillTriangle(x, y, tipX + wx, tipY + wy, tipX - wx, tipY - wy);
  g.fillStyle(0xc8e8d8, 0.4);
  g.fillTriangle(
    x,
    y,
    x + ca * length * 0.42 + wx * 0.32,
    y + sa * length * 0.42 + wy * 0.32,
    x + ca * length * 0.52,
    y + sa * length * 0.52,
  );
}

function drawSwingVine(
  g: Phaser.GameObjects.Graphics,
  ax: number,
  ay: number,
  hx: number,
  hy: number,
  taut: number,
  direction: number,
): void {
  const dx = hx - ax;
  const dy = hy - ay;
  const sag = (1 - taut) * 34;
  const cpx = ax + dx * 0.5 + direction * sag * 0.22;
  const cpy = ay + dy * 0.48 + sag;

  g.clear();

  const stroke = (width: number, color: number, alpha: number, ox: number, oy: number): void => {
    g.lineStyle(width, color, alpha);
    g.beginPath();
    for (let i = 0; i <= 12; i += 1) {
      const p = quadPoint(i / 12, ax + ox, ay + oy, cpx + ox, cpy + oy, hx + ox, hy + oy);
      if (i === 0) {
        g.moveTo(p.x, p.y);
      } else {
        g.lineTo(p.x, p.y);
      }
    }
    g.strokePath();
  };

  stroke(11, 0x0a1810, 0.3, 5, 7);
  stroke(9, 0x4a3018, 1, 0, 0);
  stroke(5.2, 0x1e5a28, 0.92, -1.2, -1);
  stroke(2.2, 0x8ab05a, 0.55, -2.2, -2);

  g.fillStyle(0x3d2a14, 1);
  g.fillCircle(ax, ay, 7);
  g.fillStyle(0x1e5a28, 1);
  g.fillEllipse(ax - 10, ay - 2, 22, 10);
  g.fillStyle(0x3d8a32, 1);
  g.fillEllipse(ax + 8, ay + 2, 16, 8);
  g.fillStyle(0x8ee36d, 1);
  g.fillCircle(ax + 6, ay - 4, 2.4);

  const leaves: Array<{ t: number; len: number; color: number; side: number }> = [
    { t: 0.22, len: 18, color: 0x2a6b28, side: -1 },
    { t: 0.38, len: 22, color: 0x3d8a32, side: 1 },
    { t: 0.55, len: 16, color: 0x1e5a28, side: -1 },
    { t: 0.72, len: 20, color: 0x8ab05a, side: 1 },
    { t: 0.86, len: 13, color: 0x3d8a32, side: -1 },
  ];
  for (const leaf of leaves) {
    const p = quadPoint(leaf.t, ax, ay, cpx, cpy, hx, hy);
    const tangent = quadTangent(leaf.t, ax, ay, cpx, cpy, hx, hy);
    drawLeaf(g, p.x, p.y, Math.atan2(tangent.y, tangent.x) + leaf.side * 0.95, leaf.len, leaf.color);
  }

  g.lineStyle(3.4, 0x1e5a28, 0.95);
  g.beginPath();
  g.arc(hx - direction * 4, hy + 6, 11, Math.PI * 0.15, Math.PI * 1.35, direction < 0);
  g.strokePath();
}
