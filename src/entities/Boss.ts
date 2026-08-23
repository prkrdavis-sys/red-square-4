import Phaser from 'phaser';
import { type BossKind, type MiniBossVariant, type Theme } from '../config';
import { maybeShake } from '../data/settings';
import type { ArenaKeep } from '../levels/arena';
import { liftOntoFloor } from '../levels/colliders';
import { audio } from '../systems/audio';
import { miniBossTextureKey, worldBossTextureKey, type CharacterPose } from '../systems/characters';
import {
  estimatedOpaqueBounds,
  hurtboxFromOpaque,
  type SpriteOpaqueBounds,
} from './boss-combat';

type BossState = 'waiting' | 'telegraph' | 'attack' | 'recovery';

const opaqueBoundsCache = new Map<string, SpriteOpaqueBounds>();

function opaqueSpriteBounds(texture: Phaser.Textures.Texture, frame: Phaser.Textures.Frame): SpriteOpaqueBounds {
  const cached = opaqueBoundsCache.get(texture.key);
  if (cached) {
    return cached;
  }
  const fallback = estimatedOpaqueBounds(frame.realWidth, frame.realHeight);
  try {
    const source = texture.getSourceImage() as CanvasImageSource | undefined;
    if (!source || typeof document === 'undefined') {
      return fallback;
    }
    const width = frame.realWidth;
    const height = frame.realHeight;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return fallback;
    }
    ctx.drawImage(source, 0, 0);
    const pixels = ctx.getImageData(0, 0, width, height).data;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (pixels[(y * width + x) * 4 + 3] <= 12) {
          continue;
        }
        if (x < minX) {
          minX = x;
        }
        if (y < minY) {
          minY = y;
        }
        if (x > maxX) {
          maxX = x;
        }
        if (y > maxY) {
          maxY = y;
        }
      }
    }
    if (minX > maxX) {
      return fallback;
    }
    const bounds: SpriteOpaqueBounds = {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
    opaqueBoundsCache.set(texture.key, bounds);
    return bounds;
  } catch {
    return fallback;
  }
}

const WORLD_BOSS_NAMES: Record<BossKind, string> = {
  piranha: 'Snap-Maw',
  walrus: 'Glacier Tusker',
  scorpion: 'Dune Stinger',
  fish: 'Abyss Fang',
  gargoyle: 'Keep Gargoyle',
  howler: 'Canopy Howler',
};

const MINI_FAMILIES: Record<Theme, string> = {
  grass: 'Turnip Trickster',
  snow: 'Frostcap Rascal',
  desert: 'Dune Mask',
  ocean: 'Coral Jester',
  castle: 'Clockwork Page',
  rainforest: 'Leaf Rascal',
};

export class Boss extends Phaser.Physics.Arcade.Sprite {
  kind: BossKind;
  hp: number;
  maxHp: number;
  dying = false;
  engaged = false;
  invulnUntil = 0;
  private hopUntil = 0;
  private dashUntil = 0;
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
    body.setBounce(0, 0);
    body.setCollideWorldBounds(true);
    body.setMaxVelocity(360, 1400);
    body.pushable = false;
    this.setDepth(16);
    if (hp === 1) {
      this.setScale(1.3 + (miniVariant ?? 1) * 0.08);
    } else {
      this.applyWorldScale();
    }
    this.settleMotion();
    this.fitHitbox();
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
    this.settleMotion();
    if (this.swims()) {
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
      this.present('attack');
      this.continueAttack(player, dir);
      if (now >= this.stateUntil) {
        this.bossState = 'recovery';
        this.stateUntil = now + this.recoveryDuration();
        this.settleMotion();
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
    const now = this.scene.time.now;
    const speedBonus = this.phase * 35 + (this.miniVariant ?? 0) * 18;
    this.settleMotion();
    switch (this.kind) {
      case 'piranha':
        body.setVelocity(dir * (110 + speedBonus), -460 - this.phase * 50);
        this.dashUntil = now + 180;
        break;
      case 'walrus':
        body.setVelocity(dir * (300 + speedBonus), this.phase === 3 ? -180 : 0);
        body.setDragX(20);
        break;
      case 'scorpion':
        this.slamPhase = 'up';
        body.setVelocity(dir * 50, -540 - this.phase * 50);
        break;
      case 'fish': {
        body.allowGravity = false;
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.max(48, Math.hypot(dx, dy));
        const dash = 260 + speedBonus;
        body.setVelocity((dx / dist) * dash, (dy / dist) * dash);
        this.dashUntil = now + 240;
        break;
      }
      case 'gargoyle':
        this.chargeDir = dir === 0 ? this.chargeDir * -1 : dir;
        body.setGravityY(-this.scene.physics.world.gravity.y * 0.7);
        body.setVelocity(this.chargeDir * (340 + speedBonus), this.phase >= 2 ? -220 : -70);
        break;
      case 'howler':
        this.chargeDir = dir === 0 ? this.chargeDir * -1 : dir;
        body.setVelocity(this.chargeDir * (240 + speedBonus), -420 - this.phase * 45);
        break;
      default: {
        const neverKind: never = this.kind;
        return neverKind;
      }
    }
  }

  private continueAttack(player: Phaser.Physics.Arcade.Sprite, dir: number): void {
    const body = this.arcadeBody;
    const now = this.scene.time.now;
    switch (this.kind) {
      case 'piranha':
        if (body.velocity.y > 90) {
          body.setVelocityX(dir * (200 + this.phase * 28));
        }
        if (body.blocked.down && this.phase >= 2 && now > this.hopUntil) {
          body.setVelocity(dir * (140 + this.phase * 22), -340);
          this.hopUntil = now + 300;
        }
        break;
      case 'walrus':
        body.setAccelerationX(dir * (420 + this.phase * 110));
        if (body.blocked.left || body.blocked.right) {
          body.setVelocityX(-Math.sign(body.velocity.x || dir) * (280 + this.phase * 40));
        }
        break;
      case 'scorpion':
        if (this.slamPhase === 'up') {
          body.setVelocityX(dir * (55 + this.phase * 14));
          if (body.velocity.y > 0) {
            this.slamPhase = 'down';
            body.setVelocityY(760 + this.phase * 95);
          }
        } else if (this.slamPhase === 'down' && body.blocked.down) {
          this.slamPhase = 'idle';
          maybeShake(this.scene, 130, 0.007 + this.phase * 0.002);
        }
        break;
      case 'fish': {
        body.allowGravity = false;
        const wave = Math.sin(now / 70) * (24 + this.phase * 10);
        if (now < this.dashUntil) {
          body.setVelocityY(body.velocity.y + (player.y - this.y) * 0.04);
          break;
        }
        body.setVelocity(
          dir * (180 + this.phase * 35) + (player.x - this.x) * 0.12,
          Phaser.Math.Clamp((player.y - this.y) * (2.3 + this.phase * 0.45) + wave, -340, 340),
        );
        break;
      }
      case 'gargoyle':
        body.setGravityY(-this.scene.physics.world.gravity.y * 0.7);
        if (body.blocked.left || body.blocked.right) {
          this.chargeDir *= -1;
          body.setVelocityX(this.chargeDir * (300 + this.phase * 50));
        }
        break;
      case 'howler':
        if (body.blocked.left || body.blocked.right) {
          this.chargeDir *= -1;
          body.setVelocity(this.chargeDir * (230 + this.phase * 38), -280);
        }
        if (body.blocked.down && this.phase >= 2 && now > this.hopUntil) {
          body.setVelocity(dir * (160 + this.phase * 22), -400);
          this.hopUntil = now + 380;
        }
        break;
      default: {
        const neverKind: never = this.kind;
        return neverKind;
      }
    }
  }

  private telegraphDuration(): number {
    return Math.max(420, this.kindTelegraph() - this.phase * 90 - (this.miniVariant ?? 0) * 45);
  }

  private attackDuration(): number {
    return this.kindAttack() + this.phase * 110 + (this.miniVariant ?? 0) * 80;
  }

  private recoveryDuration(): number {
    return Math.max(400, this.kindRecovery() - this.phase * 70);
  }

  private kindTelegraph(): number {
    switch (this.kind) {
      case 'piranha':
        return 700;
      case 'walrus':
        return 980;
      case 'scorpion':
        return 860;
      case 'fish':
        return 620;
      case 'gargoyle':
        return 880;
      case 'howler':
        return 820;
      default: {
        const neverKind: never = this.kind;
        return neverKind;
      }
    }
  }

  private kindAttack(): number {
    switch (this.kind) {
      case 'piranha':
        return 540;
      case 'walrus':
        return 780;
      case 'scorpion':
        return 640;
      case 'fish':
        return 860;
      case 'gargoyle':
        return 700;
      case 'howler':
        return 720;
      default: {
        const neverKind: never = this.kind;
        return neverKind;
      }
    }
  }

  private kindRecovery(): number {
    switch (this.kind) {
      case 'piranha':
        return 700;
      case 'walrus':
        return 820;
      case 'scorpion':
        return 760;
      case 'fish':
        return 640;
      case 'gargoyle':
        return 780;
      case 'howler':
        return 740;
      default: {
        const neverKind: never = this.kind;
        return neverKind;
      }
    }
  }

  private present(pose: CharacterPose): void {
    const texture = this.miniVariant
      ? miniBossTextureKey(this.theme, this.miniVariant, pose)
      : worldBossTextureKey(this.kind, pose);
    if (this.texture.key === texture) {
      return;
    }
    this.setTexture(texture);
    this.fitHitbox();
  }

  /** Match the hurtbox to visible pixels, including the head, not empty frame padding. */
  private fitHitbox(): void {
    const body = this.arcadeBody;
    const prevBottom = body.bottom;
    const box = hurtboxFromOpaque(opaqueSpriteBounds(this.texture, this.frame));
    body.setSize(box.width, box.height, false);
    body.setOffset(box.offsetX, box.offsetY);
    body.updateBounds();
    const sink = liftOntoFloor(body.bottom, prevBottom);
    if (sink > 0) {
      this.y -= sink;
      body.y -= sink;
    }
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
    const arena = this.arena;
    const edges = this.edges();
    if (!arena || !edges) {
      return;
    }
    const body = this.arcadeBody;
    if (this.x < edges.minX) {
      this.setX(edges.minX);
      if (body.velocity.x < 0) {
        body.setVelocityX(this.ricochets() ? -body.velocity.x * 0.65 : 0);
      }
    } else if (this.x > edges.maxX) {
      this.setX(edges.maxX);
      if (body.velocity.x > 0) {
        body.setVelocityX(this.ricochets() ? -body.velocity.x * 0.65 : 0);
      }
    }
    if (this.swims()) {
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
      return;
    }
    const sink = liftOntoFloor(body.bottom, arena.bottom);
    if (sink > 0) {
      this.y -= sink;
      body.y -= sink;
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

  private applyWorldScale(): void {
    switch (this.kind) {
      case 'piranha':
        this.setScale(2.05, 2.28);
        return;
      case 'walrus':
        this.setScale(2.35, 2.0);
        return;
      case 'scorpion':
        this.setScale(2.3, 2.12);
        return;
      case 'fish':
        this.setScale(2.4, 2.05);
        return;
      case 'gargoyle':
        this.setScale(2.2, 2.2);
        return;
      case 'howler':
        this.setScale(2.18, 2.22);
        return;
      default: {
        const neverKind: never = this.kind;
        return neverKind;
      }
    }
  }

  private swims(): boolean {
    return this.kind === 'fish';
  }

  private ricochets(): boolean {
    switch (this.kind) {
      case 'walrus':
      case 'gargoyle':
      case 'howler':
        return true;
      case 'piranha':
      case 'scorpion':
      case 'fish':
        return false;
      default: {
        const neverKind: never = this.kind;
        return neverKind;
      }
    }
  }

  private settleMotion(): void {
    const body = this.arcadeBody;
    body.setAccelerationX(0);
    body.setDragX(0);
    body.setGravityY(0);
    body.allowGravity = !this.swims();
    if (this.swims()) {
      body.setVelocityY(body.velocity.y * 0.4);
    }
  }
}
