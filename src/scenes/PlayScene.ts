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
import { Player, type PlayerInput } from '../entities/Player';
import { buildLevel, type BuiltLevel } from '../levels/builder';
import { bossSafeLandingX } from '../levels/arena';
import { getLevel } from '../levels/worlds';
import {
  clearActiveCoopSession,
  getActiveCoopSession,
  type CoopRuntimeSession,
  type BossPose,
  type PlayerPose,
  type RuntimeMessage,
} from '../network/runtime-session';
import { smoothPredictionCorrection } from '../network/snapshot';
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
  coop?: boolean;
}

const EMPTY_INPUT: PlayerInput = {
  left: false,
  right: false,
  jump: false,
  jumpJust: false,
  down: false,
  downJust: false,
  special: false,
  specialJust: false,
};

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
  private coop?: CoopRuntimeSession;
  private players: Player[] = [];
  private localPlayer!: Player;
  private remotePlayer?: Player;
  private remoteInput: PlayerInput = EMPTY_INPUT;
  private playerAlive = new Map<Player, boolean>();
  private networkSequence = 0;
  private lastSnapshotAt = 0;
  private lastInputSentAt = 0;
  private collisionCooldowns: CollisionCooldowns = {};
  private stopTransport?: () => void;
  private cameraTarget?: Phaser.GameObjects.Zone;
  private hudSpectating?: Phaser.GameObjects.Text;
  private appliedRewardEvents = new Set<string>();

  constructor() {
    super('PlayScene');
  }

  init(data: PlayData): void {
    this.levelId = data.levelId ?? '1-1';
    const session = getActiveCoopSession();
    this.coop = data.coop === true && session?.levelId === this.levelId ? session : undefined;
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
    this.remoteInput = EMPTY_INPUT;
    this.playerAlive.clear();
    this.networkSequence = 0;
    this.lastSnapshotAt = 0;
    this.lastInputSentAt = 0;
    this.collisionCooldowns = {};
    this.appliedRewardEvents.clear();
  }

  create(): void {
    applySettings(this);
    setLastPlayed(this.levelId);
    this.game.canvas.dataset.levelId = this.levelId;
    const def = getLevel(this.levelId);
    this.cameras.main.setBackgroundColor(themeSky(def.theme));
    this.built = buildLevel(this, def.rows, def.theme, def.world, def.course);
    const hostPlayer = this.built.player;
    this.players = [hostPlayer];
    if (this.coop) {
      const guestPlayer = new Player(this, hostPlayer.x + 48, hostPlayer.y);
      guestPlayer.applyTheme(def.theme);
      hostPlayer.setData('playerId', this.coop.role === 'host' ? this.coop.localPlayerId : this.coop.remotePlayerId);
      guestPlayer.setData('playerId', this.coop.role === 'guest' ? this.coop.localPlayerId : this.coop.remotePlayerId);
      hostPlayer.setCoopAccent(false);
      guestPlayer.setCoopAccent(true);
      this.players.push(guestPlayer);
      this.localPlayer = this.coop.role === 'host' ? hostPlayer : guestPlayer;
      this.remotePlayer = this.coop.role === 'host' ? guestPlayer : hostPlayer;
      this.stopTransport = this.coop.transport.subscribe((message) => this.onRuntimeMessage(message));
    } else {
      this.localPlayer = hostPlayer;
    }
    for (const player of this.players) {
      this.playerAlive.set(player, true);
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

    const {
      player,
      solids,
      oneways,
      hazards,
      baddies,
      traps,
      trapBeams,
      projectiles,
      collectibles,
      shields,
      checkpoints,
      puzzleTargets,
      miniBoss,
      worldBoss,
      secretPortal,
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
    this.physics.add.overlap(player, traps, () => this.killPlayer('hazard'));
    this.physics.add.overlap(player, trapBeams, () => this.killPlayer('hazard'));
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
    if (secretPortal) {
      for (const actor of this.players) {
        this.physics.add.overlap(actor, secretPortal, () => this.enterSecretPortal(secretPortal));
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
    this.physics.add.collider(player, this.flak, (objectA, objectB) => {
      this.onFlakBump(objectA, objectB);
    });
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
    this.physics.add.overlap(player, this.coins, (objectA, objectB) => {
      const coin = coinFromCollider(objectA) ?? coinFromCollider(objectB);
      if (coin) {
        this.collectCoin(coin);
      }
    });

    for (const coopPlayer of this.players.slice(1)) {
      this.bindAdditionalPlayerPhysics(coopPlayer);
    }
    if (this.players.length === 2) {
      this.physics.add.collider(this.players[0], this.players[1], () => this.onPlayersCollide());
    }

    this.cameraTarget = this.add.zone(player.x, player.y, 2, 2);
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
      this.stopTransport?.();
      this.stopTransport = undefined;
    });
  }

  update(): void {
    if (!this.paused && !this.controlsHintOpen) {
      this.cullFlak();
      if (this.isAuthority) {
        for (const player of this.livingPlayers()) {
          this.tryActivateCheckpoints(player);
        }
      }
    }
    if ((this.paused && !this.coop) || this.completing || this.controlsHintOpen) {
      return;
    }

    const def = getLevel(this.levelId);
    const input = this.paused ? EMPTY_INPUT : this.readInput();
    const { baddies, miniBoss, worldBoss } = this.built;

    this.refreshNoJumpZone(this.localPlayer);
    this.localPlayer.tick(input, def.theme);
    if (this.coop?.role === 'guest') {
      if (this.time.now >= this.lastInputSentAt + 33 || input.jumpJust || input.downJust || input.specialJust) {
        this.lastInputSentAt = this.time.now;
        this.coop.transport.send({ type: 'input', sequence: ++this.networkSequence, input });
      }
    } else if (this.remotePlayer && this.playerAlive.get(this.remotePlayer)) {
      this.refreshNoJumpZone(this.remotePlayer);
      this.remotePlayer.tick(this.remoteInput, def.theme);
      const remoteSpecialDirection = this.remotePlayer.flipX ? -1 : 1;
      if (
        this.remoteInput.specialJust &&
        this.special.activate(this.remotePlayer, remoteSpecialDirection)
      ) {
        audio.play(this, 'special');
        this.coop?.transport.send({
          type: 'special',
          playerId: String(this.remotePlayer.getData('playerId') ?? ''),
          direction: remoteSpecialDirection,
        });
      }
      this.remoteInput = {
        ...this.remoteInput,
        jumpJust: false,
        downJust: false,
        specialJust: false,
      };
    }
    const localSpecialDirection = this.localPlayer.flipX ? -1 : 1;
    if (input.specialJust && this.isAuthority && this.special.activate(this.localPlayer, localSpecialDirection)) {
      audio.play(this, 'special');
      this.coop?.transport.send({
        type: 'special',
        playerId: String(this.localPlayer.getData('playerId') ?? ''),
        direction: localSpecialDirection,
      });
    }
    if (this.isAuthority) {
      this.tryActivateCheckpoints(this.localPlayer);
    }

    if (
      !this.threatsLive &&
      (input.left || input.right || this.remoteInput.left || this.remoteInput.right)
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

    if (this.isAuthority) {
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

  private get isAuthority(): boolean {
    return !this.coop || this.coop.role === 'host';
  }

  private livingPlayers(): Player[] {
    return this.players.filter((player) => player.active && this.playerAlive.get(player) !== false);
  }

  private closestLivingPlayer(x: number): Player | undefined {
    const target = selectMultiplayerTarget(
      { x, y: 0 },
      this.players.map((player, index) => ({
        id: index === 0 ? 'host' as const : 'guest' as const,
        x: player.x,
        y: player.y,
        targetable: this.playerAlive.get(player) !== false,
      })),
    );
    return target ? this.players[target.id === 'host' ? 0 : 1] : undefined;
  }

  private playerPose(player: Player): PlayerPose {
    return {
      x: player.x,
      y: player.y,
      velocityX: player.arcadeBody.velocity.x,
      velocityY: player.arcadeBody.velocity.y,
      flipX: player.flipX,
      alive: this.playerAlive.get(player) !== false,
    };
  }

  private bossPose(boss: Boss): BossPose {
    return {
      x: boss.x,
      y: boss.y,
      velocityX: boss.arcadeBody.velocity.x,
      velocityY: boss.arcadeBody.velocity.y,
      hp: boss.hp,
      engaged: boss.engaged,
      active: boss.active && !boss.dying,
    };
  }

  private broadcastSnapshot(): void {
    if (this.coop?.role !== 'host' || this.players.length !== 2 || this.time.now < this.lastSnapshotAt + 50) {
      return;
    }
    const host = this.players[0];
    const guest = this.players[1];
    if (!host || !guest) {
      return;
    }
    this.lastSnapshotAt = this.time.now;
    const boss = this.built.worldBoss ?? this.built.miniBoss;
    this.coop.transport.send({
      type: 'snapshot',
      sequence: ++this.networkSequence,
      host: this.playerPose(host),
      guest: this.playerPose(guest),
      lives: session.lives,
      boss: boss ? this.bossPose(boss) : undefined,
    });
  }

  private applyRemotePose(player: Player, pose: PlayerPose, reconcile: boolean): void {
    if (!pose.alive) {
      if (this.playerAlive.get(player) !== false) {
        this.playerAlive.set(player, false);
        player.enterSpectating();
      }
      return;
    }
    if (this.playerAlive.get(player) === false) {
      this.playerAlive.set(player, true);
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

  private onRuntimeMessage(message: RuntimeMessage): void {
    if (!this.coop) {
      return;
    }
    switch (message.type) {
      case 'input':
        if (this.coop.role === 'host') {
          this.remoteInput = message.input;
        }
        return;
      case 'snapshot': {
        if (this.coop.role !== 'guest') {
          return;
        }
        const host = this.players[0];
        const guest = this.players[1];
        if (host && guest) {
          this.applyRemotePose(host, message.host, false);
          this.applyRemotePose(guest, message.guest, true);
          session.lives = message.lives;
          const boss = this.built.worldBoss ?? this.built.miniBoss;
          if (boss && message.boss) {
            boss.setPosition(message.boss.x, message.boss.y);
            boss.arcadeBody.setVelocity(message.boss.velocityX, message.boss.velocityY);
            boss.hp = message.boss.hp;
            boss.engaged = message.boss.engaged;
            if (!message.boss.active && boss.active) {
              boss.poofAway();
            }
          }
        }
        return;
      }
      case 'checkpoint':
        setCheckpoint(this.levelId, message.x, message.y);
        this.reviveSpectators(message.x, message.y, false);
        return;
      case 'player-impact': {
        const first = this.players[0];
        const second = this.players[1];
        if (!first || !second) {
          return;
        }
        first.playTeammateImpact(message.kind);
        second.playTeammateImpact(message.kind);
        audio.play(this, message.kind === 'head' ? 'teammate-stomp' : 'teammate-bump');
        return;
      }
      case 'player-died': {
        const player = this.players.find((candidate) => candidate.getData('playerId') === message.playerId);
        if (player && this.playerAlive.get(player) !== false) {
          this.playerAlive.set(player, false);
          player.die(() => player.enterSpectating());
        }
        return;
      }
      case 'special': {
        if (this.coop.role === 'guest') {
          const player = this.players.find((candidate) => candidate.getData('playerId') === message.playerId);
          if (player && this.special.activate(player, message.direction)) {
            audio.play(this, 'special');
          }
        }
        return;
      }
      case 'reward':
        if (this.appliedRewardEvents.has(message.eventId)) {
          return;
        }
        this.appliedRewardEvents.add(message.eventId);
        if (message.reward === 'coin') {
          this.syncHudCoins(addCoins(1).coins);
        } else if (typeof message.index === 'number') {
          collectStar(this.levelId, message.index);
          for (const child of this.built.collectibles.getChildren()) {
            if (Number((child as Phaser.GameObjects.GameObject).getData('index')) === message.index) {
              child.destroy();
            }
          }
        }
        return;
      case 'team-restart':
        this.coop.levelId = message.levelId;
        this.scene.restart({ levelId: message.levelId, skipControlsHint: true, fromDeath: true, coop: true });
        return;
      case 'level-complete':
        if (this.coop.role === 'guest' && message.levelId === this.levelId && !this.completing) {
          this.completing = true;
          markCleared(this.levelId);
          this.showCompleteMenu('CO-OP CLEAR!');
        }
        return;
      case 'leave':
        if (!this.completing) {
          this.completing = true;
          const returningToLobby = message.reason === 'team-game-over' || message.reason === 'return-to-lobby';
          this.showBanner(returningToLobby ? 'RETURNING TO LOBBY' : 'TEAMMATE LEFT', () => {
            clearActiveCoopSession('peer-left');
            this.scene.start(returningToLobby ? 'CoopScene' : 'TitleScene');
          });
        }
        return;
      default: {
        const neverMessage: never = message;
        return neverMessage;
      }
    }
  }

  private updateCoopCamera(): void {
    const target = this.cameraTarget;
    if (!target) {
      return;
    }
    const goal = sharedCameraGoal(
      this.players.map((player, index) => ({
        id: index === 0 ? 'host' as const : 'guest' as const,
        x: player.x,
        y: player.y,
        velocityX: player.arcadeBody.velocity.x,
        velocityY: player.arcadeBody.velocity.y,
        active: this.playerAlive.get(player) !== false,
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
    if (this.isAuthority && living.length === 2 && Math.abs(living[0]!.x - living[1]!.x) > 900) {
      const left = living[0]!.x < living[1]!.x ? living[0]! : living[1]!;
      const right = left === living[0] ? living[1]! : living[0]!;
      left.arcadeBody.setVelocityX(Math.max(left.arcadeBody.velocity.x, 80));
      right.arcadeBody.setVelocityX(Math.min(right.arcadeBody.velocity.x, -80));
    }
    const spectating = this.playerAlive.get(this.localPlayer) === false;
    this.hudSpectating?.setVisible(spectating);
    if (spectating) {
      this.hudSpectating?.setText(`SPECTATING ${this.coop?.remoteName.toUpperCase() ?? 'TEAMMATE'}`);
    }
  }

  private bindAdditionalPlayerPhysics(player: Player): void {
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
      if (this.isAuthority) {
        this.onBaddieCollide(objectA as Player, objectB as Baddie);
      }
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
      if (!this.isAuthority) {
        return;
      }
      const projectile = objectA instanceof EnemyProjectile ? objectA : objectB instanceof EnemyProjectile ? objectB : undefined;
      if (projectile && !projectile.neutralized) {
        projectile.destroy();
        this.killPlayer('baddie', player);
      }
    });
    this.physics.add.overlap(player, this.built.collectibles, (objectA, objectB) => {
      if (!this.isAuthority) {
        return;
      }
      const pickup = objectA === player ? objectB : objectA;
      if ('getData' in pickup) {
        this.collectPickup(pickup as Phaser.Physics.Arcade.Sprite);
      }
    });
    this.physics.add.overlap(player, this.built.shields, (objectA, objectB) => {
      if (!this.isAuthority) {
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
      if (!this.isAuthority) {
        return;
      }
      const checkpoint = objectA === player ? objectB : objectA;
      if ('getData' in checkpoint) {
        this.activateCheckpoint(checkpoint as Phaser.Physics.Arcade.Sprite);
      }
    });
    this.physics.add.collider(player, this.flak, (objectA, objectB) => this.onFlakBump(objectA, objectB));
    this.physics.add.overlap(player, this.coins, (objectA, objectB) => {
      if (!this.isAuthority) {
        return;
      }
      const coin = coinFromCollider(objectA) ?? coinFromCollider(objectB);
      if (coin) {
        this.collectCoin(coin);
      }
    });
  }

  private onPlayersCollide(): void {
    if (
      !this.isAuthority ||
      this.players.length !== 2 ||
      !isPlayerCollisionReady(this.collisionCooldowns, 'host', 'guest', this.time.now)
    ) {
      return;
    }
    const first = this.players[0];
    const second = this.players[1];
    if (!first || !second || !this.playerAlive.get(first) || !this.playerAlive.get(second)) {
      return;
    }
    const collision = classifyPlayerCollision(
      {
        id: 'host',
        x: first.x,
        y: first.y,
        width: first.arcadeBody.width,
        height: first.arcadeBody.height,
        velocityX: first.arcadeBody.velocity.x,
        velocityY: first.arcadeBody.velocity.y,
      },
      {
        id: 'guest',
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
      'host',
      'guest',
      this.time.now,
      playerCollisionCooldownMs(collision.kind),
    );
    if (collision.kind === 'none' || collision.kind === 'separate') {
      return;
    }
    if (collision.kind === 'host-stomps-guest' || collision.kind === 'guest-stomps-host') {
      const upper = collision.kind === 'host-stomps-guest' ? first : second;
      const lower = upper === first ? second : first;
      upper.bounce();
      lower.playTeammateImpact('head');
      upper.playTeammateImpact('head');
      audio.play(this, 'teammate-stomp');
      this.coop?.transport.send({
        type: 'player-impact',
        kind: 'head',
        upperPlayerId: String(upper.getData('playerId') ?? ''),
      });
      return;
    }
    const direction = Math.sign(second.x - first.x) || 1;
    first.arcadeBody.setVelocityX(-direction * 190);
    second.arcadeBody.setVelocityX(direction * 190);
    first.playTeammateImpact('side');
    second.playTeammateImpact('side');
    audio.play(this, 'teammate-bump');
    this.coop?.transport.send({ type: 'player-impact', kind: 'side' });
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
    if (!this.isAuthority || !baddie.active || baddie.dying || player.frozen) {
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

  private enterSecretPortal(portal: Phaser.Physics.Arcade.Sprite): void {
    if (!this.isAuthority || this.completing || this.paused || this.controlsHintOpen) {
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
        if (this.coop) {
          this.coop.levelId = target;
          this.coop.transport.send({ type: 'team-restart', levelId: target });
        }
        this.scene.start('PlayScene', {
          levelId: target,
          skipControlsHint: true,
          coop: Boolean(this.coop),
        });
      });
      this.cameras.main.fadeOut(320, 0, 0, 0);
    });
  }

  private canStompBoss(player: Player, boss: Boss): boolean {
    if (!this.isAuthority || !boss.active || boss.dying || player.frozen) {
      return false;
    }
    return isFallingStomp(stompBox(player.arcadeBody), stompBox(boss.arcadeBody));
  }

  private onBossHeadStomp(player: Player, boss: Boss, worldBoss: boolean): void {
    if (!this.isAuthority || !boss.active || boss.dying || player.frozen) {
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
    if (!this.isAuthority || !boss.active || boss.dying || player.frozen) {
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
    this.players.forEach((player) => player.freeze());
    const firstClear = !loadSave().cleared.includes(this.levelId);
    markCleared(this.levelId);
    this.coop?.transport.send({
      type: 'level-complete',
      levelId: this.levelId,
      completionId: `${this.coop.localPlayerId}:${this.levelId}:${Date.now()}`,
    });
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

  private killPlayer(reason: 'pit' | 'hazard' | 'baddie', player = this.built.player): void {
    if (!this.isAuthority || this.completing || player.frozen || this.playerAlive.get(player) === false) {
      return;
    }
    if (reason === 'baddie' && !player.canBeHurt()) {
      return;
    }
    if (reason === 'baddie' && player.consumeShield()) {
      audio.play(this, 'hurt');
      return;
    }
    if (this.coop) {
      this.playerAlive.set(player, false);
      audio.play(this, 'hurt');
      this.coop.transport.send({
        type: 'player-died',
        playerId: String(player.getData('playerId') ?? ''),
      });
      player.die(() => {
        player.enterSpectating();
        if (this.livingPlayers().length === 0) {
          this.restartCoopTeam();
        }
      });
      return;
    }
    this.completing = true;
    this.syncTouchHud();
    session.lives -= 1;
    audio.play(this, 'hurt');
    this.built.player.die(() => {
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

  private restartCoopTeam(): void {
    if (!this.coop || !this.isAuthority || this.completing) {
      return;
    }
    this.completing = true;
    session.lives -= 1;
    if (session.lives <= 0) {
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
    this.coop.transport.send({ type: 'team-restart', levelId: this.levelId });
    this.scene.restart({ levelId: this.levelId, skipControlsHint: true, fromDeath: true, coop: true });
  }

  private reviveSpectators(x: number, y: number, broadcast: boolean): void {
    let revived = false;
    this.players.forEach((player, index) => {
      if (this.playerAlive.get(player) !== false) {
        return;
      }
      this.playerAlive.set(player, true);
      player.reviveAt(x + index * 48, y);
      player.setCoopAccent(index === 1);
      revived = true;
    });
    if (revived) {
      audio.play(this, 'firework-burst');
    }
    if (broadcast && this.coop) {
      this.coop.transport.send({ type: 'checkpoint', x, y });
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
    if (!this.isAuthority || !coin.active || coin.isCollecting) {
      return;
    }
    coin.beginCollect();
    this.syncHudCoins(addCoins(1).coins);
    this.coop?.transport.send({
      type: 'reward',
      reward: 'coin',
      eventId: `${this.levelId}:coin:${this.networkSequence++}`,
    });
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
    if (!this.isAuthority || !pickup.active) {
      return;
    }
    const index = Number(pickup.getData('index'));
    collectStar(this.levelId, index);
    this.coop?.transport.send({
      type: 'reward',
      reward: 'star',
      index,
      eventId: `${this.levelId}:star:${index}`,
    });
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
    if (!this.isAuthority || checkpoint.getData('active') === true) {
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
    setCheckpoint(
      this.levelId,
      Number(checkpoint.getData('spawnX')),
      Number(checkpoint.getData('spawnY')),
    );
    spawnCheckpointFireworks(this, flag);
    this.reviveSpectators(
      Number(checkpoint.getData('spawnX')),
      Number(checkpoint.getData('spawnY')),
      true,
    );
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
      this.coop ? 'CO-OP LOBBY' : 'WORLD MAP',
      () => {
        if (this.coop) {
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
    this.physics.world.isPaused = this.paused && !this.coop;
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
    if (next && (!this.coop || this.coop.role === 'host')) {
      items.push({
        label: 'NEXT LEVEL',
        action: () => {
          if (this.coop) {
            this.coop.levelId = next;
            this.coop.transport.send({ type: 'team-restart', levelId: next });
          }
          this.scene.start('PlayScene', { levelId: next, coop: Boolean(this.coop) });
        },
      });
    }
    if (this.coop) {
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
