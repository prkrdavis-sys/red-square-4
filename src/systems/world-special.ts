import Phaser from 'phaser';
import { GAME_WIDTH, STOMP_BOUNCE_VELOCITY, TILE, type SpecialKind, type Theme } from '../config';
import { Baddie } from '../entities/Baddie';
import { EnemyProjectile } from '../entities/EnemyProjectile';
import { Player } from '../entities/Player';
import type { BuiltLevel } from '../levels/builder';
import { onewayTileKey } from './textures';

const COOLDOWNS: Record<SpecialKind, number> = {
  grow: 1100,
  'ice-slide': 900,
  burrow: 1250,
  'bubble-pulse': 1000,
  'shadow-blink': 1050,
};

const LABELS: Record<SpecialKind, string> = {
  grow: 'GROW',
  'ice-slide': 'SLIDE',
  burrow: 'BURROW',
  'bubble-pulse': 'BUBBLE',
  'shadow-blink': 'BLINK',
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
    return LABELS[this.kind];
  }

  get ready(): boolean {
    return this.scene.time.now >= this.readyAt;
  }

  get cooldownRatio(): number {
    const remaining = Math.max(0, this.readyAt - this.scene.time.now);
    return remaining / COOLDOWNS[this.kind];
  }

  activate(player: Player, direction: number): boolean {
    if (!this.ready || player.frozen) {
      return false;
    }
    this.readyAt = this.scene.time.now + COOLDOWNS[this.kind];
    this.exposeNearbyEnemies(player.x, player.y, this.kind === 'bubble-pulse' ? 260 : 190);

    switch (this.kind) {
      case 'grow':
        this.growPlatform(player, direction);
        break;
      case 'ice-slide':
        this.iceSlide(player, direction);
        break;
      case 'burrow':
        this.burrow(player, direction);
        break;
      case 'bubble-pulse':
        this.bubblePulse(player);
        break;
      case 'shadow-blink':
        this.shadowBlink(player, direction);
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
    const x = Phaser.Math.Clamp(player.x + direction * 86, TILE, this.built.widthPx - TILE);
    const y = Phaser.Math.Clamp(player.y + 70, TILE * 2, this.built.heightPx - TILE * 2);
    const platform = this.built.oneways.create(x - TILE / 2, y, onewayTileKey(this.theme)) as Phaser.Physics.Arcade.Sprite;
    platform.setOrigin(0, 0);
    platform.setDisplaySize(TILE * 2, 18);
    platform.setTint(0x8ee36d);
    const body = platform.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(TILE * 2, 18);
    body.updateFromGameObject();
    this.scene.tweens.add({
      targets: platform,
      alpha: 0,
      delay: 2200,
      duration: 350,
      onComplete: () => platform.destroy(),
    });
  }

  private iceSlide(player: Player, direction: number): void {
    this.affectPuzzleTargets(player.x, 'ice-wall', 220);
    player.arcadeBody.setVelocityX(direction * 560);
    player.arcadeBody.setVelocityY(Math.min(player.arcadeBody.velocity.y, -80));
    player.setTint(0xbcecff);
    this.scene.time.delayedCall(360, () => player.clearTint());
    this.neutralizeProjectiles(player.x, player.y, 180, direction);
  }

  private burrow(player: Player, direction: number): void {
    player.setAlpha(0.35);
    player.arcadeBody.checkCollision.none = true;
    player.arcadeBody.setVelocity(direction * 380, 80);
    this.scene.time.delayedCall(330, () => {
      player.arcadeBody.checkCollision.none = false;
      player.setAlpha(1);
      player.arcadeBody.setVelocity(direction * 250, STOMP_BOUNCE_VELOCITY);
    });
  }

  private bubblePulse(player: Player): void {
    this.affectPuzzleTargets(player.x, 'down-current', 260);
    player.arcadeBody.setVelocityY(-620);
    const bubble = this.built.oneways.create(player.x - 34, player.y + 58, 'special-anchor-ocean') as Phaser.Physics.Arcade.Sprite;
    bubble.setOrigin(0, 0);
    bubble.setDisplaySize(68, 18);
    const body = bubble.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(68, 18);
    body.updateFromGameObject();
    this.scene.tweens.add({
      targets: bubble,
      y: bubble.y - 170,
      alpha: 0,
      duration: 1900,
      onUpdate: () => body.updateFromGameObject(),
      onComplete: () => bubble.destroy(),
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

  private affectPuzzleTargets(x: number, kind: string, radius: number): void {
    for (const child of this.built.puzzleTargets.getChildren()) {
      const target = child as Phaser.Physics.Arcade.Sprite;
      if (!target.active || target.getData('kind') !== kind || Math.abs(target.x - x) > radius) {
        continue;
      }
      if (kind === 'ice-wall') {
        this.scene.tweens.add({
          targets: target,
          scaleY: 0,
          alpha: 0,
          duration: 180,
          onComplete: () => target.destroy(),
        });
      } else {
        const body = target.body as Phaser.Physics.Arcade.StaticBody;
        body.enable = false;
        target.setAlpha(0.12);
        this.scene.time.delayedCall(1200, () => {
          if (target.active) {
            body.enable = true;
            target.setAlpha(kind === 'down-current' ? 0.42 : 0.9);
          }
        });
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

  private neutralizeProjectiles(x: number, y: number, radius: number, direction: number): void {
    for (const child of this.built.projectiles.getChildren()) {
      if (child instanceof EnemyProjectile && Phaser.Math.Distance.Between(x, y, child.x, child.y) <= radius) {
        child.neutralize(direction);
      }
    }
  }
}
