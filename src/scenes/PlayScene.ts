import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, START_LIVES, type LevelId, themeSky } from '../config';
import { markCleared, nextLevelId, resetSessionLives, session, setLastPlayed } from '../data/progress';
import { applySettings, maybeShake } from '../data/settings';
import { Baddie } from '../entities/Baddie';
import { Boss } from '../entities/Boss';
import { Player, type PlayerInput } from '../entities/Player';
import { buildLevel, type BuiltLevel } from '../levels/builder';
import { getLevel } from '../levels/worlds';
import { audio } from '../systems/audio';
import { Parallax } from '../systems/parallax';
import { getTouchState, hideTouchControls, showTouchControls } from '../systems/touch-controls';
import { showBossFightBanner } from '../ui/boss-fight';
import { addPanel, launchOverlay, MenuButton, MenuNav, textStyle } from '../ui/menu';

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
  private paused = false;
  private completing = false;
  private hudLives!: Phaser.GameObjects.Text;
  private hudLifeIcons: Phaser.GameObjects.Image[] = [];
  private hudBoss!: Phaser.GameObjects.Text;
  private pauseOverlay!: Phaser.GameObjects.Container;
  private pauseNav!: MenuNav;
  private wasJump = false;
  private wasDown = false;
  private fightEngaged = false;

  constructor() {
    super('PlayScene');
  }

  init(data: PlayData): void {
    this.levelId = data.levelId ?? '1-1';
    this.paused = false;
    this.completing = false;
    this.wasJump = false;
    this.wasDown = false;
    this.fightEngaged = false;
  }

  create(): void {
    applySettings(this);
    setLastPlayed(this.levelId);
    const def = getLevel(this.levelId);
    this.cameras.main.setBackgroundColor(themeSky(def.theme));
    this.built = buildLevel(this, def.rows, def.theme, def.world);
    this.parallax = new Parallax(this, def.theme);

    this.physics.world.setBounds(0, 0, this.built.widthPx, this.built.heightPx + 400);
    this.physics.world.TILE_BIAS = 40;

    const { player, solids, oneways, hazards, baddies, miniBoss, worldBoss, bossFences } = this.built;

    this.physics.add.collider(player, solids);
    this.physics.add.collider(baddies, solids);
    this.physics.add.collider(baddies, oneways);
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
      this.physics.add.collider(player, miniBoss, () => this.onBossCollide(player, miniBoss, false));
    }
    if (worldBoss) {
      this.physics.add.collider(player, worldBoss, () => this.onBossCollide(player, worldBoss, true));
    }

    this.physics.add.overlap(player, hazards, () => this.killPlayer('hazard'));

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

    this.createHud(def.name);
    this.createPauseOverlay();
    this.bindKeys();
    showTouchControls();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      hideTouchControls();
    });
  }

  update(): void {
    if (this.paused || this.completing) {
      return;
    }

    const def = getLevel(this.levelId);
    const input = this.readInput();
    const { player, baddies, miniBoss, worldBoss } = this.built;

    player.tick(input, def.theme);

    for (const child of baddies.getChildren()) {
      (child as Baddie).patrol(this.built.solids, this.built.oneways);
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
    const boss = worldBoss?.active ? worldBoss : miniBoss?.active ? miniBoss : undefined;
    if (boss && !boss.dying && boss.engaged) {
      this.hudBoss.setText(`Boss  ${'♥'.repeat(boss.hp)}${'·'.repeat(Math.max(0, boss.maxHp - boss.hp))}`);
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
    const jumpJust = jump && !this.wasJump;
    const downJust = down && !this.wasDown;
    if (downJust && (this.built.player.arcadeBody.blocked.down || this.built.player.arcadeBody.touching.down)) {
      audio.play(this, 'drop');
    }
    this.wasJump = jump;
    this.wasDown = down;
    return { left, right, jump, jumpJust, down, downJust };
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

  private onBaddieCollide(player: Player, baddie: Baddie): void {
    if (!baddie.active || baddie.dying || player.frozen) {
      return;
    }
    const pb = player.arcadeBody;
    const bb = baddie.arcadeBody;
    if (bb.touching.up && pb.touching.down && pb.velocity.y >= 0) {
      baddie.squash();
      player.bounce();
      audio.play(this, 'stomp');
      return;
    }
    this.killPlayer('baddie');
  }

  private onBossCollide(player: Player, boss: Boss, worldBoss: boolean): void {
    if (!boss.active || boss.dying || player.frozen) {
      return;
    }
    const pb = player.arcadeBody;
    const bb = boss.arcadeBody;
    const stomped = bb.touching.up && pb.touching.down && pb.velocity.y >= 0;
    if (stomped) {
      const result = boss.takeStomp();
      if (result === 'ignored') {
        player.bounce();
        return;
      }
      player.bounce();
      audio.play(this, 'stomp');
      if (result === 'dead') {
        this.defeatBoss(boss, worldBoss);
      }
      return;
    }
    if (!boss.isInvulnerable) {
      this.killPlayer('baddie');
    }
  }

  private defeatBoss(boss: Boss, worldBoss: boolean): void {
    this.completing = true;
    this.built.player.freeze();
    markCleared(this.levelId);
    audio.play(this, 'poof');
    const def = getLevel(this.levelId);
    const message = worldBoss ? `WORLD ${def.world} CLEARED!` : `${this.levelId}  CLEAR!`;
    boss.poofAway();
    this.time.delayedCall(500, () => {
      audio.play(this, 'victory');
      this.showCompleteMenu(message);
    });
  }

  private killPlayer(reason: 'pit' | 'hazard' | 'baddie'): void {
    if (this.completing || this.built.player.frozen) {
      return;
    }
    if (reason === 'baddie' && !this.built.player.canBeHurt()) {
      return;
    }
    this.completing = true;
    this.built.player.freeze();
    audio.play(this, 'hurt');
    maybeShake(this, 160, 0.006);
    session.lives -= 1;
    this.time.delayedCall(500, () => {
      if (session.lives <= 0) {
        this.showBanner('GAME OVER', () => {
          resetSessionLives();
          this.scene.start('WorldMapScene');
        });
        return;
      }
      this.scene.restart({ levelId: this.levelId });
    });
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
    const pauseHint = this.add
      .text(GAME_WIDTH - 24, 52, 'II  PAUSE', textStyle('16px'))
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(50)
      .setInteractive({ useHandCursor: true });
    pauseHint.on('pointerup', () => this.togglePause());
  }

  private createPauseOverlay(): void {
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5);
    const panel = addPanel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 520, 420, 'PAUSED');
    this.pauseOverlay = this.add.container(0, 0, [dim, panel]).setScrollFactor(0).setDepth(80).setVisible(false);

    const resume = new MenuButton(this, GAME_WIDTH / 2, 300, 'RESUME', () => this.togglePause());
    const settings = new MenuButton(this, GAME_WIDTH / 2, 364, 'SETTINGS', () => launchOverlay(this, 'SettingsScene'));
    const map = new MenuButton(this, GAME_WIDTH / 2, 428, 'WORLD MAP', () => this.scene.start('WorldMapScene'));
    const title = new MenuButton(this, GAME_WIDTH / 2, 492, 'TITLE', () => this.scene.start('TitleScene'));
    resume.setDepth(85);
    settings.setDepth(85);
    map.setDepth(85);
    title.setDepth(85);
    this.pauseNav = new MenuNav(this, [resume, settings, map, title], () => this.togglePause());
    this.pauseNav.setEnabled(false);
  }

  private togglePause(): void {
    if (this.completing || this.scene.isPaused()) {
      return;
    }
    this.paused = !this.paused;
    this.pauseOverlay.setVisible(this.paused);
    this.pauseNav.setEnabled(this.paused);
    this.physics.world.isPaused = this.paused;
  }

  private showCompleteMenu(title: string): void {
    this.pauseOverlay.setVisible(false);
    this.pauseNav.setEnabled(false);
    this.physics.world.isPaused = true;

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
      { label: 'TITLE', action: () => this.scene.start('TitleScene') },
    );

    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5);
    const panelHeight = 176 + items.length * 64;
    const panel = addPanel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 560, panelHeight, title);
    this.add.container(0, 0, [dim, panel]).setScrollFactor(0).setDepth(80);

    const startY = GAME_HEIGHT / 2 - panelHeight / 2 + 108;
    const buttons = items.map((item, index) => {
      const button = new MenuButton(this, GAME_WIDTH / 2, startY + index * 64, item.label, item.action);
      button.setDepth(85);
      return button;
    });
    new MenuNav(this, buttons, () => this.scene.start('WorldMapScene'));
  }

  private showBanner(text: string, onDone: () => void): void {
    this.pauseNav.setEnabled(false);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.45).setScrollFactor(0).setDepth(80);
    addPanel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 560, 280, text);
    const cont = new MenuButton(this, GAME_WIDTH / 2, 430, 'CONTINUE', onDone);
    cont.setDepth(90);
    new MenuNav(this, [cont], onDone);
  }
}
