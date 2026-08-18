import Phaser from 'phaser';
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  START_LIVES,
  TILE,
  enemyThreatensTile,
  themeSky,
  type EnemyKind,
  type LevelId,
} from '../config';
import {
  collectMemory,
  collectibleMask,
  getCheckpoint,
  levelCollectibleCount,
  loadSave,
  markCleared,
  nextLevelId,
  resetSessionLives,
  session,
  setCheckpoint,
  setLastPlayed,
} from '../data/progress';
import { applySettings } from '../data/settings';
import { skinForLevel, type SkinDef } from '../data/skins';
import { Baddie } from '../entities/Baddie';
import { Boss } from '../entities/Boss';
import { isBossHeadStomp } from '../entities/boss-combat';
import { EnemyProjectile } from '../entities/EnemyProjectile';
import { FlakFragment } from '../entities/FlakFragment';
import { Player, type PlayerInput } from '../entities/Player';
import { buildLevel, type BuiltLevel } from '../levels/builder';
import { bossSafeLandingX } from '../levels/arena';
import { getLevel } from '../levels/worlds';
import { audio } from '../systems/audio';
import { forgetFlak, rememberFlak, restoreFlak, setFlakGroup } from '../systems/flak';
import { Parallax } from '../systems/parallax';
import { getTouchState, hideTouchControls, showTouchControls } from '../systems/touch-controls';
import { skinThumbKey } from '../systems/textures';
import { showBossFightBanner } from '../ui/boss-fight';
import { addPanel, dismissOnOutside, launchOverlay, MenuButton, MenuNav, textStyle } from '../ui/menu';
import { WorldSpecial } from '../systems/world-special';

interface PlayData {
  levelId?: LevelId;
}

function playerFromCollider(
  object:
    | Phaser.Types.Physics.Arcade.GameObjectWithBody
    | Phaser.Physics.Arcade.Body
    | Phaser.Physics.Arcade.StaticBody
    | Phaser.Tilemaps.Tile,
): Player | undefined {
  if (object instanceof Player) {
    return object;
  }
  if ('gameObject' in object && object.gameObject instanceof Player) {
    return object.gameObject;
  }
  return undefined;
}

function flakFromCollider(
  object:
    | Phaser.Types.Physics.Arcade.GameObjectWithBody
    | Phaser.Physics.Arcade.Body
    | Phaser.Physics.Arcade.StaticBody
    | Phaser.Tilemaps.Tile,
): FlakFragment | undefined {
  if (object instanceof FlakFragment) {
    return object;
  }
  if ('gameObject' in object && object.gameObject instanceof FlakFragment) {
    return object.gameObject;
  }
  return undefined;
}

function checkpointSpawnIsSafe(
  enemies: Array<{ x: number; tilesUp: number; kind: EnemyKind }>,
  saved: { x: number; y: number },
): boolean {
  const tileX = Math.round((saved.x - TILE / 2) / TILE);
  return enemies.every((enemy) => {
    if (enemy.tilesUp === 0 && Math.abs(enemy.x - tileX) <= 1) {
      return false;
    }
    return !enemyThreatensTile(enemy.kind, enemy.x, tileX);
  });
}

export class PlayScene extends Phaser.Scene {
  private levelId: LevelId = '1-1';
  private built!: BuiltLevel;
  private parallax!: Parallax;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyShift!: Phaser.Input.Keyboard.Key;
  private paused = false;
  private completing = false;
  private hudLives!: Phaser.GameObjects.Text;
  private hudLifeIcons: Phaser.GameObjects.Image[] = [];
  private hudBoss!: Phaser.GameObjects.Text;
  private hudSpecial!: Phaser.GameObjects.Text;
  private hudCollectibles!: Phaser.GameObjects.Text;
  private hudShield!: Phaser.GameObjects.Text;
  private pauseOverlay!: Phaser.GameObjects.Container;
  private pauseNav!: MenuNav;
  private wasJump = false;
  private wasDown = false;
  private wasSpecial = false;
  private fightEngaged = false;
  private threatsLive = false;
  private flak!: Phaser.GameObjects.Group;
  private retainFlak = false;
  private special!: WorldSpecial;

  constructor() {
    super('PlayScene');
  }

  init(data: PlayData): void {
    this.levelId = data.levelId ?? '1-1';
    this.paused = false;
    this.completing = false;
    this.wasJump = false;
    this.wasDown = false;
    this.wasSpecial = false;
    this.fightEngaged = false;
    this.threatsLive = false;
    this.retainFlak = false;
  }

  create(): void {
    applySettings(this);
    setLastPlayed(this.levelId);
    this.game.canvas.dataset.levelId = this.levelId;
    const def = getLevel(this.levelId);
    this.cameras.main.setBackgroundColor(themeSky(def.theme));
    this.built = buildLevel(this, def.rows, def.theme, def.world, def.course);
    this.parallax = new Parallax(this, def.theme);
    audio.playTheme(this, def.theme);
    this.special = new WorldSpecial(this, this.built, def.theme, def.course.special);
    const savedCheckpoint = getCheckpoint(this.levelId);
    if (savedCheckpoint && checkpointSpawnIsSafe(def.course.enemies, savedCheckpoint)) {
      this.built.player.setPosition(savedCheckpoint.x, savedCheckpoint.y);
    }

    this.physics.world.setBounds(0, 0, this.built.widthPx, this.built.heightPx + 400);
    this.physics.world.TILE_BIAS = 40;

    const {
      player,
      solids,
      oneways,
      hazards,
      baddies,
      projectiles,
      collectibles,
      shields,
      checkpoints,
      puzzleTargets,
      miniBoss,
      worldBoss,
      bossFences,
    } = this.built;

    this.physics.add.collider(player, solids);
    this.physics.add.collider(
      player,
      puzzleTargets,
      undefined,
      (objectA, objectB) => {
        const target = objectA === player ? objectB : objectA;
        return 'getData' in target && target.getData('solid') === true;
      },
    );
    this.physics.add.overlap(player, puzzleTargets, (objectA, objectB) => {
      const target = objectA === player ? objectB : objectA;
      if ('getData' in target && target.getData('kind') === 'down-current') {
        player.arcadeBody.setVelocityY(Math.max(player.arcadeBody.velocity.y, 180));
      }
    });
    this.physics.add.collider(baddies, solids);
    this.physics.add.collider(baddies, oneways);
    this.physics.add.collider(projectiles, solids, (objectA, objectB) => {
      const projectile = objectA instanceof EnemyProjectile ? objectA : objectB instanceof EnemyProjectile ? objectB : undefined;
      projectile?.destroy();
    });
    this.physics.add.collider(projectiles, oneways, (objectA, objectB) => {
      const projectile = objectA instanceof EnemyProjectile ? objectA : objectB instanceof EnemyProjectile ? objectB : undefined;
      projectile?.destroy();
    });
    if (miniBoss) {
      this.physics.add.collider(miniBoss, solids);
      for (const fence of bossFences) {
        this.physics.add.collider(miniBoss, fence);
      }
    }
    if (worldBoss) {
      this.physics.add.collider(worldBoss, solids);
      for (const fence of bossFences) {
        this.physics.add.collider(worldBoss, fence);
      }
    }

    this.physics.add.collider(
      player,
      oneways,
      undefined,
      (objectA, objectB) => this.oneWayProcess(objectA, objectB),
    );

    this.physics.add.collider(player, baddies, (objectA, objectB) => {
      this.onBaddieCollide(objectA as Player, objectB as Baddie);
    });

    if (miniBoss) {
      this.bindBossCombat(player, miniBoss, false);
    }
    if (worldBoss) {
      this.bindBossCombat(player, worldBoss, true);
    }

    this.physics.add.overlap(player, hazards, () => this.killPlayer('hazard'));
    this.physics.add.overlap(player, projectiles, (objectA, objectB) => {
      const projectile = objectA instanceof EnemyProjectile ? objectA : objectB instanceof EnemyProjectile ? objectB : undefined;
      if (!projectile || projectile.neutralized) {
        return;
      }
      projectile.destroy();
      this.killPlayer('baddie');
    });
    this.physics.add.overlap(player, collectibles, (objectA, objectB) => {
      const pickup = objectA === player ? objectB : objectA;
      if ('getData' in pickup) {
        this.collectPickup(pickup as Phaser.Physics.Arcade.Sprite);
      }
    });
    this.physics.add.overlap(player, shields, (objectA, objectB) => {
      const pickup = objectA === player ? objectB : objectA;
      if ('destroy' in pickup) {
        player.giveShield();
        audio.play(this, 'select');
        (pickup as Phaser.GameObjects.GameObject).destroy();
      }
    });
    this.physics.add.overlap(player, checkpoints, (objectA, objectB) => {
      const checkpoint = objectA === player ? objectB : objectA;
      if ('getData' in checkpoint) {
        this.activateCheckpoint(checkpoint as Phaser.Physics.Arcade.Sprite);
      }
    });

    const mask = collectibleMask(this.levelId);
    for (const child of collectibles.getChildren()) {
      const pickup = child as Phaser.Physics.Arcade.Sprite;
      const index = Number(pickup.getData('index'));
      if ((mask & (1 << index)) !== 0) {
        pickup.destroy();
      }
    }

    this.flak = this.add.group();
    setFlakGroup(this, this.flak);
    restoreFlak(this, this.flak, this.levelId);
    this.physics.add.collider(this.flak, solids);
    this.physics.add.collider(
      this.flak,
      oneways,
      undefined,
      (objectA, objectB) => this.flakOneWayProcess(objectA, objectB),
    );
    this.physics.add.collider(this.flak, this.flak);
    this.physics.add.collider(player, this.flak, (objectA, objectB) => {
      this.onFlakBump(objectA, objectB);
    });
    this.physics.add.overlap(this.flak, hazards, (objectA, objectB) => {
      const frag = flakFromCollider(objectA) ?? flakFromCollider(objectB);
      frag?.destroy();
    });

    this.cameras.main.startFollow(player, true, 0.14, 0.14);
    this.cameras.main.setDeadzone(90, 160);
    this.cameras.main.setBounds(0, 0, this.built.widthPx, Math.max(GAME_HEIGHT, this.built.heightPx));
    this.cameras.main.setRoundPixels(true);

    if (def.theme === 'ocean') {
      this.add
        .rectangle(0, 0, this.built.widthPx, this.built.heightPx, 0x073044, 0.16)
        .setOrigin(0, 0)
        .setDepth(8);
      this.add.particles(0, 0, 'poof-particle', {
        x: { min: 0, max: this.built.widthPx },
        y: { min: 80, max: GAME_HEIGHT },
        scale: { start: 0.3, end: 0 },
        lifespan: 2400,
        quantity: 1,
        frequency: 180,
        tint: 0x9fe8ff,
        speedY: { min: -30, max: -10 },
        alpha: { start: 0.5, end: 0 },
      }).setDepth(9);
    }

    if (def.theme === 'snow') {
      this.add.particles(0, 0, 'poof-particle', {
        x: { min: 0, max: GAME_WIDTH },
        y: -10,
        scale: { start: 0.35, end: 0.1 },
        lifespan: 2800,
        quantity: 2,
        frequency: 60,
        tint: 0xffffff,
        speedY: { min: 40, max: 90 },
        speedX: { min: -20, max: 20 },
      }).setScrollFactor(0).setDepth(30);
    }

    if (def.theme === 'rainforest') {
      this.add
        .rectangle(0, 0, this.built.widthPx, this.built.heightPx, 0x0c2818, 0.12)
        .setOrigin(0, 0)
        .setDepth(8);
      this.add.particles(0, 0, 'poof-particle', {
        x: { min: 0, max: GAME_WIDTH },
        y: -10,
        scale: { start: 0.22, end: 0.05 },
        lifespan: 1400,
        quantity: 3,
        frequency: 40,
        tint: 0x8ab0c0,
        speedY: { min: 220, max: 380 },
        speedX: { min: -30, max: 10 },
        alpha: { start: 0.45, end: 0 },
      }).setScrollFactor(0).setDepth(30);
    }

    this.createHud(def.name);
    this.createPauseOverlay();
    this.bindKeys();
    this.syncTouchHud();
    const onScenePause = () => this.syncTouchHud();
    const onSceneResume = () => this.syncTouchHud();
    this.events.on(Phaser.Scenes.Events.PAUSE, onScenePause);
    this.events.on(Phaser.Scenes.Events.RESUME, onSceneResume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.PAUSE, onScenePause);
      this.events.off(Phaser.Scenes.Events.RESUME, onSceneResume);
      delete this.game.canvas.dataset.levelId;
      hideTouchControls();
      if (!this.retainFlak) {
        forgetFlak();
      }
    });
  }

  update(): void {
    if (!this.paused) {
      this.cullFlak();
    }
    if (this.paused || this.completing) {
      return;
    }

    const def = getLevel(this.levelId);
    const input = this.readInput();
    const { player, baddies, miniBoss, worldBoss } = this.built;

    player.tick(input, def.theme);
    if (input.specialJust && this.special.activate(player, player.flipX ? -1 : 1)) {
      audio.play(this, 'special');
    }

    if (!this.threatsLive && (input.left || input.right)) {
      this.threatsLive = true;
      for (const child of baddies.getChildren()) {
        if (child instanceof Baddie) {
          child.armThreats();
        }
      }
    }
    if (this.threatsLive) {
      for (const child of baddies.getChildren()) {
        (child as Baddie).tick(player, this.built.solids, this.built.oneways, this.built.projectiles);
      }
      for (const child of this.built.projectiles.getChildren()) {
        if (child instanceof EnemyProjectile) {
          child.tick();
        }
      }
    }
    this.tickBoss(miniBoss, player);
    this.tickBoss(worldBoss, player);

    if (player.y > this.built.heightPx + 20) {
      this.killPlayer('pit');
      return;
    }

    this.parallax.update(this.cameras.main.scrollX);

    this.hudLives.setText('Lives');
    this.hudLifeIcons.forEach((icon, index) => {
      icon.setVisible(index < session.lives);
    });
    this.hudSpecial.setText(
      this.special.ready
        ? `SHIFT  ${this.special.label}`
        : `${this.special.label}  ${Math.ceil(this.special.cooldownRatio * 10)}`,
    );
    this.hudSpecial.setColor(this.special.ready ? '#fff0a8' : '#9aa5b1');
    this.hudCollectibles.setText(`MEMORIES  ${levelCollectibleCount(this.levelId)}/3`);
    this.hudShield.setText(player.shielded ? 'SHIELD  READY' : 'SHIELD  —');
    const boss = worldBoss?.active ? worldBoss : miniBoss?.active ? miniBoss : undefined;
    if (boss && !boss.dying && boss.engaged) {
      this.hudBoss.setText(
        `${boss.encounterName}  ${'♥'.repeat(boss.hp)}${'·'.repeat(Math.max(0, boss.maxHp - boss.hp))}`,
      );
      this.hudBoss.setVisible(true);
    } else {
      this.hudBoss.setVisible(false);
    }
  }

  private tickBoss(boss: Boss | undefined, player: Player): void {
    if (!boss?.active) {
      return;
    }
    this.tryStartBossFight(player);
    if (boss.engaged) {
      boss.chase(player, this.built.solids);
      return;
    }
    boss.guard();
  }

  private tryStartBossFight(player: Player): void {
    if (this.fightEngaged || !this.built.arena) {
      return;
    }
    if (player.x < this.built.arena.enterX) {
      return;
    }
    this.fightEngaged = true;
    this.built.miniBoss?.engage();
    this.built.worldBoss?.engage();
    audio.play(this, 'boss');
    showBossFightBanner(this);
  }

  private bindKeys(): void {
    const kb = this.input.keyboard;
    if (!kb) {
      throw new Error('Keyboard plugin missing');
    }
    this.cursors = kb.createCursorKeys();
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyShift = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    kb.on('keydown-P', () => {
      if (this.scene.isPaused() || this.completing) {
        return;
      }
      this.togglePause();
    });
    kb.on('keydown-ESC', () => {
      if (this.scene.isPaused() || this.completing || this.paused) {
        return;
      }
      this.togglePause();
    });
  }

  private readInput(): PlayerInput {
    const touch = getTouchState();
    const left = this.cursors.left.isDown || this.keyA.isDown || touch.left;
    const right = this.cursors.right.isDown || this.keyD.isDown || touch.right;
    const jump = this.cursors.up.isDown || this.keyW.isDown || this.keySpace.isDown || touch.jump;
    const down = this.cursors.down.isDown || this.keyS.isDown;
    const special = this.keyShift.isDown || touch.special;
    const jumpJust = jump && !this.wasJump;
    const downJust = down && !this.wasDown;
    const specialJust = special && !this.wasSpecial;
    if (downJust && (this.built.player.arcadeBody.blocked.down || this.built.player.arcadeBody.touching.down)) {
      audio.play(this, 'drop');
    }
    this.wasJump = jump;
    this.wasDown = down;
    this.wasSpecial = special;
    return { left, right, jump, jumpJust, down, downJust, special, specialJust };
  }

  private oneWayProcess(
    objectA:
      | Phaser.Types.Physics.Arcade.GameObjectWithBody
      | Phaser.Physics.Arcade.Body
      | Phaser.Physics.Arcade.StaticBody
      | Phaser.Tilemaps.Tile,
    objectB:
      | Phaser.Types.Physics.Arcade.GameObjectWithBody
      | Phaser.Physics.Arcade.Body
      | Phaser.Physics.Arcade.StaticBody
      | Phaser.Tilemaps.Tile,
  ): boolean {
    const player = playerFromCollider(objectA) ?? playerFromCollider(objectB);
    if (!player || player.isDropping) {
      return false;
    }
    return player.arcadeBody.velocity.y >= 0;
  }

  private flakOneWayProcess(
    objectA:
      | Phaser.Types.Physics.Arcade.GameObjectWithBody
      | Phaser.Physics.Arcade.Body
      | Phaser.Physics.Arcade.StaticBody
      | Phaser.Tilemaps.Tile,
    objectB:
      | Phaser.Types.Physics.Arcade.GameObjectWithBody
      | Phaser.Physics.Arcade.Body
      | Phaser.Physics.Arcade.StaticBody
      | Phaser.Tilemaps.Tile,
  ): boolean {
    const frag = flakFromCollider(objectA) ?? flakFromCollider(objectB);
    if (!frag) {
      return false;
    }
    return frag.arcadeBody.velocity.y >= 0;
  }

  private onFlakBump(
    objectA:
      | Phaser.Types.Physics.Arcade.GameObjectWithBody
      | Phaser.Physics.Arcade.Body
      | Phaser.Physics.Arcade.StaticBody
      | Phaser.Tilemaps.Tile,
    objectB:
      | Phaser.Types.Physics.Arcade.GameObjectWithBody
      | Phaser.Physics.Arcade.Body
      | Phaser.Physics.Arcade.StaticBody
      | Phaser.Tilemaps.Tile,
  ): void {
    const player = playerFromCollider(objectA) ?? playerFromCollider(objectB);
    const frag = flakFromCollider(objectA) ?? flakFromCollider(objectB);
    if (!player || !frag || player.frozen) {
      return;
    }
    const pb = player.arcadeBody;
    const fb = frag.arcadeBody;
    fb.setVelocityX(fb.velocity.x + pb.velocity.x * 0.32);
    if (Math.abs(pb.velocity.x) > 50) {
      fb.setVelocityY(fb.velocity.y - 55);
    }
  }

  private cullFlak(): void {
    if (!this.flak) {
      return;
    }
    const killY = this.built.heightPx + 160;
    const left = -140;
    const right = this.built.widthPx + 140;
    for (const child of this.flak.getChildren()) {
      if (!(child instanceof FlakFragment) || !child.active) {
        continue;
      }
      if (child.y > killY || child.x < left || child.x > right) {
        child.destroy();
      }
    }
  }

  private onBaddieCollide(player: Player, baddie: Baddie): void {
    if (!baddie.active || baddie.dying || player.frozen) {
      return;
    }
    const pb = player.arcadeBody;
    const bb = baddie.arcadeBody;
    if (bb.touching.up && pb.touching.down && pb.velocity.y >= 0) {
      const result = baddie.tryStomp();
      player.bounce();
      audio.play(this, result === 'defeated' ? 'stomp' : 'hurt');
      return;
    }
    this.killPlayer('baddie');
  }

  private bindBossCombat(player: Player, boss: Boss, worldBoss: boolean): void {
    this.physics.add.collider(
      player,
      boss,
      () => this.onBossHeadStomp(player, boss, worldBoss),
      () => this.canStompBoss(player, boss),
    );
    this.physics.add.overlap(player, boss, () => this.onBossBodyHit(player, boss));
  }

  private canStompBoss(player: Player, boss: Boss): boolean {
    return Boolean(boss.active) && !boss.dying && !player.frozen && isBossHeadStomp(player.arcadeBody, boss.arcadeBody);
  }

  private onBossHeadStomp(player: Player, boss: Boss, worldBoss: boolean): void {
    if (!boss.active || boss.dying || player.frozen) {
      return;
    }
    const result = boss.takeStomp();
    this.bounceFromBoss(player, boss);
    if (result === 'ignored') {
      return;
    }
    audio.play(this, 'stomp');
    if (result === 'dead') {
      this.defeatBoss(boss, worldBoss);
    }
  }

  private onBossBodyHit(player: Player, boss: Boss): void {
    if (!boss.active || boss.dying || player.frozen) {
      return;
    }
    if (this.canStompBoss(player, boss)) {
      return;
    }
    if (!boss.isInvulnerable) {
      this.killPlayer('baddie');
    }
  }

  private defeatBoss(boss: Boss, worldBoss: boolean): void {
    this.completing = true;
    this.syncTouchHud();
    this.built.player.freeze();
    const firstClear = !loadSave().cleared.includes(this.levelId);
    markCleared(this.levelId);
    audio.play(this, 'poof');
    const def = getLevel(this.levelId);
    const message = worldBoss ? `WORLD ${def.world} CLEARED!` : `${this.levelId}  CLEAR!`;
    const unlockedSkin = firstClear ? skinForLevel(this.levelId) : undefined;
    boss.poofAway();
    this.time.delayedCall(500, () => {
      audio.play(this, 'victory');
      this.showCompleteMenu(message, unlockedSkin);
    });
  }

  private killPlayer(reason: 'pit' | 'hazard' | 'baddie'): void {
    if (this.completing || this.built.player.frozen) {
      return;
    }
    if (reason === 'baddie' && !this.built.player.canBeHurt()) {
      return;
    }
    if (reason === 'baddie' && this.built.player.consumeShield()) {
      audio.play(this, 'hurt');
      return;
    }
    this.completing = true;
    this.syncTouchHud();
    session.lives -= 1;
    audio.play(this, 'hurt');
    this.built.player.die(() => {
      if (session.lives <= 0) {
        forgetFlak();
        this.showBanner('GAME OVER', () => {
          resetSessionLives();
          this.scene.start('WorldMapScene');
        });
        return;
      }
      rememberFlak(this.levelId, this.flak, this.built.heightPx + 160);
      this.retainFlak = true;
      this.scene.restart({ levelId: this.levelId });
    });
  }

  private bounceFromBoss(player: Player, boss: Boss): void {
    const arena = this.built.arena;
    if (!arena) {
      player.bounce();
      return;
    }
    const safeX = bossSafeLandingX(arena, boss.x);
    player.bossBounce(boss.x, safeX);
  }

  private collectPickup(pickup: Phaser.Physics.Arcade.Sprite): void {
    if (!pickup.active) {
      return;
    }
    const index = Number(pickup.getData('index'));
    collectMemory(this.levelId, index);
    audio.play(this, 'collect');
    this.tweens.add({
      targets: pickup,
      y: pickup.y - 36,
      alpha: 0,
      scale: 1.85,
      duration: 240,
      onComplete: () => pickup.destroy(),
    });
  }

  private activateCheckpoint(checkpoint: Phaser.Physics.Arcade.Sprite): void {
    if (checkpoint.getData('active') === true) {
      return;
    }
    checkpoint.setData('active', true);
    checkpoint.setTint(0x9be36e);
    setCheckpoint(
      this.levelId,
      Number(checkpoint.getData('spawnX')),
      Number(checkpoint.getData('spawnY')),
    );
    audio.play(this, 'map');
  }

  private createHud(name: string): void {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'Courier New, monospace',
      fontSize: '20px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 5,
    };
    this.add.text(24, 16, `${this.levelId}  ${name}`, style).setScrollFactor(0).setDepth(50);
    this.hudLives = this.add.text(24, 44, 'Lives', style).setScrollFactor(0).setDepth(50);
    this.hudLifeIcons = [];
    for (let i = 0; i < START_LIVES; i += 1) {
      this.hudLifeIcons.push(
        this.add
          .image(108 + i * 30, 54, 'player')
          .setScale(0.42)
          .setScrollFactor(0)
          .setDepth(50),
      );
    }
    this.hudBoss = this.add
      .text(GAME_WIDTH - 24, 16, '', { ...style, color: '#ffd0d0' })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(50)
      .setVisible(false);
    this.hudSpecial = this.add
      .text(24, 82, '', { ...style, color: '#fff0a8', fontSize: '17px' })
      .setScrollFactor(0)
      .setDepth(50);
    this.hudCollectibles = this.add
      .text(GAME_WIDTH / 2, 16, '', { ...style, color: '#bff29a', fontSize: '17px' })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(50);
    this.hudShield = this.add
      .text(GAME_WIDTH / 2, 44, '', { ...style, color: '#9eefff', fontSize: '15px' })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(50);
    const pauseHint = this.add
      .text(GAME_WIDTH - 24, 52, 'II  PAUSE', textStyle('16px'))
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(50)
      .setInteractive({ useHandCursor: true });
    pauseHint.on('pointerup', () => this.togglePause());
  }

  private createPauseOverlay(): void {
    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5)
      .setInteractive(new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT), Phaser.Geom.Rectangle.Contains);
    const panel = addPanel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 520, 420, 'PAUSED');
    this.pauseOverlay = this.add.container(0, 0, [dim, panel]).setScrollFactor(0).setDepth(80).setVisible(false);

    const resume = new MenuButton(this, GAME_WIDTH / 2, 300, 'RESUME', () => this.togglePause());
    const settings = new MenuButton(this, GAME_WIDTH / 2, 364, 'SETTINGS', () => launchOverlay(this, 'SettingsScene'));
    const map = new MenuButton(this, GAME_WIDTH / 2, 428, 'WORLD MAP', () => this.scene.start('WorldMapScene'));
    const mainMenu = new MenuButton(this, GAME_WIDTH / 2, 492, 'MAIN MENU', () => this.scene.start('TitleScene'));
    resume.setDepth(85);
    settings.setDepth(85);
    map.setDepth(85);
    mainMenu.setDepth(85);
    this.pauseNav = new MenuNav(this, [resume, settings, map, mainMenu], () => this.togglePause());
    this.pauseNav.setEnabled(false);
    dismissOnOutside(this, panel, () => this.togglePause(), () => this.paused && !this.completing && !this.scene.isPaused());
  }

  private syncTouchHud(): void {
    if (this.paused || this.completing || this.scene.isPaused()) {
      hideTouchControls();
    } else {
      showTouchControls();
    }
  }

  private togglePause(): void {
    if (this.completing || this.scene.isPaused()) {
      return;
    }
    this.paused = !this.paused;
    this.pauseOverlay.setVisible(this.paused);
    this.pauseNav.setEnabled(this.paused);
    this.physics.world.isPaused = this.paused;
    audio.setMusicDuck(this.paused ? 0.38 : 1);
    this.syncTouchHud();
  }

  private showCompleteMenu(title: string, unlockedSkin?: SkinDef): void {
    this.pauseOverlay.setVisible(false);
    this.pauseNav.setEnabled(false);
    this.physics.world.isPaused = true;
    audio.setMusicDuck(0.42);

    const next = nextLevelId(this.levelId);
    const items: Array<{ label: string; action: () => void }> = [];
    if (next) {
      items.push({
        label: 'NEXT LEVEL',
        action: () => this.scene.start('PlayScene', { levelId: next }),
      });
    }
    items.push(
      { label: 'WORLD MAP', action: () => this.scene.start('WorldMapScene') },
      { label: 'SETTINGS', action: () => launchOverlay(this, 'SettingsScene') },
      { label: 'CREDITS', action: () => launchOverlay(this, 'CreditsScene') },
      { label: 'MAIN MENU', action: () => this.scene.start('TitleScene') },
    );

    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5);
    const unlockBand = unlockedSkin ? 62 : 0;
    const panelHeight = 176 + unlockBand + items.length * 64;
    const panel = addPanel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 560, panelHeight, title);
    this.add.container(0, 0, [dim, panel]).setScrollFactor(0).setDepth(80);

    if (unlockedSkin) {
      const bannerY = GAME_HEIGHT / 2 - panelHeight / 2 + 86;
      const label = this.add
        .text(GAME_WIDTH / 2 + 22, bannerY, `NEW SKIN UNLOCKED\n${unlockedSkin.name}`, {
          ...textStyle('18px', '#ffe9a8'),
          align: 'center',
          lineSpacing: 4,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(84);
      this.add
        .image(label.x - label.width / 2 - 34, bannerY, skinThumbKey(unlockedSkin.id))
        .setScale(1.1)
        .setScrollFactor(0)
        .setDepth(84);
    }

    const startY = GAME_HEIGHT / 2 - panelHeight / 2 + 108 + unlockBand;
    const buttons = items.map((item, index) => {
      const button = new MenuButton(this, GAME_WIDTH / 2, startY + index * 64, item.label, item.action);
      button.setDepth(85);
      return button;
    });
    new MenuNav(this, buttons, () => this.scene.start('WorldMapScene'));
  }

  private showBanner(text: string, onDone: () => void): void {
    this.pauseNav.setEnabled(false);
    audio.setMusicDuck(0.42);
    let finished = false;
    const finish = () => {
      if (finished) {
        return;
      }
      finished = true;
      onDone();
    };
    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.45)
      .setScrollFactor(0)
      .setDepth(80)
      .setInteractive(new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT), Phaser.Geom.Rectangle.Contains);
    dim.on('pointerup', finish);
    const panel = addPanel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 560, 280, text);
    dismissOnOutside(this, panel, finish, () => !finished);
    const cont = new MenuButton(this, GAME_WIDTH / 2, 430, 'CONTINUE', finish);
    cont.setDepth(90);
    new MenuNav(this, [cont], finish);
  }
}
