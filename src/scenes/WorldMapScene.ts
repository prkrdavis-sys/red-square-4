import Phaser from 'phaser';
import {
  CAMPAIGN_LEVEL_IDS,
  GAME_HEIGHT,
  GAME_WIDTH,
  SECRET_LEVEL_IDS,
  THEMES,
  parseLevelId,
  stageThreeId,
  themeName,
  type LevelId,
} from '../config';
import {
  isUnlocked,
  levelCollectibleCount,
  loadSave,
  resumeLevelId,
  session,
  setLastPlayed,
  worldCollectibleCount,
} from '../data/progress';
import { applySettings } from '../data/settings';
import { getLevel } from '../levels/worlds';
import { audio } from '../systems/audio';
import { hideTouchControls } from '../systems/touch-controls';
import { placeWorldMapArt } from '../systems/world-map-art';
import {
  MAP_HEIGHT,
  MAP_WALK_SPEED,
  MAP_WIDTH,
  dockAt,
  ferryControl,
  islandAt,
  islandPathPairs,
  linkedDock,
  mapFooterTop,
  mapNodePositionForId,
  nearbyNode,
  quadBezier,
  secretStubEnd,
  walkable,
  type DockDef,
} from '../systems/world-map-layout';
import { MapAnalogStick } from '../systems/world-map-stick';
import { addCoinPurse, launchOverlay, MenuButton, shouldAcceptTap, textStyle, UI } from '../ui/menu';

interface NodeView {
  id: LevelId;
  x: number;
  y: number;
  world: number;
  stage: number;
  secret: boolean;
}

export class WorldMapScene extends Phaser.Scene {
  private nodes: NodeView[] = [];
  private token!: Phaser.GameObjects.Container;
  private tokenFace!: Phaser.GameObjects.Image;
  private boatSprite!: Phaser.GameObjects.Image;
  private hint!: Phaser.GameObjects.Text;
  private worldLabel!: Phaser.GameObjects.Text;
  private starLabel!: Phaser.GameObjects.Text;
  private selected: LevelId | undefined;
  private ferrying = false;
  private lastDockKey = '';
  private lastMusicWorld = 0;
  private lastNodeTapAt = Number.NEGATIVE_INFINITY;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys?: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private stick!: MapAnalogStick;
  private ocean?: Phaser.GameObjects.TileSprite;
  private selectionReady = false;

  constructor() {
    super('WorldMapScene');
  }

  create(): void {
    applySettings(this);
    hideTouchControls();
    this.ferrying = false;
    this.cameras.main.setBackgroundColor(0x0a3a68);
    const save = loadSave();
    const visibleIds: LevelId[] = [
      ...CAMPAIGN_LEVEL_IDS,
      ...SECRET_LEVEL_IDS.filter((id) => save.unlocked.includes(id)),
    ];
    this.nodes = visibleIds.map((id) => {
      const parsed = parseLevelId(id);
      const pos = mapNodePositionForId(id);
      return { id, x: pos.x, y: pos.y, world: parsed.world, stage: parsed.stage, secret: parsed.secret };
    });

    const art = placeWorldMapArt(this, save);
    this.ocean = art.ocean;
    this.drawRoads(save);
    this.drawNodes(save);

    const startId = resumeLevelId(save);
    const spawn = mapNodePositionForId(startId);
    this.selected = nearbyNode(spawn.x, spawn.y, visibleIds);
    this.token = this.add.container(spawn.x, spawn.y).setDepth(14);
    const shadow = this.add.ellipse(0, 10, 22, 10, 0x12080a, 0.35);
    this.boatSprite = this.add.image(0, 8, 'map-boat').setVisible(false).setAlpha(0.95);
    this.tokenFace = this.add.image(0, -4, 'map-token').setScale(1.55);
    this.token.add([shadow, this.boatSprite, this.tokenFace]);
    this.tweens.add({
      targets: this.tokenFace,
      y: -8,
      duration: 420,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    this.cameras.main.startFollow(this.token, true, 0.16, 0.16);
    this.cameras.main.setDeadzone(80, 70);
    this.cameras.main.setFollowOffset(0, 40);
    this.cameras.main.setRoundPixels(true);

    this.buildHud(save);
    this.stick = new MapAnalogStick(this);
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.keys = this.input.keyboard?.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key> | undefined;

    this.refreshHint();
    this.playWorldMusic(parseLevelId(startId).world);
    this.syncSelection();
    this.selectionReady = true;

    const unlessPaused = (action: () => void) => () => {
      if (!this.scene.isPaused()) {
        action();
      }
    };
    this.input.keyboard?.on('keydown-ENTER', unlessPaused(() => this.activateHere()));
    this.input.keyboard?.on('keydown-SPACE', unlessPaused(() => this.activateHere()));
    this.input.keyboard?.on('keydown-ESC', unlessPaused(() => this.scene.start('TitleScene')));
  }

  update(_time: number, delta: number): void {
    if (this.scene.isPaused() || this.ferrying || !this.token) {
      return;
    }
    if (this.ocean) {
      this.ocean.tilePositionX = this.cameras.main.scrollX * 0.12;
      this.ocean.tilePositionY = this.cameras.main.scrollY * 0.08;
    }
    const move = this.moveVector();
    const step = MAP_WALK_SPEED * (delta / 1000);
    const nx = this.token.x + move.x * step;
    const ny = this.token.y + move.y * step;
    if (walkable(nx, ny)) {
      this.token.setPosition(nx, ny);
    } else if (walkable(nx, this.token.y)) {
      this.token.x = nx;
    } else if (walkable(this.token.x, ny)) {
      this.token.y = ny;
    }
    if (move.x !== 0) {
      this.tokenFace.setScale(move.x < 0 ? -1.55 : 1.55, 1.55);
    }
    this.syncSelection();
  }

  private drawRoads(save: ReturnType<typeof loadSave>): void {
    const pathGfx = this.add.graphics().setDepth(3);
    const nodeAt = (id: LevelId) => this.nodes.find((node) => node.id === id);
    for (const [fromId, toId] of islandPathPairs()) {
      const a = nodeAt(fromId) ?? { ...mapNodePositionForId(fromId), id: fromId };
      const b = nodeAt(toId) ?? { ...mapNodePositionForId(toId), id: toId };
      pathGfx.lineStyle(10, 0x6b4423, 0.85);
      pathGfx.lineBetween(a.x, a.y, b.x, b.y);
      pathGfx.lineStyle(6, save.cleared.includes(fromId) ? 0xf5d76e : 0x445566, 1);
      pathGfx.lineBetween(a.x, a.y, b.x, b.y);
    }
    for (const secretId of SECRET_LEVEL_IDS) {
      const parsed = parseLevelId(secretId);
        const from = mapNodePositionForId(stageThreeId(parsed.world));
      const unlocked = save.unlocked.includes(secretId);
      if (!unlocked) {
        const stub = secretStubEnd(parsed.world);
        if (!stub) {
          continue;
        }
        pathGfx.lineStyle(5, 0xc8a8ff, 0.95);
        this.strokeDashed(pathGfx, from.x, from.y, stub.x, stub.y, 7, 6);
        continue;
      }
      const dest = nodeAt(secretId);
      if (!dest) {
        continue;
      }
      pathGfx.lineStyle(10, 0x6b4423, 0.85);
      pathGfx.lineBetween(from.x, from.y, dest.x, dest.y);
      pathGfx.lineStyle(6, save.cleared.includes(secretId) ? 0xf5d76e : 0x9b7cff, 1);
      pathGfx.lineBetween(from.x, from.y, dest.x, dest.y);
    }
  }

  private strokeDashed(
    gfx: Phaser.GameObjects.Graphics,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    dash = 8,
    gap = 7,
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1) {
      return;
    }
    const ux = dx / len;
    const uy = dy / len;
    let d = 0;
    while (d < len) {
      const a = d;
      const b = Math.min(len, d + dash);
      gfx.lineBetween(x1 + ux * a, y1 + uy * a, x1 + ux * b, y1 + uy * b);
      d += dash + gap;
    }
  }

  private drawNodes(save: ReturnType<typeof loadSave>): void {
    this.nodes.forEach((node) => {
      const unlocked = isUnlocked(node.id);
      const cleared = save.cleared.includes(node.id);
      const img = this.add.image(node.x, node.y, this.nodeTexture(node, unlocked)).setDepth(10);
      if (cleared && !node.secret && node.stage !== 4) {
        img.setTint(0x9be37a);
      }
      this.add
        .text(node.x, node.y - (node.stage === 4 ? 22 : 0), node.id, {
          ...textStyle('14px', unlocked ? '#222222' : '#888888'),
          strokeThickness: node.secret ? 3 : 0,
          color: node.secret ? '#3a1460' : unlocked ? '#222222' : '#888888',
        })
        .setOrigin(0.5)
        .setDepth(11);
      const stars = levelCollectibleCount(node.id, save);
      const complete = stars === 3;
      const starIcon = this.add.image(node.x - 12, node.y + 26, 'star').setScale(0.22).setDepth(11);
      if (!complete) {
        starIcon.setTint(0x6a7380);
        starIcon.setAlpha(unlocked ? 0.45 : 0.28);
      }
      this.add
        .text(node.x + 2, node.y + 26, `${stars}/3`, {
          ...textStyle('14px', complete ? '#fff4d0' : unlocked ? '#8a93a0' : '#6a7380'),
        })
        .setOrigin(0, 0.5)
        .setDepth(11);
      const hit = this.add.zone(node.x, node.y, 72, 88).setDepth(12);
      hit.setInteractive({ useHandCursor: unlocked });
      hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (pointer.wasTouch) {
          this.onNodeTap(node.id);
        }
      });
      hit.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        if (!pointer.wasTouch) {
          this.onNodeTap(node.id);
        }
      });
    });
  }

  private nodeTexture(node: NodeView, unlocked: boolean): string {
    if (node.secret) {
      return 'map-node-secret';
    }
    if (node.stage === 4) {
      return unlocked ? 'map-node-castle' : 'map-node-castle-locked';
    }
    return unlocked ? 'map-node' : 'map-node-locked';
  }

  private buildHud(save: ReturnType<typeof loadSave>): void {
    const footerTop = mapFooterTop();
    this.add
      .text(GAME_WIDTH / 2, 40, 'WORLD MAP', {
        ...textStyle('32px', '#ffffff'),
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(90);
    this.worldLabel = this.add
      .text(GAME_WIDTH / 2, 72, '', textStyle('18px', '#fff4d0'))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(90);
    this.starLabel = this.add
      .text(GAME_WIDTH / 2, 94, '', textStyle('15px', '#fff4d0'))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(90);
    addCoinPurse(this, GAME_WIDTH - 108, 48, save.coins);

    this.add.rectangle(0, footerTop, GAME_WIDTH, GAME_HEIGHT - footerTop, 0x10161c, 1).setOrigin(0, 0).setScrollFactor(0).setDepth(88);
    this.add
      .rectangle(GAME_WIDTH / 2, footerTop + 1, GAME_WIDTH, 2, UI.panelStroke, 0.8)
      .setScrollFactor(0)
      .setDepth(88);

    this.add
      .text(32, footerTop + 16, `Lives  ${session.lives}`, textStyle('18px'))
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(90);

    this.add
      .text(GAME_WIDTH - 32, footerTop + 16, 'Walk to a course', {
        ...textStyle('18px', UI.muted),
        align: 'right',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(90);

    new MenuButton(
      this,
      130,
      GAME_HEIGHT - 36,
      'MAIN MENU',
      () => {
        if (!this.scene.isPaused()) {
          this.scene.start('TitleScene');
        }
      },
      200,
      44,
    );

    new MenuButton(
      this,
      344,
      GAME_HEIGHT - 36,
      'SKINS',
      () => {
        if (!this.scene.isPaused()) {
          launchOverlay(this, 'SkinsScene');
        }
      },
      200,
      44,
    );

    new MenuButton(
      this,
      GAME_WIDTH - 130,
      GAME_HEIGHT - 36,
      'PLAY',
      () => {
        if (!this.scene.isPaused()) {
          this.activateHere();
        }
      },
      200,
      44,
    );

    this.hint = this.add
      .text(GAME_WIDTH / 2, footerTop + 16, '', {
        ...textStyle('18px', UI.gold),
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(90);
  }

  private moveVector(): Phaser.Math.Vector2 {
    let x = 0;
    let y = 0;
    if (this.cursors?.left.isDown || this.keys?.A.isDown) {
      x -= 1;
    }
    if (this.cursors?.right.isDown || this.keys?.D.isDown) {
      x += 1;
    }
    if (this.cursors?.up.isDown || this.keys?.W.isDown) {
      y -= 1;
    }
    if (this.cursors?.down.isDown || this.keys?.S.isDown) {
      y += 1;
    }
    const stick = this.stick.vector();
    x += stick.x;
    y += stick.y;
    const vec = new Phaser.Math.Vector2(x, y);
    if (vec.length() > 1) {
      vec.normalize();
    }
    return vec;
  }

  private syncSelection(): void {
    const ids = this.nodes.map((node) => node.id);
    const nodeId = nearbyNode(this.token.x, this.token.y, ids);
    const dock = dockAt(this.token.x, this.token.y);
    const dockKey = dock ? `${dock.world}-${dock.kind}` : '';
    if (nodeId !== this.selected || dockKey !== this.lastDockKey) {
      this.selected = nodeId;
      this.lastDockKey = dockKey;
      if (nodeId && isUnlocked(nodeId)) {
        setLastPlayed(nodeId);
        if (this.selectionReady) {
          audio.play(this, 'map');
        }
      }
      this.refreshHint();
    }
    const island = islandAt(this.token.x, this.token.y);
    const world = island?.world ?? this.lastMusicWorld;
    if (world && world !== this.lastMusicWorld) {
      this.playWorldMusic(world);
    }
    if (island) {
      this.worldLabel.setText(`WORLD ${island.world}   ${themeName(island.theme)}`);
      this.starLabel.setText(`STARS ${worldCollectibleCount(loadSave(), island.world)}/12`);
    }
  }

  private playWorldMusic(world: number): void {
    this.lastMusicWorld = world;
    audio.playTheme(this, THEMES[world - 1] ?? 'grass');
  }

  private onNodeTap(id: LevelId): void {
    if (this.scene.isPaused() || this.ferrying) {
      return;
    }
    const now = performance.now();
    if (!shouldAcceptTap(this.lastNodeTapAt, now)) {
      return;
    }
    this.lastNodeTapAt = now;
    const pos = mapNodePositionForId(id);
    if (Math.hypot(pos.x - this.token.x, pos.y - this.token.y) > 80) {
      return;
    }
    this.selected = id;
    this.playSelected();
  }

  private refreshHint(): void {
    const dock = this.token ? dockAt(this.token.x, this.token.y) : undefined;
    if (dock && !this.selected) {
      const dest = linkedDock(dock);
      if (dest) {
        this.hint.setText(`Take the boat to World ${dest.world}`);
        return;
      }
    }
    const node = this.nodes.find((item) => item.id === this.selected);
    if (!node) {
      this.hint.setText('Walk the islands · stand on a course to play');
      return;
    }
    const level = getLevel(node.id);
    const cleared = loadSave().cleared.includes(node.id);
    const parsed = parseLevelId(node.id);
    const boss = parsed.secret ? 'specialty boss' : parsed.stage === 4 ? 'world boss' : 'mini-boss';
    const stars = levelCollectibleCount(node.id);
    const locked = isUnlocked(node.id) ? '' : '   ·   locked';
    const meta = cleared ? `${boss}   ·   cleared` : `${boss}${locked}`;
    this.hint.setText(`${node.id}   ${level.name}\n${meta}   ·   stars ${stars}/3`);
  }

  private activateHere(): void {
    if (this.ferrying || this.scene.isPaused()) {
      return;
    }
    const node = this.nodes.find((item) => item.id === this.selected);
    if (node && isUnlocked(node.id)) {
      this.playSelected();
      return;
    }
    const dock = dockAt(this.token.x, this.token.y);
    if (dock) {
      this.boardBoat(dock);
    }
  }

  private playSelected(): void {
    const node = this.nodes.find((item) => item.id === this.selected);
    if (!node || !isUnlocked(node.id) || this.ferrying) {
      return;
    }
    audio.play(this, 'select');
    this.scene.start('PlayScene', { levelId: node.id });
  }

  private boardBoat(dock: DockDef): void {
    const dest = linkedDock(dock);
    if (!dest) {
      return;
    }
    this.ferrying = true;
    this.boatSprite.setVisible(true);
    audio.play(this, 'map');
    const from = { x: this.token.x, y: this.token.y };
    const to = { x: dest.x, y: dest.y };
    const control = ferryControl(from, dest);
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: Math.min(1600, Math.max(700, dist * 0.55)),
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const point = quadBezier(from, control, to, tween.progress);
        this.token.setPosition(point.x, point.y);
      },
      onComplete: () => {
        this.token.setPosition(dest.x, dest.y);
        this.boatSprite.setVisible(false);
        this.ferrying = false;
        this.selected = undefined;
        this.syncSelection();
        this.refreshHint();
      },
    });
  }
}
