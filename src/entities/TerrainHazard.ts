import Phaser from 'phaser';
import {
  GROUND_Y,
  TILE,
  enemiesForWorld,
  type EnemyKind,
  type TerrainHazardKind,
} from '../config';
import { audio } from '../systems/audio';
import { projectileFlightSpeed, projectileStyleForKind } from '../systems/projectile-style';
import { EnemyProjectile } from './EnemyProjectile';
import {
  FIRST_HAZARD_DELAY_MS,
  FLAME_JET_TILES,
  ICE_BEAM_TILES,
  SONAR_COLUMN_TILES,
  beamLethal,
  beamTextureKey,
  blasterCourtesy,
  hazardAttackMs,
  hazardCooldownMs,
  hazardFiresProjectiles,
  hazardHasBeam,
  hazardTelegraphMs,
  hazardTextureKey,
  hazardUsesGravity,
  pitcherBlockedByStand,
  shotgunVelocities,
  type TerrainHazardSpawn,
} from './terrain-hazard';

export class TerrainHazard extends Phaser.Physics.Arcade.Sprite {
  readonly spawn: TerrainHazardSpawn;
  readonly projectileKind: EnemyKind;
  private phase: 'idle' | 'telegraph' | 'attack' = 'idle';
  private phaseUntil = 0;
  private attackStartedAt = 0;
  private nextCycleAt = Number.POSITIVE_INFINITY;
  private silencedUntil = 0;
  private armed = false;
  private beam?: Phaser.GameObjects.Image;
  private charge?: Phaser.GameObjects.Sprite;
  private dartFired = false;

  constructor(
    scene: Phaser.Scene,
    spawn: TerrainHazardSpawn,
    world: number,
    beams: Phaser.Physics.Arcade.StaticGroup,
  ) {
    super(scene, hazardWorldX(spawn), hazardWorldY(spawn), hazardTextureKey(spawn.kind));
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.spawn = spawn;
    this.projectileKind = enemiesForWorld(world)[1];
    this.setDepth(14);
    this.setOrigin(0.5, spawn.mount === 'hill' ? 0.62 : 0.92);
    if (spawn.facing < 0) {
      this.setFlipX(true);
    }
    this.setContact(false);
    if (hazardHasBeam(spawn.kind)) {
      this.beam = createBeam(scene, spawn, this.x, this.y);
      beams.add(this.beam);
      setBeamEnabled(this.beam, false);
    }
    this.once('destroy', () => {
      this.clearCharge();
      this.beam?.destroy();
    });
  }

  arm(): void {
    if (this.armed) {
      return;
    }
    this.armed = true;
    this.nextCycleAt = this.scene.time.now + FIRST_HAZARD_DELAY_MS + (this.spawn.x % 5) * 90;
  }

  silence(duration = 1600): void {
    this.silencedUntil = this.scene.time.now + duration;
    this.restIdle();
    this.setAlpha(0.42);
    this.setTint(0xb8f5ff);
  }

  tick(player: Phaser.Physics.Arcade.Sprite, projectiles: Phaser.Physics.Arcade.Group): void {
    if (!this.armed) {
      return;
    }
    const now = this.scene.time.now;
    if (now < this.silencedUntil) {
      this.setAlpha(0.42);
      setBeamEnabled(this.beam, false);
      this.setContact(false);
      return;
    }
    if (this.alpha < 1 || this.isTinted) {
      this.setAlpha(1);
      this.clearTint();
    }
    switch (this.phase) {
      case 'idle':
        this.tickIdle(now, player);
        break;
      case 'telegraph':
        this.paintTelegraph(now);
        if (now >= this.phaseUntil) {
          this.beginAttack(now, player, projectiles);
        }
        break;
      case 'attack':
        this.tickAttack(now, player, projectiles);
        if (now >= this.phaseUntil) {
          this.restIdle();
          this.nextCycleAt = now + hazardCooldownMs(this.spawn.kind);
        }
        break;
      default: {
        const neverPhase: never = this.phase;
        return neverPhase;
      }
    }
  }

  private tickIdle(now: number, player: Phaser.Physics.Arcade.Sprite): void {
    this.presentIdle();
    if (now < this.nextCycleAt) {
      return;
    }
    if (this.shouldSkip(player)) {
      this.nextCycleAt = now + hazardCooldownMs(this.spawn.kind);
      return;
    }
    this.phase = 'telegraph';
    this.phaseUntil = now + hazardTelegraphMs(this.spawn.kind);
    this.ensureCharge();
    this.paintTelegraph(now);
  }

  private beginAttack(
    now: number,
    player: Phaser.Physics.Arcade.Sprite,
    projectiles: Phaser.Physics.Arcade.Group,
  ): void {
    this.phase = 'attack';
    this.attackStartedAt = now;
    this.phaseUntil = now + hazardAttackMs(this.spawn.kind);
    this.dartFired = false;
    this.clearCharge();
    this.setAngle(0);
    this.setScale(1);
    this.clearTint();
    this.fireProjectiles(player, projectiles);
    this.tickAttack(now, player, projectiles);
  }

  private tickAttack(
    now: number,
    player: Phaser.Physics.Arcade.Sprite,
    projectiles: Phaser.Physics.Arcade.Group,
  ): void {
    const elapsed = now - this.attackStartedAt;
    const kind = this.spawn.kind;
    if (kind === 'pitcher-snare') {
      this.setScale(1, 1);
      this.y = hazardWorldY(this.spawn) - 18;
      this.syncStaticBody();
      this.setContact(true);
      if (!this.dartFired) {
        this.fireDart(player, projectiles);
        this.dartFired = true;
      }
      return;
    }
    const swell = 1 + Math.sin(now / 40) * 0.04;
    this.setScale(1, swell);
    setBeamEnabled(this.beam, beamLethal(kind, elapsed));
  }

  private restIdle(): void {
    this.phase = 'idle';
    this.clearCharge();
    this.setAngle(0);
    this.setScale(1);
    this.clearTint();
    this.y = hazardWorldY(this.spawn);
    this.syncStaticBody();
    this.setContact(false);
    setBeamEnabled(this.beam, false);
    this.presentIdle();
  }

  private shouldSkip(player: Phaser.Physics.Arcade.Sprite): boolean {
    const kind = this.spawn.kind;
    if (kind === 'pitcher-snare') {
      return pitcherBlockedByStand(Math.abs(player.x - this.x) < 28 && player.y < this.y + 20);
    }
    if (kind === 'glacier-bore') {
      return blasterCourtesy(Math.abs(player.x - this.x));
    }
    return false;
  }

  private paintTelegraph(now: number): void {
    const duration = hazardTelegraphMs(this.spawn.kind);
    const t = Phaser.Math.Clamp(1 - (this.phaseUntil - now) / duration, 0, 1);
    const tremble = Math.sin(now / 28) * (1.8 + t * 4);
    this.setAngle(tremble);
    this.setScale(0.94 + t * 0.12, 1.04 + t * 0.16);
    const flash = Math.sin(now / (70 - t * 36));
    this.setTint(flash > 0 ? 0xfff3c4 : telegraphTint(this.spawn.kind));
    this.updateCharge(now, t);
  }

  private presentIdle(): void {
    if (this.spawn.kind === 'pitcher-snare') {
      this.setScale(1, 0.34);
      this.y = hazardWorldY(this.spawn) + 10;
      this.syncStaticBody();
    }
  }

  private fireProjectiles(player: Phaser.Physics.Arcade.Sprite, projectiles: Phaser.Physics.Arcade.Group): void {
    const kind = this.spawn.kind;
    if (!hazardFiresProjectiles(kind) || kind === 'pitcher-snare') {
      return;
    }
    const style = projectileStyleForKind(this.projectileKind);
    const speed = projectileFlightSpeed(style, hazardUsesGravity(kind));
    const muzzle = this.muzzle();
    for (const velocity of shotgunVelocities(speed)) {
      const shot = new EnemyProjectile(
        this.scene,
        muzzle.x,
        muzzle.y,
        `projectile-${this.projectileKind}`,
        this.projectileKind,
        velocity.vx,
        velocity.vy,
        hazardUsesGravity(kind),
        this,
        player,
      );
      projectiles.add(shot);
      shot.launch();
    }
    audio.play(this.scene, 'enemy-shot');
  }

  private fireDart(player: Phaser.Physics.Arcade.Sprite, projectiles: Phaser.Physics.Arcade.Group): void {
    const style = projectileStyleForKind(this.projectileKind);
    const speed = projectileFlightSpeed(style, false);
    const muzzle = this.muzzle();
    const dx = player.x - muzzle.x;
    const dy = player.y - muzzle.y;
    const magnitude = Math.max(1, Math.hypot(dx, dy));
    const shot = new EnemyProjectile(
      this.scene,
      muzzle.x,
      muzzle.y,
      `projectile-${this.projectileKind}`,
      this.projectileKind,
      (dx / magnitude) * speed,
      (dy / magnitude) * speed,
      false,
      this,
      player,
    );
    projectiles.add(shot);
    shot.launch();
    audio.play(this.scene, 'enemy-shot');
  }

  private muzzle(): { x: number; y: number } {
    if (this.spawn.mount === 'hill') {
      return { x: this.x + this.spawn.facing * 22, y: this.y - 4 };
    }
    return { x: this.x, y: this.y - 22 };
  }

  private ensureCharge(): void {
    if (this.charge?.active) {
      return;
    }
    const texture = beamTextureKey(this.spawn.kind) ?? `projectile-${this.projectileKind}`;
    const muzzle = this.muzzle();
    this.charge = this.scene.add.sprite(muzzle.x, muzzle.y, texture);
    this.charge.setDepth(16);
    this.charge.setScale(0.22);
    this.charge.setAlpha(0.45);
  }

  private updateCharge(now: number, t: number): void {
    this.ensureCharge();
    const charge = this.charge;
    if (!charge) {
      return;
    }
    const muzzle = this.muzzle();
    charge.setPosition(muzzle.x, muzzle.y);
    charge.setScale(0.22 + t * 0.7 + Math.sin(now / 40) * 0.05);
    charge.setAlpha(0.4 + t * 0.55);
    charge.setAngle(charge.angle + 8 + t * 6);
  }

  private clearCharge(): void {
    this.charge?.destroy();
    this.charge = undefined;
  }

  private setContact(enabled: boolean): void {
    const body = this.body as Phaser.Physics.Arcade.StaticBody | null;
    if (!body) {
      return;
    }
    body.enable = enabled;
    if (enabled) {
      body.setSize(36, 52);
      body.updateFromGameObject();
    }
  }

  private syncStaticBody(): void {
    const body = this.body as Phaser.Physics.Arcade.StaticBody | null;
    body?.updateFromGameObject();
  }
}

function hazardWorldX(spawn: TerrainHazardSpawn): number {
  return spawn.x * TILE + TILE / 2;
}

function hazardWorldY(spawn: TerrainHazardSpawn): number {
  if (spawn.mount === 'hill') {
    return (GROUND_Y - spawn.tilesHigh) * TILE + TILE * 0.55;
  }
  return GROUND_Y * TILE + 22;
}

function telegraphTint(kind: TerrainHazardKind): number {
  switch (kind) {
    case 'bramble-vent':
      return 0x7bc24a;
    case 'glacier-bore':
      return 0x9de8ff;
    case 'needle-mortar':
      return 0xe0ad45;
    case 'sonar-well':
      return 0x55d8df;
    case 'keep-burner':
      return 0xff6a3a;
    case 'pitcher-snare':
      return 0x6ad08a;
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

function createBeam(
  scene: Phaser.Scene,
  spawn: TerrainHazardSpawn,
  originX: number,
  originY: number,
): Phaser.GameObjects.Image {
  const key = beamTextureKey(spawn.kind);
  const beam = scene.add.image(originX, originY, key ?? 'beam-ice');
  scene.physics.add.existing(beam, true);
  beam.setDepth(13);
  beam.setAlpha(0.92);
  switch (spawn.kind) {
    case 'glacier-bore': {
      const length = ICE_BEAM_TILES * TILE;
      beam.setOrigin(spawn.facing < 0 ? 1 : 0, 0.5);
      beam.setDisplaySize(length, 16);
      beam.setPosition(originX + spawn.facing * 18, originY - 2);
      break;
    }
    case 'keep-burner': {
      const length = FLAME_JET_TILES * TILE;
      beam.setOrigin(spawn.facing < 0 ? 1 : 0, 0.5);
      beam.setDisplaySize(length, 28);
      beam.setPosition(originX + spawn.facing * 16, originY);
      break;
    }
    case 'sonar-well': {
      beam.setOrigin(0.5, 1);
      beam.setDisplaySize(28, SONAR_COLUMN_TILES * TILE);
      beam.setPosition(originX, originY - 18);
      break;
    }
    case 'bramble-vent':
    case 'needle-mortar':
    case 'pitcher-snare':
      break;
    default: {
      const neverKind: never = spawn.kind;
      return neverKind;
    }
  }
  const body = beam.body as Phaser.Physics.Arcade.StaticBody;
  body.updateFromGameObject();
  return beam;
}

function setBeamEnabled(beam: Phaser.GameObjects.Image | undefined, enabled: boolean): void {
  if (!beam) {
    return;
  }
  beam.setVisible(enabled);
  beam.setActive(enabled);
  const body = beam.body as Phaser.Physics.Arcade.StaticBody | null;
  if (body) {
    body.enable = enabled;
  }
}
