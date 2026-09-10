import Phaser from 'phaser';
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  START_LIVES,
  TILE,
  enemyThreatensTile,
  isSecretLevel,
  parseLevelId,
  secretLevelId,
  themeSky,
  type EnemyKind,
  type LevelId,
} from '../config';
import {
  addCoins,
  checkpointForLevelStart,
  clearCheckpoint,
  collectStar,
  collectibleMask,
  levelCollectibleCount,
  loadSave,
  markCleared,
  nextLevelId,
  resetSessionLives,
  session,
  setCheckpoint,
  setLastPlayed,
  unlockSecretLevel,
} from '../data/progress';
import { applySettings } from '../data/settings';
import { isBossRewardSkin, skinForLevel, type SkinDef } from '../data/skins';
import { Baddie } from '../entities/Baddie';
import { Boss } from '../entities/Boss';
import { Coin } from '../entities/Coin';
import { shouldDropCoin } from '../systems/coin-drop';
import { isFallingStomp, stompBox } from '../entities/boss-combat';
import { EnemyProjectile } from '../entities/EnemyProjectile';
import { TerrainHazard } from '../entities/TerrainHazard';
import { hazardThreatensTile, type TerrainHazardSpawn } from '../entities/terrain-hazard';
import { FlakFragment } from '../entities/FlakFragment';
import { EMPTY_PLAYER_INPUT, Player, type PlayerInput } from '../entities/Player';
import { buildLevel, type BuiltLevel } from '../levels/builder';
import { bossSafeLandingX } from '../levels/arena';
import { getLevel } from '../levels/worlds';
import type { PlayerPose } from '../network/protocol';
import type { PlayerId } from '../network/role';
import { clearActiveCoopSession, type CoopRuntimeSession } from '../network/runtime-session';
import { smoothPredictionCorrection } from '../network/snapshot';
import { CoopRuntime, type CoopRuntimeEvent } from '../systems/coop-runtime';
import { audio } from '../systems/audio';
import {
  checkpointPlaneX,
  checkpointSpawnMatches,
  isEarlierCheckpoint,
  laterCheckpointIsActive,
  playerLeadX,
  reachedCheckpointPlane,
} from '../systems/checkpoint-plane';
import { spawnCheckpointFireworks } from '../systems/fireworks';
import { forgetFlak, rememberFlak, restoreFlak, setFlakGroup } from '../systems/flak';
import { Foreground } from '../systems/foreground';
import { selectMultiplayerTarget } from '../systems/multiplayer-targeting';
import { Parallax } from '../systems/parallax';
import {
  classifyPlayerCollision,
  isPlayerCollisionReady,
  playerCollisionCooldownMs,
  startPlayerCollisionCooldown,
  type CollisionCooldowns,
} from '../systems/player-collision';
import { sharedCameraGoal, smoothSharedCamera } from '../systems/shared-camera';
import {
  HUD_PAUSE,
  hideHudPause,
  hudPauseUsesDom,
  onPointerModeChange,
  setHudPauseHandler,
  showHudPause,
} from '../systems/hud-pause';
import {
  applyTouchSpecialCharge,
  createSpecialMeter,
  resetTouchSpecialCharge,
  type SpecialMeter,
} from '../systems/special-meter';
import { getTouchState, hideTouchControls, showTouchControls } from '../systems/touch-controls';
import { skinThumbKey } from '../systems/textures';
import { showBossFightBanner } from '../ui/boss-fight';
import { showControlsHint } from '../ui/controls-hint';
import { coinCounterLabel } from '../ui/coin-counter';
import { addPanel, dismissOnOutside, launchOverlay, MenuButton, MenuNav, textStyle, UI } from '../ui/menu';
import { WorldSpecial } from '../systems/world-special';

interface PlayData {
  levelId?: LevelId;
  skipControlsHint?: boolean;
  fromDeath?: boolean;
  session?: CoopRuntimeSession;
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

function coinFromCollider(
  object:
    | Phaser.Types.Physics.Arcade.GameObjectWithBody
    | Phaser.Physics.Arcade.Body
    | Phaser.Physics.Arcade.StaticBody
    | Phaser.Tilemaps.Tile,
): Coin | undefined {
  if (object instanceof Coin) {
    return object;
  }
  if ('gameObject' in object && object.gameObject instanceof Coin) {
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

function checkpointFlag(checkpoint: Phaser.Physics.Arcade.Sprite): Phaser.GameObjects.Image | undefined {
  const flag = checkpoint.getData('flag');
  return flag instanceof Phaser.GameObjects.Image ? flag : undefined;
}

function checkpointSpawnIsSafe(
  enemies: Array<{ x: number; tilesUp: number; kind: EnemyKind }>,
  traps: TerrainHazardSpawn[],
  saved: { x: number; y: number },
): boolean {
  const tileX = Math.round((saved.x - TILE / 2) / TILE);
  const enemiesSafe = enemies.every((enemy) => {
    if (enemy.tilesUp === 0 && Math.abs(enemy.x - tileX) <= 1) {
      return false;
    }
    return !enemyThreatensTile(enemy.kind, enemy.x, tileX);
  });
  const trapsSafe = traps.every((trap) => {
    if (Math.abs(trap.x - tileX) <= 1) {
      return false;
    }
    return !hazardThreatensTile(trap.kind, trap.x, tileX, trap.facing);
  });
  return enemiesSafe && trapsSafe;
}

export class PlayScene extends Phaser.Scene {
  private levelId: LevelId = '1-1';
  private built!: BuiltLevel;
  private parallax!: Parallax;
  private foreground!: Foreground;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyShift!: Phaser.Input.Keyboard.Key;
  private paused = false;
  private controlsHintOpen = false;
  private skipControlsHint = false;
  private fromDeath = false;
  private completing = false;
  private hudLives!: Phaser.GameObjects.Text;
  private hudLifeIcons: Phaser.GameObjects.Image[] = [];
  private hudBoss!: Phaser.GameObjects.Text;
  private specialMeter!: SpecialMeter;
  private hudCollectibles!: Phaser.GameObjects.Text;
  private hudCoins!: Phaser.GameObjects.Container;
  private hudCoinLabel!: Phaser.GameObjects.Text;
  private hudShield!: Phaser.GameObjects.Text;
  private pauseOverlay!: Phaser.GameObjects.Container;
  private pauseNav!: MenuNav;
  private pauseBtn!: MenuButton;
  private wasJump = false;
  private wasDown = false;
  private wasSpecial = false;
  private fightEngaged = false;
  private threatsLive = false;
  private flak!: Phaser.GameObjects.Group;
  private coins!: Phaser.Physics.Arcade.Group;
  private retainFlak = false;
  private special!: WorldSpecial;
  private link?: CoopRuntimeSession;
  private runtime?: CoopRuntime;
  private players: Player[] = [];
  private localPlayer!: Player;
  private remotePlayer?: Player;
  private collisionCooldowns: CollisionCooldowns = {};
  private stopRuntime?: () => void;
  private cameraTarget?: Phaser.GameObjects.Zone;
  private hudSpectating?: Phaser.GameObjects.Text;

  constructor() {
    super('PlayScene');
  }

  init(data: PlayData): void {
    this.levelId = data.levelId ?? '1-1';
    this.link = data.session;
    if (this.link) {
      this.link.levelId = this.levelId;
    }
    this.runtime = undefined;
    this.paused = false;
    this.controlsHintOpen = false;
    this.skipControlsHint = data.skipControlsHint === true;
    this.fromDeath = data.fromDeath === true;
    this.completing = false;
    this.wasJump = false;
    this.wasDown = false;
    this.wasSpecial = false;
    this.fightEngaged = false;
    this.threatsLive = false;
    this.retainFlak = false;
    this.players = [];
    this.collisionCooldowns = {};
  }

  create(): void {
    applySettings(this);
    setLastPlayed(this.levelId);
    this.game.canvas.dataset.levelId = this.levelId;
    const def = getLevel(this.levelId);
    this.cameras.main.setBackgroundColor(themeSky(def.theme));
    this.built = buildLevel(this, def.rows, def.theme, def.world, def.course);
    const hostPlayer = this.built.player;
    hostPlayer.role = this.link ? 'host' : undefined;
    this.players = [hostPlayer];
    if (this.link) {
      const guestPlayer = new Player(this, hostPlayer.x + 48, hostPlayer.y);
      guestPlayer.role = 'guest';
      guestPlayer.applyTheme(def.theme);
      hostPlayer.setCoopAccent(false);
      guestPlayer.setCoopAccent(true);
      this.players.push(guestPlayer);
      this.localPlayer = this.link.role === 'host' ? hostPlayer : guestPlayer;
      this.remotePlayer = this.link.role === 'host' ? guestPlayer : hostPlayer;
      this.runtime = new CoopRuntime(this.link, {
        lives: session.lives,
        x: hostPlayer.x,
        y: hostPlayer.y,
      });
      this.stopRuntime = this.runtime.subscribe((event) => this.applyCoopEvent(event));
    } else {
      this.localPlayer = hostPlayer;
    }
    this.parallax = new Parallax(this, def.theme);
    this.foreground = new Foreground(this, def.theme, this.built.widthPx, def.world, def.stage);
    audio.playTheme(this, def.theme);
    this.special = new WorldSpecial(this, this.built, def.theme, def.course.special);
    const savedCheckpoint = checkpointForLevelStart(this.levelId, this.fromDeath ? 'death' : 'fresh');
    if (savedCheckpoint && checkpointSpawnIsSafe(def.course.enemies, def.course.traps, savedCheckpoint)) {
      this.players.forEach((player, index) => player.setPosition(savedCheckpoint.x + index * 48, savedCheckpoint.y));
      this.armSavedCheckpoint(savedCheckpoint);
    }

    this.physics.world.setBounds(0, 0, this.built.widthPx, this.built.heightPx + 400);
    this.physics.world.TILE_BIAS = TILE;

    const { solids, oneways, hazards, baddies, projectiles, collectibles, miniBoss, worldBoss, bossFences } =
      this.built;

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
    this.physics.add.overlap(this.flak, hazards, (objectA, objectB) => {
      const frag = flakFromCollider(objectA) ?? flakFromCollider(objectB);
      frag?.destroy();
    });

    this.coins = this.physics.add.group({ runChildUpdate: true, allowGravity: true });
    this.physics.add.collider(this.coins, solids);
    this.physics.add.collider(
      this.coins,
      oneways,
      undefined,
      (objectA, objectB) => this.coinOneWayProcess(objectA, objectB),
    );

    for (const actor of this.players) {
      this.bindPlayerPhysics(actor);
    }
    if (this.players.length === 2) {
      this.physics.add.collider(this.players[0], this.players[1], () => this.onPlayersCollide());
    }

    this.cameraTarget = this.add.zone(hostPlayer.x, hostPlayer.y, 2, 2);
    this.cameras.main.startFollow(this.cameraTarget, true, 0.14, 0.14);
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

    if (def.theme === 'beach') {
      this.add.particles(0, 0, 'firework-spark', {
        x: { min: 0, max: this.built.widthPx },
        y: { min: GAME_HEIGHT - 90, max: GAME_HEIGHT - 24 },
        scale: { start: 0.28, end: 0 },
        lifespan: 1600,
        quantity: 1,
        frequency: 220,
        tint: [0xfff4c4, 0x7eeaf2, 0xffffff],
        speedY: { min: -18, max: -4 },
        speedX: { min: -8, max: 12 },
        alpha: { start: 0.55, end: 0 },
        blendMode: Phaser.BlendModes.ADD,
      }).setDepth(9);
    }

    if (def.theme === 'rainy-city') {
      this.add
        .rectangle(0, 0, this.built.widthPx, this.built.heightPx, 0x07101f, 0.14)
        .setOrigin(0, 0)
        .setDepth(8);
      this.add
        .particles(0, 0, 'firework-spark', {
          x: { min: -30, max: GAME_WIDTH + 80 },
          y: -20,
          scaleX: { start: 0.08, end: 0.04 },
          scaleY: { start: 0.9, end: 0.35 },
          lifespan: 720,
          quantity: 4,
          frequency: 22,
          tint: [0x9fefff, 0x63cfe8],
          speedY: { min: 720, max: 980 },
          speedX: { min: -210, max: -130 },
          alpha: { start: 0.58, end: 0.08 },
        })
        .setScrollFactor(0)
        .setDepth(30);
      const lightning = this.add
        .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xb8efff, 1)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(29)
        .setAlpha(0);
      this.time.addEvent({
        delay: 5200,
        loop: true,
        callback: () => {
          lightning.setAlpha(0.15);
          this.tweens.add({ targets: lightning, alpha: 0, duration: 150 });
        },
      });
    }

    this.createHud(def.name);
    this.createPauseOverlay();
    this.bindKeys();
    setHudPauseHandler(() => {
      if (this.completing || this.scene.isPaused() || this.controlsHintOpen) {
        return;
      }
      audio.play(this, 'select');
      this.togglePause();
    });
    const onScenePause = () => this.syncTouchHud();
    const onSceneResume = () => this.syncTouchHud();
    const stopPointerMode = onPointerModeChange(() => this.syncTouchHud());
    this.syncTouchHud();
    if (!this.skipControlsHint && parseLevelId(this.levelId).stage === 1) {
      this.openControlsHint();
    }
    this.events.on(Phaser.Scenes.Events.PAUSE, onScenePause);
    this.events.on(Phaser.Scenes.Events.RESUME, onSceneResume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.PAUSE, onScenePause);
      this.events.off(Phaser.Scenes.Events.RESUME, onSceneResume);
      stopPointerMode();
      setHudPauseHandler(undefined);
      delete this.game.canvas.dataset.levelId;
      delete this.game.canvas.dataset.controlsHint;
      hideTouchControls();
      resetTouchSpecialCharge();
      hideHudPause();
      if (!this.retainFlak) {
        forgetFlak();
      }
      this.stopRuntime?.();
      this.stopRuntime = undefined;
    });
  }

  update(): void {
    if (!this.paused && !this.controlsHintOpen) {
      this.cullFlak();
      if (this.canMutateWorld) {
        for (const player of this.livingPlayers()) {
          this.tryActivateCheckpoints(player);
        }
      }
    }
    if ((this.paused && this.pausesWorld) || this.completing || this.controlsHintOpen) {
      return;
    }

    const def = getLevel(this.levelId);
    const input = this.paused ? EMPTY_PLAYER_INPUT : this.readInput();
    const remoteInput = this.runtime?.peekRemoteInput() ?? EMPTY_PLAYER_INPUT;
    const { baddies, miniBoss, worldBoss } = this.built;

    this.refreshNoJumpZone(this.localPlayer);
    this.localPlayer.tick(input, def.theme);
    if (this.runtime && !this.runtime.isAuthority) {
      this.runtime.maybeSendInput(this.time.now, input);
    } else if (this.remotePlayer && this.isLiving(this.remotePlayer)) {
      const remoteTick = this.runtime?.takeRemoteInput() ?? EMPTY_PLAYER_INPUT;
      this.refreshNoJumpZone(this.remotePlayer);
      this.remotePlayer.tick(remoteTick, def.theme);
      this.tryActivateSpecial(this.remotePlayer, remoteTick);
    }
    this.tryActivateSpecial(this.localPlayer, input);

    if (
      !this.threatsLive &&
      (input.left || input.right || remoteInput.left || remoteInput.right)
    ) {
      this.threatsLive = true;
      for (const child of baddies.getChildren()) {
        if (child instanceof Baddie) {
          child.armThreats();
        }
      }
      for (const child of this.built.traps.getChildren()) {
        if (child instanceof TerrainHazard) {
          child.arm();
        }
      }
    }
    if (this.threatsLive) {
      for (const child of baddies.getChildren()) {
        const baddie = child as Baddie;
        const target = this.closestLivingPlayer(baddie.x);
        if (target) {
          baddie.tick(target, this.built.solids, this.built.oneways, this.built.projectiles);
        }
      }
      for (const child of this.built.traps.getChildren()) {
        if (child instanceof TerrainHazard) {
          const target = this.closestLivingPlayer(child.x);
          if (target) {
            child.tick(target, this.built.projectiles);
          }
        }
      }
      for (const child of this.built.projectiles.getChildren()) {
        if (child instanceof EnemyProjectile) {
          const target = this.closestLivingPlayer(child.x);
          if (target) {
            child.tick(target);
          }
        }
      }
    }
    const bossTarget = this.closestLivingPlayer((worldBoss ?? miniBoss)?.x ?? this.localPlayer.x);
    if (bossTarget) {
      this.tickBoss(miniBoss, bossTarget);
      this.tickBoss(worldBoss, bossTarget);
    }

    if (this.canMutateWorld) {
      for (const player of this.livingPlayers()) {
        if (player.y > this.built.heightPx + 20) {
          this.killPlayer('pit', player);
        }
      }
    }

    this.updateCoopCamera();
    this.broadcastSnapshot();
    this.parallax.update(this.cameras.main.scrollX);
    this.foreground.update(this.cameras.main.scrollX);

    this.hudLives.setText('Lives');
    this.hudLifeIcons.forEach((icon, index) => {
      icon.setVisible(index < session.lives);
    });
    this.syncSpecialCharge();
    this.hudCollectibles.setText(`STARS  ${levelCollectibleCount(this.levelId)}/3`);
    this.syncHudCoins();
    this.hudShield.setText(this.localPlayer.shielded ? 'SHIELD  READY' : 'SHIELD  —');
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

  private get canMutateWorld(): boolean {
    return this.runtime?.isAuthority ?? true;
  }

  private get pausesWorld(): boolean {
    return this.runtime?.pausesWorld ?? true;
  }

  private isLiving(player: Player): boolean {
    return player.active && (player.role ? this.runtime?.isActive(player.role) !== false : true);
  }

  private livingPlayers(): Player[] {
    return this.players.filter((player) => this.isLiving(player));
  }

  private playerWithRole(role: PlayerId): Player | undefined {
    return this.players.find((player) => player.role === role);
  }

  private continueWithSession(levelId: LevelId, extra: Partial<PlayData> = {}): PlayData {
    this.runtime?.setLevelId(levelId);
    return {
      levelId,
      session: this.link,
      skipControlsHint: true,
      ...extra,
    };
  }

  private closestLivingPlayer(x: number): Player | undefined {
    const target = selectMultiplayerTarget(
      { x, y: 0 },
      this.players.map((player) => ({
        id: player.role ?? 'host',
        x: player.x,
        y: player.y,
        targetable: this.isLiving(player),
      })),
    );
    return target ? this.playerWithRole(target.id) ?? this.players[0] : undefined;
  }

  private tryActivateSpecial(player: Player, input: PlayerInput): void {
    if (!input.specialJust || !this.canMutateWorld) {
      return;
    }
    const direction = player.flipX ? -1 : 1;
    if (!this.special.activate(player, direction)) {
      return;
    }
    audio.play(this, 'special');
    if (player.role) {
      this.runtime?.sendSpecial(player.role, direction);
    }
  }

  private playerPose(player: Player): PlayerPose {
    return {
      x: player.x,
      y: player.y,
      velocityX: player.arcadeBody.velocity.x,
      velocityY: player.arcadeBody.velocity.y,
      flipX: player.flipX,
      alive: this.isLiving(player),
    };
  }

  private broadcastSnapshot(): void {
    const host = this.playerWithRole('host');
    const guest = this.playerWithRole('guest');
    if (!this.runtime || !host || !guest) {
      return;
    }
    const boss = this.built.worldBoss ?? this.built.miniBoss;
    this.runtime.maybeBroadcastSnapshot(this.time.now, {
      host: this.playerPose(host),
      guest: this.playerPose(guest),
      lives: session.lives,
      boss: boss
        ? {
            x: boss.x,
            y: boss.y,
            velocityX: boss.arcadeBody.velocity.x,
            velocityY: boss.arcadeBody.velocity.y,
            hp: boss.hp,
            engaged: boss.engaged,
            active: boss.active && !boss.dying,
          }
        : undefined,
    });
  }

  private applyRemotePose(player: Player, pose: PlayerPose, reconcile: boolean): void {
    if (!pose.alive) {
      if (!player.frozen) {
        player.enterSpectating();
      }
      return;
    }
    if (player.frozen) {
      player.reviveAt(pose.x, pose.y);
    }
    const corrected = reconcile
      ? smoothPredictionCorrection(
          {
            x: player.x,
            y: player.y,
            velocityX: player.arcadeBody.velocity.x,
            velocityY: player.arcadeBody.velocity.y,
          },
          pose,
          0.35,
          180,
        )
      : pose;
    player.applyNetworkPose({ ...pose, ...corrected });
  }

  private applyCoopEvent(event: CoopRuntimeEvent): void {
    switch (event.type) {
      case 'snapshot': {
        const host = this.playerWithRole('host');
        const guest = this.playerWithRole('guest');
        if (host && guest) {
          this.applyRemotePose(host, event.host, false);
          this.applyRemotePose(guest, event.guest, true);
          session.lives = event.lives;
          const boss = this.built.worldBoss ?? this.built.miniBoss;
          if (boss && event.boss) {
            boss.setPosition(event.boss.x, event.boss.y);
            boss.arcadeBody.setVelocity(event.boss.velocityX, event.boss.velocityY);
            boss.hp = event.boss.hp;
            boss.engaged = event.boss.engaged;
            if (!event.boss.active && boss.active) {
              boss.poofAway();
            }
          }
        }
        return;
      }
      case 'checkpoint':
        setCheckpoint(this.levelId, event.x, event.y);
        this.reviveSpectators(event.x, event.y);
        return;
      case 'player-impact':
        this.playImpact(event.kind);
        return;
      case 'player-down': {
        const player = this.playerWithRole(event.playerId);
        if (player && !player.frozen) {
          player.die(() => player.enterSpectating());
        }
        return;
      }
      case 'special': {
        const player = this.playerWithRole(event.playerId);
        if (player && this.special.activate(player, event.direction)) {
          audio.play(this, 'special');
        }
        return;
      }
      case 'reward-coin':
        this.syncHudCoins(addCoins(1).coins);
        return;
      case 'reward-star':
        collectStar(this.levelId, event.index);
        for (const child of this.built.collectibles.getChildren()) {
          if (Number((child as Phaser.GameObjects.GameObject).getData('index')) === event.index) {
            child.destroy();
          }
        }
        return;
      case 'team-restart':
        this.scene.restart(this.continueWithSession(event.levelId, { fromDeath: true }));
        return;
      case 'level-complete':
        if (event.levelId === this.levelId && !this.completing) {
          this.completing = true;
          markCleared(this.levelId);
          this.showCompleteMenu('CO-OP CLEAR!');
        }
        return;
      case 'leave':
        if (!this.completing) {
          this.completing = true;
          const returningToLobby = event.reason === 'team-game-over' || event.reason === 'return-to-lobby';
          this.showBanner(returningToLobby ? 'RETURNING TO LOBBY' : 'TEAMMATE LEFT', () => {
            clearActiveCoopSession('peer-left');
            this.scene.start(returningToLobby ? 'CoopScene' : 'TitleScene');
          });
        }
        return;
      default: {
        const neverEvent: never = event;
        return neverEvent;
      }
    }
  }

  private playImpact(kind: 'side' | 'head'): void {
    this.players.forEach((player) => player.playTeammateImpact(kind));
    audio.play(this, kind === 'head' ? 'teammate-stomp' : 'teammate-bump');
  }

  private updateCoopCamera(): void {
    const target = this.cameraTarget;
    if (!target) {
      return;
    }
    const goal = sharedCameraGoal(
      this.players.map((player) => ({
        id: player.role ?? 'host',
        x: player.x,
        y: player.y,
        velocityX: player.arcadeBody.velocity.x,
        velocityY: player.arcadeBody.velocity.y,
        active: this.isLiving(player),
      })),
      {
        viewportWidth: GAME_WIDTH,
        viewportHeight: GAME_HEIGHT,
        paddingX: 180,
        paddingY: 140,
        minZoom: 0.72,
        maxZoom: 1,
        lookAheadSeconds: 0.08,
      },
    );
    if (!goal) {
      return;
    }
    const smoothed = smoothSharedCamera(
      { x: target.x, y: target.y, zoom: this.cameras.main.zoom },
      goal,
      0.14,
      0.08,
    );
    target.setPosition(smoothed.x, smoothed.y);
    this.cameras.main.zoom = smoothed.zoom;
    const living = this.livingPlayers();
    if (this.canMutateWorld && living.length === 2 && Math.abs(living[0]!.x - living[1]!.x) > 900) {
      const left = living[0]!.x < living[1]!.x ? living[0]! : living[1]!;
      const right = left === living[0] ? living[1]! : living[0]!;
      left.arcadeBody.setVelocityX(Math.max(left.arcadeBody.velocity.x, 80));
      right.arcadeBody.setVelocityX(Math.min(right.arcadeBody.velocity.x, -80));
    }
    const spectating = !this.isLiving(this.localPlayer);
    this.hudSpectating?.setVisible(spectating);
    if (spectating) {
      this.hudSpectating?.setText(`SPECTATING ${this.runtime?.remoteName.toUpperCase() ?? 'TEAMMATE'}`);
    }
  }

  private bindPlayerPhysics(player: Player): void {
    this.physics.add.collider(player, this.built.solids);
    this.physics.add.collider(
      player,
      this.built.puzzleTargets,
      undefined,
      (objectA, objectB) => {
        const target = objectA === player ? objectB : objectA;
        return 'getData' in target && target.getData('solid') === true;
      },
    );
    this.physics.add.collider(
      player,
      this.built.oneways,
      undefined,
      (objectA, objectB) => this.oneWayProcess(objectA, objectB),
    );
    this.physics.add.collider(player, this.built.baddies, (objectA, objectB) => {
      this.onBaddieCollide(objectA as Player, objectB as Baddie);
    });
    if (this.built.miniBoss) {
      this.bindBossCombat(player, this.built.miniBoss, false);
    }
    if (this.built.worldBoss) {
      this.bindBossCombat(player, this.built.worldBoss, true);
    }
    const die = () => this.killPlayer('hazard', player);
    this.physics.add.overlap(player, this.built.hazards, die);
    this.physics.add.overlap(player, this.built.traps, die);
    this.physics.add.overlap(player, this.built.trapBeams, die);
    this.physics.add.overlap(player, this.built.projectiles, (objectA, objectB) => {
      if (!this.canMutateWorld) {
        return;
      }
      const projectile = objectA instanceof EnemyProjectile ? objectA : objectB instanceof EnemyProjectile ? objectB : undefined;
      if (projectile && !projectile.neutralized) {
        projectile.destroy();
        this.killPlayer('baddie', player);
      }
    });
    this.physics.add.overlap(player, this.built.collectibles, (objectA, objectB) => {
      const pickup = objectA === player ? objectB : objectA;
      if ('getData' in pickup) {
        this.collectPickup(pickup as Phaser.Physics.Arcade.Sprite);
      }
    });
    this.physics.add.overlap(player, this.built.shields, (objectA, objectB) => {
      if (!this.canMutateWorld) {
        return;
      }
      const pickup = objectA === player ? objectB : objectA;
      if ('destroy' in pickup) {
        player.giveShield();
        audio.play(this, 'select');
        (pickup as Phaser.GameObjects.GameObject).destroy();
      }
    });
    this.physics.add.overlap(player, this.built.checkpoints, (objectA, objectB) => {
      const checkpoint = objectA === player ? objectB : objectA;
      if ('getData' in checkpoint) {
        this.activateCheckpoint(checkpoint as Phaser.Physics.Arcade.Sprite);
      }
    });
    if (this.built.secretPortal) {
      this.physics.add.overlap(player, this.built.secretPortal, () => {
        this.enterSecretPortal(this.built.secretPortal!);
      });
    }
    this.physics.add.collider(player, this.flak, (objectA, objectB) => this.onFlakBump(objectA, objectB));
    this.physics.add.overlap(player, this.coins, (objectA, objectB) => {
      const coin = coinFromCollider(objectA) ?? coinFromCollider(objectB);
      if (coin) {
        this.collectCoin(coin);
      }
    });
  }

  private onPlayersCollide(): void {
    const first = this.playerWithRole('host');
    const second = this.playerWithRole('guest');
    if (
      !this.canMutateWorld ||
      !first ||
      !second ||
      !this.isLiving(first) ||
      !this.isLiving(second) ||
      !isPlayerCollisionReady(this.collisionCooldowns, first.role ?? 'host', second.role ?? 'guest', this.time.now)
    ) {
      return;
    }
    const collision = classifyPlayerCollision(
      {
        id: first.role ?? 'host',
        x: first.x,
        y: first.y,
        width: first.arcadeBody.width,
        height: first.arcadeBody.height,
        velocityX: first.arcadeBody.velocity.x,
        velocityY: first.arcadeBody.velocity.y,
      },
      {
        id: second.role ?? 'guest',
        x: second.x,
        y: second.y,
        width: second.arcadeBody.width,
        height: second.arcadeBody.height,
        velocityX: second.arcadeBody.velocity.x,
        velocityY: second.arcadeBody.velocity.y,
      },
    );
    this.collisionCooldowns = startPlayerCollisionCooldown(
      this.collisionCooldowns,
      first.role ?? 'host',
      second.role ?? 'guest',
      this.time.now,
      playerCollisionCooldownMs(collision.kind),
    );
    if (collision.kind === 'none' || collision.kind === 'separate') {
      return;
    }
    if (collision.kind === 'host-stomps-guest' || collision.kind === 'guest-stomps-host') {
      const upper = collision.kind === 'host-stomps-guest' ? first : second;
      upper.bounce();
      this.playImpact('head');
      this.runtime?.sendImpact('head', upper.role);
      return;
    }
    const direction = Math.sign(second.x - first.x) || 1;
    first.arcadeBody.setVelocityX(-direction * 190);
    second.arcadeBody.setVelocityX(direction * 190);
    this.playImpact('side');
    this.runtime?.sendImpact('side');
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
      if (this.scene.isPaused() || this.completing || this.controlsHintOpen) {
        return;
      }
      this.togglePause();
    });
    kb.on('keydown-ESC', () => {
      if (this.scene.isPaused() || this.completing || this.paused || this.controlsHintOpen) {
        return;
      }
      this.togglePause();
    });
  }

  private refreshNoJumpZone(player: Player): void {
    player.jumpLocked = false;
    const grounded = player.arcadeBody.blocked.down || player.arcadeBody.touching.down;
    for (const child of this.built.puzzleTargets.getChildren()) {
      const target = child as Phaser.Physics.Arcade.Sprite;
      if (!target.active || target.getData('kind') !== 'down-current') {
        continue;
      }
      const flow = target.getData('flow') as Phaser.GameObjects.TileSprite | undefined;
      if (flow?.active) {
        flow.tilePositionY += 1.8;
      }
      const body = target.body as Phaser.Physics.Arcade.StaticBody | null;
      if (!body?.enable) {
        continue;
      }
      const pb = player.arcadeBody;
      if (pb.right <= body.left || pb.left >= body.right || pb.bottom <= body.top || pb.top >= body.bottom) {
        continue;
      }
      player.jumpLocked = true;
      if (!grounded) {
        pb.setVelocityY(Math.max(pb.velocity.y, 220));
      }
    }
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
    if (downJust && (this.localPlayer.arcadeBody.blocked.down || this.localPlayer.arcadeBody.touching.down)) {
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
    const body = player.arcadeBody;
    if (body.velocity.y < 0) {
      return false;
    }
    const platform = objectA === player || ('gameObject' in objectA && objectA.gameObject === player) ? objectB : objectA;
    const plat =
      'top' in platform && 'bottom' in platform
        ? platform
        : 'body' in platform
          ? platform.body
          : undefined;
    if (!plat || !('top' in plat)) {
      return true;
    }
    return body.bottom - body.deltaY() <= plat.top + 10;
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
    if (!this.canMutateWorld || !baddie.active || baddie.dying || player.frozen) {
      return;
    }
    if (isFallingStomp(stompBox(player.arcadeBody), stompBox(baddie.arcadeBody))) {
      const result = baddie.tryStomp();
      player.bounce();
      audio.play(this, result === 'defeated' ? 'stomp' : 'hurt');
      if (result === 'defeated' && shouldDropCoin()) {
        this.coins.add(new Coin(this, baddie.x, baddie.y - 10));
      }
      return;
    }
    this.killPlayer('baddie', player);
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

  private enterSecretPortal(portal: Phaser.Physics.Arcade.Sprite): void {
    if (!this.canMutateWorld || this.completing || this.paused || this.controlsHintOpen) {
      return;
    }
    const parsed = parseLevelId(this.levelId);
    if (parsed.secret || parsed.stage !== 3) {
      return;
    }
    const target = secretLevelId(parsed.world);
    this.completing = true;
    this.syncTouchHud();
    this.players.forEach((actor) => actor.freeze());
    unlockSecretLevel(target);
    audio.play(this, 'phase');
    const traveler = this.localPlayer ?? this.built.player;
    traveler.suckInto(portal.x, portal.y, () => {
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.runtime?.sendTeamRestart(target);
        this.scene.start('PlayScene', this.continueWithSession(target));
      });
      this.cameras.main.fadeOut(320, 0, 0, 0);
    });
  }

  private canStompBoss(player: Player, boss: Boss): boolean {
    if (!this.canMutateWorld || !boss.active || boss.dying || player.frozen) {
      return false;
    }
    return isFallingStomp(stompBox(player.arcadeBody), stompBox(boss.arcadeBody));
  }

  private onBossHeadStomp(player: Player, boss: Boss, worldBoss: boolean): void {
    if (!this.canMutateWorld || !boss.active || boss.dying || player.frozen) {
      return;
    }
    const result = boss.takeStomp();
    this.bounceFromBoss(player, boss);
    if (result === 'ignored') {
      audio.play(this, 'block');
      return;
    }
    audio.play(this, 'stomp');
    if (result === 'dead') {
      this.defeatBoss(boss, worldBoss);
    }
  }

  private onBossBodyHit(player: Player, boss: Boss): void {
    if (!this.canMutateWorld || !boss.active || boss.dying || player.frozen) {
      return;
    }
    if (this.canStompBoss(player, boss)) {
      return;
    }
    if (!boss.isInvulnerable) {
      this.killPlayer('baddie', player);
    }
  }

  private defeatBoss(boss: Boss, worldBoss: boolean): void {
    this.completing = true;
    this.syncTouchHud();
    this.players.forEach((player) => player.freeze());
    const firstClear = !loadSave().cleared.includes(this.levelId);
    markCleared(this.levelId);
    this.runtime?.sendLevelComplete(
      this.levelId,
      `${this.link?.localPlayerId ?? 'solo'}:${this.levelId}:${Date.now()}`,
    );
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

  private killPlayer(reason: 'pit' | 'hazard' | 'baddie', player: Player): void {
    if (!this.canMutateWorld || this.completing || player.frozen || !this.isLiving(player)) {
      return;
    }
    if (reason === 'baddie' && !player.canBeHurt()) {
      return;
    }
    if (reason === 'baddie' && player.consumeShield()) {
      audio.play(this, 'hurt');
      return;
    }
    if (this.runtime && player.role) {
      const outcome = this.runtime.markPlayerDown(player.role);
      if (outcome === 'ignored') {
        return;
      }
      audio.play(this, 'hurt');
      session.lives = this.runtime.lives;
      player.die(() => {
        player.enterSpectating();
        if (outcome === 'team-wipe') {
          this.restartCoopTeam(player.role ?? 'host');
        }
      });
      return;
    }
    this.completing = true;
    this.syncTouchHud();
    session.lives -= 1;
    audio.play(this, 'hurt');
    player.die(() => {
      if (session.lives <= 0) {
        forgetFlak();
        clearCheckpoint(this.levelId);
        this.showBanner('GAME OVER', () => {
          resetSessionLives();
          this.scene.start('WorldMapScene');
        });
        return;
      }
      rememberFlak(this.levelId, this.flak, this.built.heightPx + 160);
      this.retainFlak = true;
      this.scene.restart({ levelId: this.levelId, skipControlsHint: true, fromDeath: true });
    });
  }

  private restartCoopTeam(causedBy: PlayerId): void {
    if (!this.runtime || !this.canMutateWorld || this.completing) {
      return;
    }
    this.completing = true;
    const outcome = this.runtime.spendTeamLife(causedBy);
    if (outcome === 'ignored') {
      this.completing = false;
      return;
    }
    session.lives = this.runtime.lives;
    if (outcome === 'game-over') {
      clearCheckpoint(this.levelId);
      this.showBanner('TEAM GAME OVER', () => {
        resetSessionLives();
        clearActiveCoopSession('team-game-over');
        this.scene.start('CoopScene');
      });
      return;
    }
    rememberFlak(this.levelId, this.flak, this.built.heightPx + 160);
    this.retainFlak = true;
    this.runtime.sendTeamRestart(this.levelId);
    this.scene.restart(this.continueWithSession(this.levelId, { fromDeath: true }));
  }

  private reviveSpectators(x: number, y: number): void {
    let revived = false;
    this.players.forEach((player, index) => {
      if (!player.frozen) {
        return;
      }
      player.reviveAt(x + index * 48, y);
      player.setCoopAccent(player.role === 'guest');
      revived = true;
    });
    if (revived) {
      audio.play(this, 'firework-burst');
    }
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

  private coinOneWayProcess(
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
    const coin = coinFromCollider(objectA) ?? coinFromCollider(objectB);
    if (!coin) {
      return false;
    }
    return coin.arcadeBody.velocity.y >= 0;
  }

  private collectCoin(coin: Coin): void {
    if (!this.canMutateWorld || !coin.active || coin.isCollecting) {
      return;
    }
    coin.beginCollect();
    this.syncHudCoins(addCoins(1).coins);
    this.runtime?.grantCoin(`${this.levelId}:coin:${coin.x}:${coin.y}:${this.time.now}`);
    this.punchHudCoins();
    audio.play(this, 'coin');
    this.tweens.add({
      targets: coin.fadeTargets(),
      y: coin.y - 28,
      alpha: 0,
      scale: coin.scaleX * 1.4,
      duration: 220,
      onComplete: () => coin.destroy(),
    });
  }

  private collectPickup(pickup: Phaser.Physics.Arcade.Sprite): void {
    if (!this.canMutateWorld || !pickup.active) {
      return;
    }
    const index = Number(pickup.getData('index'));
    collectStar(this.levelId, index);
    this.runtime?.grantStar(`${this.levelId}:star:${index}`, index);
    audio.play(this, 'collect');
    this.tweens.add({
      targets: pickup,
      y: pickup.y - 36,
      alpha: 0,
      scale: pickup.scaleX * 1.6,
      duration: 240,
      onComplete: () => pickup.destroy(),
    });
  }

  private checkpointSprites(): Phaser.Physics.Arcade.Sprite[] {
    return this.built.checkpoints.getChildren().filter((child): child is Phaser.Physics.Arcade.Sprite => {
      return 'getData' in child && 'setData' in child;
    });
  }

  private activeCheckpointXs(): number[] {
    return this.checkpointSprites()
      .filter((checkpoint) => checkpoint.getData('active') === true)
      .map((checkpoint) => checkpointPlaneX(checkpoint));
  }

  private armSavedCheckpoint(saved: { x: number; y: number }): void {
    for (const checkpoint of this.checkpointSprites()) {
      const spawn = {
        x: Number(checkpoint.getData('spawnX')),
        y: Number(checkpoint.getData('spawnY')),
      };
      if (!checkpointSpawnMatches(spawn, saved)) {
        continue;
      }
      checkpoint.setData('active', true);
      checkpointFlag(checkpoint)?.setTint(0x9be36e);
    }
  }

  private tryActivateCheckpoints(player: Player): void {
    const leadX = playerLeadX(player.x, player.arcadeBody.right);
    for (const checkpoint of this.checkpointSprites()) {
      if (reachedCheckpointPlane(leadX, checkpointPlaneX(checkpoint))) {
        this.activateCheckpoint(checkpoint);
      }
    }
  }

  private deactivateEarlierCheckpoints(incomingX: number): void {
    for (const checkpoint of this.checkpointSprites()) {
      if (!isEarlierCheckpoint(checkpointPlaneX(checkpoint), incomingX)) {
        continue;
      }
      checkpoint.setData('active', false);
      checkpointFlag(checkpoint)?.clearTint();
    }
  }

  private activateCheckpoint(checkpoint: Phaser.Physics.Arcade.Sprite): void {
    if (!this.canMutateWorld || checkpoint.getData('active') === true) {
      return;
    }
    const incomingX = checkpointPlaneX(checkpoint);
    if (laterCheckpointIsActive(incomingX, this.activeCheckpointXs())) {
      return;
    }
    this.deactivateEarlierCheckpoints(incomingX);
    checkpoint.setData('active', true);
    const flag = checkpointFlag(checkpoint) ?? checkpoint;
    flag.setTint(0x9be36e);
    const spawnX = Number(checkpoint.getData('spawnX'));
    const spawnY = Number(checkpoint.getData('spawnY'));
    setCheckpoint(this.levelId, spawnX, spawnY);
    spawnCheckpointFireworks(this, flag);
    this.runtime?.noteCheckpoint({
      id: `${this.levelId}:checkpoint:${incomingX}`,
      order: incomingX,
      x: spawnX,
      y: spawnY,
    });
    this.reviveSpectators(spawnX, spawnY);
  }

  private createHud(name: string): void {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      ...textStyle('24px', '#ffffff'),
    };
    this.add.text(24, 16, `${this.levelId}  ${name}`, style).setScrollFactor(0).setDepth(50).setResolution(2);
    this.hudLives = this.add.text(24, 44, 'Lives', style).setScrollFactor(0).setDepth(50).setResolution(2);
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
    this.hudCoinLabel = this.add
      .text(18, 0, '', { ...style, color: UI.gold, fontSize: '22px' })
      .setResolution(2);
    const coinIcon = this.add.image(0, 12, 'coin').setScale(0.5);
    this.hudCoins = this.add
      .container(214, 44, [coinIcon, this.hudCoinLabel])
      .setScrollFactor(0)
      .setDepth(50);
    this.syncHudCoins();
    this.hudBoss = this.add
      .text(GAME_WIDTH - HUD_PAUSE.width - 28, 16, '', { ...style, color: '#ffd0d0' })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(50)
      .setResolution(2)
      .setVisible(false);
    this.specialMeter = createSpecialMeter(this, this.special.label);
    this.hudCollectibles = this.add
      .text(GAME_WIDTH / 2, 16, '', { ...style, color: '#fff4d0', fontSize: '20px' })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(50)
      .setResolution(2);
    this.hudShield = this.add
      .text(GAME_WIDTH / 2, 44, '', { ...style, color: '#9eefff', fontSize: '18px' })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(50)
      .setResolution(2);
    this.hudSpectating = this.add
      .text(GAME_WIDTH / 2, 82, '', {
        ...textStyle('24px', '#ffe9a8'),
        backgroundColor: '#140c10',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(55)
      .setVisible(false);
    this.pauseBtn = new MenuButton(
      this,
      HUD_PAUSE.x,
      HUD_PAUSE.y,
      'PAUSE',
      () => this.togglePause(),
      HUD_PAUSE.width,
      HUD_PAUSE.height,
    );
    this.pauseBtn.setDepth(50);
    this.pauseBtn.enablePointer(28);
  }

  private syncHudCoins(coins = loadSave().coins): void {
    this.hudCoinLabel.setText(coinCounterLabel(coins));
  }

  private punchHudCoins(): void {
    this.tweens.killTweensOf(this.hudCoins);
    this.hudCoins.setScale(1);
    this.tweens.add({
      targets: this.hudCoins,
      scale: 1.14,
      duration: 90,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private createPauseOverlay(): void {
    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5)
      .setInteractive(new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT), Phaser.Geom.Rectangle.Contains);
    const panel = addPanel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 520, 420, 'PAUSED');
    this.pauseOverlay = this.add.container(0, 0, [dim, panel]).setScrollFactor(0).setDepth(80).setVisible(false);

    const resume = new MenuButton(this, GAME_WIDTH / 2, 300, 'RESUME', () => this.togglePause());
    const settings = new MenuButton(this, GAME_WIDTH / 2, 364, 'SETTINGS', () => launchOverlay(this, 'SettingsScene'));
    const map = new MenuButton(
      this,
      GAME_WIDTH / 2,
      428,
      this.runtime ? 'CO-OP LOBBY' : 'WORLD MAP',
      () => {
        if (this.runtime) {
          clearActiveCoopSession('return-to-lobby');
          this.scene.start('CoopScene');
        } else {
          this.scene.start('WorldMapScene');
        }
      },
    );
    const mainMenu = new MenuButton(this, GAME_WIDTH / 2, 492, 'MAIN MENU', () => {
      clearActiveCoopSession('main-menu');
      this.scene.start('TitleScene');
    });
    resume.setDepth(85);
    settings.setDepth(85);
    map.setDepth(85);
    mainMenu.setDepth(85);
    this.pauseNav = new MenuNav(this, [resume, settings, map, mainMenu], () => this.togglePause());
    this.pauseNav.setEnabled(false);
    dismissOnOutside(this, panel, () => this.togglePause(), () => this.paused && !this.completing && !this.scene.isPaused());
  }

  private syncTouchHud(): void {
    const blocked = this.paused || this.completing || this.controlsHintOpen || this.scene.isPaused();
    if (blocked) {
      hideTouchControls();
      hideHudPause();
      this.pauseBtn.setVisible(false);
      this.pauseBtn.disableInteractive();
      return;
    }
    showTouchControls();
    if (hudPauseUsesDom()) {
      this.pauseBtn.setVisible(false);
      this.pauseBtn.disableInteractive();
      showHudPause();
    } else {
      hideHudPause();
      this.pauseBtn.setVisible(true);
      this.pauseBtn.enablePointer(28);
    }
    this.syncSpecialCharge();
  }

  private syncSpecialCharge(): void {
    const charge = this.special.chargeRatio;
    const touchPlay = document.body.classList.contains('touch-play');
    this.specialMeter.setVisible(!touchPlay);
    this.specialMeter.setCharge(charge);
    applyTouchSpecialCharge(charge);
  }

  private openControlsHint(): void {
    this.controlsHintOpen = true;
    this.physics.world.isPaused = true;
    audio.setMusicDuck(0.38);
    this.game.canvas.dataset.controlsHint = '1';
    this.syncTouchHud();
    showControlsHint(this, this.special.kind, getLevel(this.levelId).theme, () => {
      if (!this.controlsHintOpen) {
        return;
      }
      this.controlsHintOpen = false;
      delete this.game.canvas.dataset.controlsHint;
      this.wasJump = true;
      this.wasDown = true;
      this.wasSpecial = true;
      this.physics.world.isPaused = false;
      audio.setMusicDuck(1);
      this.syncTouchHud();
    });
  }

  private togglePause(): void {
    if (this.completing || this.scene.isPaused() || this.controlsHintOpen) {
      return;
    }
    this.paused = !this.paused;
    this.pauseOverlay.setVisible(this.paused);
    this.pauseNav.setEnabled(this.paused);
    this.physics.world.isPaused = this.paused && this.pausesWorld;
    audio.setMusicDuck(this.paused ? 0.38 : 1);
    this.syncTouchHud();
  }

  private showCompleteMenu(title: string, unlockedSkin?: SkinDef): void {
    this.pauseOverlay.setVisible(false);
    this.pauseNav.setEnabled(false);
    this.physics.world.isPaused = true;
    audio.setMusicDuck(0.42);

    const next = isSecretLevel(this.levelId) ? undefined : nextLevelId(this.levelId);
    const items: Array<{ label: string; action: () => void }> = [];
    if (next && this.canMutateWorld) {
      items.push({
        label: 'NEXT LEVEL',
        action: () => {
          this.runtime?.sendTeamRestart(next);
          this.scene.start('PlayScene', this.continueWithSession(next));
        },
      });
    }
    if (this.runtime) {
      items.push({
        label: 'CO-OP LOBBY',
        action: () => {
          clearActiveCoopSession('return-to-lobby');
          this.scene.start('CoopScene');
        },
      });
    } else {
      items.push(
        { label: 'WORLD MAP', action: () => this.scene.start('WorldMapScene') },
        { label: 'SETTINGS', action: () => launchOverlay(this, 'SettingsScene') },
        { label: 'CREDITS', action: () => launchOverlay(this, 'CreditsScene') },
        { label: 'MAIN MENU', action: () => this.scene.start('TitleScene') },
      );
    }

    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5);
    const unlockBand = unlockedSkin ? 62 : 0;
    const panelHeight = 176 + unlockBand + items.length * 64;
    const panel = addPanel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 560, panelHeight, title);
    this.add.container(0, 0, [dim, panel]).setScrollFactor(0).setDepth(80);

    if (unlockedSkin) {
      const bannerY = GAME_HEIGHT / 2 - panelHeight / 2 + 86;
      const banner = isBossRewardSkin(unlockedSkin)
        ? `NEW SKIN UNLOCKED\n${unlockedSkin.name}`
        : `SKIN AVAILABLE\n${unlockedSkin.name}  ·  ${unlockedSkin.cost ?? 0} coins`;
      const label = this.add
        .text(GAME_WIDTH / 2 + 22, bannerY, banner, {
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
