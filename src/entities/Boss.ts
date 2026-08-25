import Phaser from 'phaser';
import { type BossKind, type MiniBossVariant, type Theme } from '../config';
import { maybeShake } from '../data/settings';
import type { ArenaKeep } from '../levels/arena';
import { liftOntoFloor } from '../levels/colliders';
import { audio } from '../systems/audio';
import { miniBossTextureKey, worldBossTextureKey, type CharacterPose } from '../systems/characters';
import {
  aerialLungeCeiling,
  crownGuardLayout,
  crownGuardVisible,
  estimatedOpaqueBounds,
  FISH_DASH_MS,
  hurtboxFromOpaque,
  lockChargeDir,
  POST_STOMP_RECOVERY_MS,
  STOMP_INVULN_MS,
  stompBlocked,
  swimHomeY,
  type BossRhythm,
  type SpriteOpaqueBounds,
} from './boss-combat';

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
  private dashUntil = 0;
  private facingLocked = false;
  private slamPhase: 'idle' | 'up' | 'down' = 'idle';
  private chargeDir = -1;
  private spawnY: number;
  private arena: ArenaKeep | undefined;
  private readonly theme: Theme;
  private readonly miniVariant: MiniBossVariant | undefined;
  private bossState: BossRhythm = 'waiting';
  private stateUntil = 0;
  private phase = 1;
  private attackIndex = 0;
  private readonly crownGuard: Phaser.GameObjects.Image;
  private guardShown = false;

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
    this.crownGuard = scene.add.image(x, y, 'boss-crown-guard');
    this.crownGuard.setDepth(18);
    this.crownGuard.setOrigin(0.5, 0.5);
    this.crownGuard.setVisible(false);
    this.crownGuard.setAlpha(0);
    this.once('destroy', () => {
      this.scene.tweens.killTweensOf(this.crownGuard);
      this.crownGuard.destroy();
    });
  }

  protected preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    this.syncCrownGuard();
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
    this.facingLocked = false;
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
    if (
      stompBlocked({
        dying: this.dying,
        invulnerable: this.isInvulnerable,
        rhythm: this.bossState,
      })
    ) {
      return 'ignored';
    }
    this.hp -= 1;
    this.phase = Math.min(3, this.maxHp - this.hp + 1);
    if (this.maxHp > 1 && this.hp > 0) {
      audio.play(this.scene, 'phase');
    }
    this.bossState = 'recovery';
    this.stateUntil = this.scene.time.now + POST_STOMP_RECOVERY_MS;
    this.invulnUntil = this.scene.time.now + STOMP_INVULN_MS;
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
    this.syncCrownGuard();
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

    if (this.bossState === 'waiting') {
      this.beginTelegraph(player);
    }

    if (this.bossState === 'telegraph' && !this.facingLocked) {
      this.lockFacing(player.x);
    }
    this.faceCharge();

    if (this.bossState === 'telegraph') {
      body.setVelocityX(0);
      this.setAlpha(1);
      this.present('move');
      const warn = 0.5 + 0.5 * Math.sin(now / 70);
      this.setTint(Phaser.Display.Color.GetColor(255, Math.floor(82 + 96 * warn), 58));
      if (this.swims()) {
        this.holdSwimHome(now);
      }
      if (now >= this.stateUntil) {
        this.clearTint();
        this.bossState = 'attack';
        this.stateUntil = now + this.attackDuration();
        this.startAttack(player);
      }
    } else if (this.bossState === 'attack') {
      this.setAlpha(1);
      this.present('attack');
      this.continueAttack();
      if (this.bossState === 'attack' && now >= this.stateUntil) {
        this.finishAttack();
      }
    } else if (this.bossState === 'recovery') {
      body.setVelocityX(body.velocity.x * 0.84);
      this.present(this.isInvulnerable ? 'hurt' : 'idle');
      if (this.swims()) {
        this.holdSwimHome(now);
      }
      if (now >= this.stateUntil) {
        this.attackIndex += 1;
        this.beginTelegraph(player);
      }
    }

    void solids;
    this.contain();
  }

  private startAttack(player: Phaser.Physics.Arcade.Sprite): void {
    const body = this.arcadeBody;
    const now = this.scene.time.now;
    const speedBonus = this.phase * 35 + (this.miniVariant ?? 0) * 18;
    const dir = this.chargeDir;
    this.settleMotion();
    switch (this.kind) {
      case 'piranha':
        body.setVelocity(dir * (110 + speedBonus), -460 - this.phase * 50);
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
        this.dashUntil = now + FISH_DASH_MS;
        break;
      }
      case 'gargoyle':
        body.setVelocity(dir * (340 + speedBonus), this.phase >= 2 ? -220 : -70);
        break;
      case 'howler':
        body.setVelocity(dir * (240 + speedBonus), -420 - this.phase * 45);
        break;
      default: {
        const neverKind: never = this.kind;
        return neverKind;
      }
    }
  }

  private continueAttack(): void {
    const body = this.arcadeBody;
    const now = this.scene.time.now;
    switch (this.kind) {
      case 'piranha':
        if (body.velocity.y > 90) {
          body.setVelocityX(this.chargeDir * (200 + this.phase * 28));
        }
        break;
      case 'walrus':
        if (this.hitWall()) {
          this.finishAttack();
        }
        break;
      case 'scorpion':
        if (this.slamPhase === 'up') {
          body.setVelocityX(this.chargeDir * 50);
          if (body.velocity.y > 0) {
            this.slamPhase = 'down';
            body.setVelocityY(760 + this.phase * 95);
          }
        } else if (this.slamPhase === 'down' && body.blocked.down) {
          this.slamPhase = 'idle';
          maybeShake(this.scene, 130, 0.007 + this.phase * 0.002);
          this.finishAttack();
        }
        break;
      case 'fish': {
        body.allowGravity = false;
        if (now < this.dashUntil) {
          break;
        }
        this.returnSwimHome(now);
        break;
      }
      case 'gargoyle':
      case 'howler':
        if (this.hitWall()) {
          this.finishAttack();
        }
        break;
      default: {
        const neverKind: never = this.kind;
        return neverKind;
      }
    }
  }

  private beginTelegraph(player: Phaser.Physics.Arcade.Sprite): void {
    this.lockFacing(player.x);
    this.bossState = 'telegraph';
    this.stateUntil = this.scene.time.now + this.telegraphDuration();
    this.settleMotion();
    this.arcadeBody.setVelocityX(0);
  }

  private finishAttack(): void {
    if (this.bossState !== 'attack') {
      return;
    }
    this.bossState = 'recovery';
    this.stateUntil = this.scene.time.now + this.recoveryDuration();
    this.settleMotion();
    this.arcadeBody.setDragX(420);
    this.clearTint();
    this.present('idle');
  }

  private lockFacing(playerX: number): void {
    this.chargeDir = lockChargeDir(playerX, this.x);
    this.facingLocked = true;
  }

  private faceCharge(): void {
    this.setFlipX(this.chargeDir > 0);
  }

  private hitWall(): boolean {
    const body = this.arcadeBody;
    return body.blocked.left || body.blocked.right;
  }

  private telegraphDuration(): number {
    return Math.max(420, this.kindTelegraph() - this.phase * 90 - (this.miniVariant ?? 0) * 45);
  }

  private attackDuration(): number {
    return this.kindAttack() + this.phase * 70 + (this.miniVariant ?? 0) * 50;
  }

  private recoveryDuration(): number {
    return Math.max(560, this.kindRecovery() - this.phase * 40);
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
        return 480;
      case 'walrus':
        return 640;
      case 'scorpion':
        return 580;
      case 'fish':
        return 620;
      case 'gargoyle':
        return 580;
      case 'howler':
        return 600;
      default: {
        const neverKind: never = this.kind;
        return neverKind;
      }
    }
  }

  private kindRecovery(): number {
    switch (this.kind) {
      case 'piranha':
        return 900;
      case 'walrus':
        return 1020;
      case 'scorpion':
        return 960;
      case 'fish':
        return 840;
      case 'gargoyle':
        return 980;
      case 'howler':
        return 940;
      default: {
        const neverKind: never = this.kind;
        return neverKind;
      }
    }
  }

  private syncCrownGuard(): void {
    const show = crownGuardVisible({
      dying: this.dying,
      engaged: this.engaged,
      invulnerable: this.isInvulnerable,
      rhythm: this.bossState,
    });
    const body = this.arcadeBody;
    const pose = crownGuardLayout(this.x, body.center.y, body.width, body.height, this.scene.time.now);
    this.crownGuard.setPosition(pose.x, pose.y);
    this.crownGuard.setFlipX(this.flipX);

    if (show && !this.guardShown) {
      this.guardShown = true;
      this.scene.tweens.killTweensOf(this.crownGuard);
      this.crownGuard.setVisible(true);
      this.crownGuard.setScale(pose.scale * 0.35);
      this.crownGuard.setAlpha(0);
      this.scene.tweens.add({
        targets: this.crownGuard,
        scale: pose.scale,
        alpha: pose.alpha,
        duration: 160,
        ease: 'Back.easeOut',
      });
      return;
    }

    if (!show && this.guardShown) {
      this.guardShown = false;
      this.scene.tweens.killTweensOf(this.crownGuard);
      this.scene.tweens.add({
        targets: this.crownGuard,
        scale: pose.scale * 0.4,
        alpha: 0,
        duration: 110,
        onComplete: () => {
          if (!this.guardShown) {
            this.crownGuard.setVisible(false);
          }
        },
      });
      return;
    }

    if (this.scene.tweens.getTweensOf(this.crownGuard).length > 0) {
      return;
    }
    if (show) {
      this.crownGuard.setScale(pose.scale);
      this.crownGuard.setAlpha(pose.alpha);
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

  private swimHome(): number {
    return this.arena ? swimHomeY(this.spawnY, this.arena) : this.spawnY;
  }

  private swimTargetY(now: number): number {
    const raw = this.swimHome() + Math.sin(now / 280) * 70;
    const edges = this.edges();
    const ceiling = this.arena ? aerialLungeCeiling(this.arena) : raw;
    const minY = edges ? Math.max(edges.minY, ceiling) : ceiling;
    const maxY = edges ? edges.maxY : raw;
    return Phaser.Math.Clamp(raw, minY, maxY);
  }

  private holdSwimHome(now: number): void {
    this.arcadeBody.setVelocityY((this.swimTargetY(now) - this.y) * 2.4);
  }

  private returnSwimHome(now: number): void {
    const home = this.swimTargetY(now);
    this.arcadeBody.setVelocity(
      this.chargeDir * 40,
      Phaser.Math.Clamp((home - this.y) * 3.2, -280, 360),
    );
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
        body.setVelocityX(0);
        this.endLungeOnBound();
      }
    } else if (this.x > edges.maxX) {
      this.setX(edges.maxX);
      if (body.velocity.x > 0) {
        body.setVelocityX(0);
        this.endLungeOnBound();
      }
    }
    if (this.swims()) {
      this.containSwim(arena, edges);
      return;
    }
    this.containAerialCeiling(arena);
    const sink = liftOntoFloor(body.bottom, arena.bottom);
    if (sink > 0) {
      this.y -= sink;
      body.y -= sink;
      if (body.velocity.y > 0) {
        body.setVelocityY(0);
      }
    }
  }

  private containSwim(arena: ArenaKeep, edges: { minY: number; maxY: number }): void {
    const body = this.arcadeBody;
    const dashing = this.bossState === 'attack' && this.scene.time.now < this.dashUntil;
    const ceiling = dashing ? edges.minY : Math.max(edges.minY, aerialLungeCeiling(arena));
    if (this.y < ceiling) {
      this.setY(ceiling);
      if (body.velocity.y < 0) {
        body.setVelocityY(0);
      }
      if (dashing) {
        this.dashUntil = this.scene.time.now;
      }
    } else if (this.y > edges.maxY) {
      this.setY(edges.maxY);
      if (body.velocity.y > 0) {
        body.setVelocityY(0);
      }
    }
  }

  private containAerialCeiling(arena: ArenaKeep): void {
    const ceiling = aerialLungeCeiling(arena);
    if (this.y >= ceiling) {
      return;
    }
    this.setY(ceiling);
    if (this.arcadeBody.velocity.y < 0) {
      this.arcadeBody.setVelocityY(0);
    }
  }

  private endLungeOnBound(): void {
    if (this.bossState === 'attack' && this.linearCharges()) {
      this.finishAttack();
    }
  }

  private linearCharges(): boolean {
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
