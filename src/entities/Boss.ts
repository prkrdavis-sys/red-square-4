import Phaser from 'phaser';
import { type BossKind, type MiniBossVariant, type Theme } from '../config';
import { maybeShake } from '../data/settings';
import type { ArenaKeep } from '../levels/arena';
import { audio } from '../systems/audio';
import { miniBossTextureKey, worldBossTextureKey, type CharacterPose } from '../systems/characters';

type BossState = 'waiting' | 'telegraph' | 'attack' | 'recovery';

const WORLD_BOSS_NAMES: Record<BossKind, string> = {
  hopper: 'Crowned Briar Boar',
  slider: 'Walrus Duke',
  slam: 'Buried Sphinx',
  swimmer: 'Abyssal Octopus',
  charger: 'Many-Eyed Raven King',
};

const MINI_FAMILIES: Record<Theme, string> = {
  grass: 'Turnip Trickster',
  snow: 'Frostcap Rascal',
  desert: 'Dune Mask',
  ocean: 'Coral Jester',
  castle: 'Clockwork Page',
};

export class Boss extends Phaser.Physics.Arcade.Sprite {
  kind: BossKind;
  hp: number;
  maxHp: number;
  dying = false;
  engaged = false;
  invulnUntil = 0;
  private hopUntil = 0;
  private slamPhase: 'idle' | 'up' | 'down' = 'idle';
  private chargeDir = -1;
  private spawnY: number;
  private arena: ArenaKeep | undefined;
  private readonly theme: Theme;
  private readonly miniVariant: MiniBossVariant | undefined;
  private bossState: BossState = 'waiting';
  private stateUntil = 0;
  private phase = 1;
  private attackIndex = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    kind: BossKind,
    hp: number,
    theme: Theme,
    miniVariant?: MiniBossVariant,
  ) {
    super(
      scene,
      x,
      y,
      miniVariant ? miniBossTextureKey(theme, miniVariant, 'idle') : worldBossTextureKey(kind, 'idle'),
    );
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.kind = kind;
    this.hp = hp;
    this.maxHp = hp;
    this.theme = theme;
    this.miniVariant = miniVariant;
    this.spawnY = y;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setBounce(0.05, 0);
    body.setCollideWorldBounds(true);
    body.setMaxVelocity(360, 1400);
    this.setDepth(16);
    if (hp === 1) {
      this.setScale(1.3 + (miniVariant ?? 1) * 0.08);
    } else {
      this.setScale(2.15);
    }
  }

  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  get isInvulnerable(): boolean {
    return this.scene.time.now < this.invulnUntil;
  }

  get encounterName(): string {
    return this.miniVariant
      ? `${MINI_FAMILIES[this.theme]} ${this.miniVariant}`
      : WORLD_BOSS_NAMES[this.kind];
  }

  setArena(arena: ArenaKeep): void {
    this.arena = arena;
    this.contain();
  }

  engage(): void {
    this.engaged = true;
    this.bossState = 'telegraph';
    this.stateUntil = this.scene.time.now + this.telegraphDuration();
  }

  /** Wait in the arena until the player arrives. */
  guard(): void {
    if (this.dying) {
      return;
    }
    const body = this.arcadeBody;
    const now = this.scene.time.now;
    body.setVelocityX(0);
    if (this.kind === 'swimmer') {
      body.allowGravity = false;
      body.setVelocityY((this.swimTargetY(now) - this.y) * 2.4);
    }
    this.present('idle');
    this.contain();
  }

  takeStomp(): 'hit' | 'dead' | 'ignored' {
    if (this.dying || this.isInvulnerable || this.bossState !== 'recovery') {
      return 'ignored';
    }
    this.hp -= 1;
    this.phase = Math.min(3, this.maxHp - this.hp + 1);
    if (this.maxHp > 1 && this.hp > 0) {
      audio.play(this.scene, 'phase');
    }
    this.bossState = 'recovery';
    this.stateUntil = this.scene.time.now + 620;
    this.invulnUntil = this.scene.time.now + 650;
    this.present('hurt');
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => this.clearTint());
    if (this.hp <= 0) {
      return 'dead';
    }
    this.scene.tweens.add({
      targets: this,
      scaleX: this.scaleX * 1.12,
      scaleY: this.scaleY * 0.86,
      yoyo: true,
      duration: 90,
    });
    return 'hit';
  }

  poofAway(): void {
    this.dying = true;
    this.present('dead');
    this.arcadeBody.enable = false;
    const scene = this.scene;
    const particles = scene.add.particles(this.x, this.y, 'poof-particle', {
      speed: { min: 40, max: 220 },
      scale: { start: 1.4, end: 0 },
      lifespan: 520,
      quantity: 28,
      emitting: false,
    });
    particles.explode(32);
    scene.tweens.add({
      targets: this,
      scale: 0,
      alpha: 0,
      angle: 40,
      duration: 280,
      ease: 'Back.easeIn',
      onComplete: () => this.destroy(),
    });
    scene.time.delayedCall(500, () => particles.destroy());
  }

  chase(player: Phaser.Physics.Arcade.Sprite, solids: Phaser.Physics.Arcade.StaticGroup): void {
    if (this.dying) {
      return;
    }
    const body = this.arcadeBody;
    const now = this.scene.time.now;
    const dir = this.chaseDir(player.x);
    this.setFlipX(player.x > this.x);

    if (this.bossState === 'telegraph') {
      body.setVelocityX(body.velocity.x * 0.82);
      this.present('attack');
      const pulse = 0.8 + Math.sin(now / 55) * 0.18;
      this.setAlpha(pulse);
      if (now >= this.stateUntil) {
        this.setAlpha(1);
        this.bossState = 'attack';
        this.stateUntil = now + this.attackDuration();
        this.startAttack(player, dir);
      }
    } else if (this.bossState === 'attack') {
      this.present('move');
      this.continueAttack(player, dir);
      if (now >= this.stateUntil) {
        this.bossState = 'recovery';
        this.stateUntil = now + this.recoveryDuration();
        body.setAccelerationX(0);
        body.setDragX(420);
        this.present('hurt');
      }
    } else if (this.bossState === 'recovery') {
      body.setVelocityX(body.velocity.x * 0.84);
      this.present('hurt');
      if (now >= this.stateUntil) {
        this.bossState = 'telegraph';
        this.stateUntil = now + this.telegraphDuration();
        this.attackIndex += 1;
      }
    } else {
      this.bossState = 'telegraph';
      this.stateUntil = now + this.telegraphDuration();
    }

    void solids;
    this.contain();
  }

  private startAttack(player: Phaser.Physics.Arcade.Sprite, dir: number): void {
    const body = this.arcadeBody;
    const speedBonus = this.phase * 35 + (this.miniVariant ?? 0) * 18;
    switch (this.kind) {
      case 'hopper':
        body.setVelocity(dir * (145 + speedBonus), -430 - this.phase * 55);
        break;
      case 'slider':
        body.setVelocity(dir * (280 + speedBonus), this.phase === 3 ? -220 : 0);
        break;
      case 'slam':
        this.slamPhase = 'up';
        body.setVelocity(dir * 65, -500 - this.phase * 45);
        break;
      case 'swimmer':
        body.allowGravity = false;
        body.setVelocity(dir * (170 + speedBonus), Phaser.Math.Clamp((player.y - this.y) * 2.5, -260, 260));
        break;
      case 'charger':
        this.chargeDir = dir === 0 ? this.chargeDir * -1 : dir;
        body.setVelocity(this.chargeDir * (320 + speedBonus), this.phase >= 2 ? -260 : 0);
        break;
      default: {
        const neverKind: never = this.kind;
        return neverKind;
      }
    }
  }

  private continueAttack(player: Phaser.Physics.Arcade.Sprite, dir: number): void {
    const body = this.arcadeBody;
    switch (this.kind) {
      case 'hopper':
        if (body.blocked.down && this.phase >= 2 && this.scene.time.now > this.hopUntil) {
          body.setVelocity(dir * (170 + this.phase * 25), -390);
          this.hopUntil = this.scene.time.now + 360;
        }
        break;
      case 'slider':
        body.setAccelerationX(dir * (360 + this.phase * 90));
        if (body.blocked.left || body.blocked.right) {
          body.setVelocityX(-Math.sign(body.velocity.x || dir) * (240 + this.phase * 35));
        }
        break;
      case 'slam':
        if (this.slamPhase === 'up' && body.velocity.y > 0) {
          this.slamPhase = 'down';
          body.setVelocityY(690 + this.phase * 80);
        } else if (this.slamPhase === 'down' && body.blocked.down) {
          this.slamPhase = 'idle';
          maybeShake(this.scene, 110, 0.006 + this.phase * 0.002);
        }
        break;
      case 'swimmer':
        body.allowGravity = false;
        body.setVelocityY(Phaser.Math.Clamp((player.y - this.y) * (2 + this.phase * 0.5), -300, 300));
        break;
      case 'charger':
        if (body.blocked.left || body.blocked.right) {
          this.chargeDir *= -1;
          body.setVelocityX(this.chargeDir * (280 + this.phase * 45));
        }
        break;
      default: {
        const neverKind: never = this.kind;
        return neverKind;
      }
    }
  }

  private telegraphDuration(): number {
    return Math.max(460, 900 - this.phase * 100 - (this.miniVariant ?? 0) * 45);
  }

  private attackDuration(): number {
    return 620 + this.phase * 120 + (this.miniVariant ?? 0) * 80;
  }

  private recoveryDuration(): number {
    return Math.max(430, 760 - this.phase * 70);
  }

  private present(pose: CharacterPose): void {
    const texture = this.miniVariant
      ? miniBossTextureKey(this.theme, this.miniVariant, pose)
      : worldBossTextureKey(this.kind, pose);
    this.setTexture(texture);
  }

  private swimTargetY(now: number): number {
    const raw = this.spawnY + Math.sin(now / 280) * 70;
    const edges = this.edges();
    if (!edges) {
      return raw;
    }
    return Phaser.Math.Clamp(raw, edges.minY, edges.maxY);
  }

  private chaseDir(playerX: number): number {
    const want = Math.sign(playerX - this.x) || -1;
    const edges = this.edges();
    if (!edges) {
      return want;
    }
    if (want < 0 && this.x <= edges.minX + 4) {
      return 0;
    }
    if (want > 0 && this.x >= edges.maxX - 4) {
      return 0;
    }
    return want;
  }

  private contain(): void {
    const edges = this.edges();
    if (!edges) {
      return;
    }
    const body = this.arcadeBody;
    if (this.x < edges.minX) {
      this.setX(edges.minX);
      if (body.velocity.x < 0) {
        body.setVelocityX(this.kind === 'charger' || this.kind === 'slider' ? -body.velocity.x * 0.65 : 0);
      }
    } else if (this.x > edges.maxX) {
      this.setX(edges.maxX);
      if (body.velocity.x > 0) {
        body.setVelocityX(this.kind === 'charger' || this.kind === 'slider' ? -body.velocity.x * 0.65 : 0);
      }
    }
    if (this.kind !== 'swimmer') {
      return;
    }
    if (this.y < edges.minY) {
      this.setY(edges.minY);
      if (body.velocity.y < 0) {
        body.setVelocityY(0);
      }
    } else if (this.y > edges.maxY) {
      this.setY(edges.maxY);
      if (body.velocity.y > 0) {
        body.setVelocityY(0);
      }
    }
  }

  private edges(): { minX: number; maxX: number; minY: number; maxY: number } | undefined {
    if (!this.arena) {
      return undefined;
    }
    const body = this.arcadeBody;
    const halfW = Math.max(12, body.width * 0.5);
    const halfH = Math.max(12, body.height * 0.5);
    return {
      minX: this.arena.left + halfW,
      maxX: this.arena.right - halfW,
      minY: this.arena.top + halfH,
      maxY: this.arena.bottom - halfH,
    };
  }
}
