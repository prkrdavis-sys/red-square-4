import Phaser from 'phaser';
import {
  CAMPAIGN_LEVEL_IDS,
  GAME_HEIGHT,
  GAME_WIDTH,
  SECRET_LEVEL_IDS,
  THEMES,
  parseLevelId,
  secretLevelId,
  stageThreeId,
  themeName,
  themeSky,
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
import {
  MAP_SECRET_STUB_LENGTH,
  campaignPathPairs,
  mapFooterTop,
  mapNodePositionForId,
  worldBandWidth,
} from '../systems/world-map-layout';
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
  private cursor = 0;
  private token!: Phaser.GameObjects.Container;
  private hint!: Phaser.GameObjects.Text;
  private moving = false;
  private lastNodeTapAt = Number.NEGATIVE_INFINITY;

  constructor() {
    super('WorldMapScene');
  }

  create(): void {
    applySettings(this);
    this.cameras.main.setBackgroundColor(0x15202b);
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

    const footerTop = mapFooterTop();
    const band = worldBandWidth();
    for (let world = 1; world <= THEMES.length; world += 1) {
      const theme = THEMES[world - 1] ?? 'grass';
      const x = (world - 1) * band;
      this.add.rectangle(x + 2, 120, band - 4, footerTop - 128, themeSky(theme), 0.55).setOrigin(0, 0);
      this.add
        .text(x + band / 2, 148, `WORLD ${world}`, {
          ...textStyle('16px', '#ffffff'),
          stroke: '#000000',
        })
        .setOrigin(0.5);
      this.add.text(x + band / 2, 174, themeName(theme), textStyle('16px', '#fff4d0')).setOrigin(0.5);
      this.add
        .text(x + band / 2, 198, `STARS ${worldCollectibleCount(save, world)}/12`, textStyle('15px', '#fff4d0'))
        .setOrigin(0.5);
    }

    const pathGfx = this.add.graphics();
    const nodeAt = (id: LevelId) => this.nodes.find((node) => node.id === id);
    for (const [fromId, toId] of campaignPathPairs()) {
      const a = nodeAt(fromId);
      const b = nodeAt(toId);
      if (!a || !b) {
        continue;
      }
      const cleared = save.cleared.includes(a.id);
      pathGfx.lineStyle(6, cleared ? 0xf5d76e : 0x445566, 1);
      pathGfx.lineBetween(a.x, a.y, b.x, b.y);
    }
    for (const secretId of SECRET_LEVEL_IDS) {
      const parsed = parseLevelId(secretId);
      const from = nodeAt(stageThreeId(parsed.world));
      if (!from) {
        continue;
      }
      const unlocked = save.unlocked.includes(secretId);
      if (!unlocked) {
        pathGfx.lineStyle(4, 0x445566, 0.55);
        pathGfx.lineBetween(from.x, from.y, from.x, from.y + MAP_SECRET_STUB_LENGTH);
        continue;
      }
      const dest = nodeAt(secretId);
      if (!dest) {
        continue;
      }
      pathGfx.lineStyle(6, save.cleared.includes(from.id) ? 0xf5d76e : 0x445566, 1);
      pathGfx.lineBetween(from.x, from.y, dest.x, dest.y);
    }

    this.nodes.forEach((node, index) => {
      const unlocked = isUnlocked(node.id);
      const cleared = save.cleared.includes(node.id);
      const img = this.add.image(node.x, node.y, unlocked ? 'map-node' : 'map-node-locked');
      if (cleared) {
        img.setTint(0x9be37a);
      }
      this.add
        .text(node.x, node.y, node.id, {
          ...textStyle('14px', unlocked ? '#222222' : '#888888'),
          strokeThickness: 0,
        })
        .setOrigin(0.5);
      const stars = levelCollectibleCount(node.id, save);
      const complete = stars === 3;
      const starIcon = this.add.image(node.x - 12, node.y + 26, 'star').setScale(0.22);
      if (!complete) {
        starIcon.setTint(0x6a7380);
        starIcon.setAlpha(unlocked ? 0.45 : 0.28);
      }
      this.add
        .text(node.x + 2, node.y + 26, `${stars}/3`, {
          ...textStyle('14px', complete ? '#fff4d0' : unlocked ? '#8a93a0' : '#6a7380'),
        })
        .setOrigin(0, 0.5);
      if (unlocked) {
        const hit = this.add.zone(node.x, node.y, Math.min(88, band * 0.34), 88);
        hit.setInteractive({ useHandCursor: true });
        hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          if (pointer.wasTouch) {
            this.onNodeTap(index);
          }
        });
        hit.on('pointerup', (pointer: Phaser.Input.Pointer) => {
          if (!pointer.wasTouch) {
            this.onNodeTap(index);
          }
        });
      }
    });

    const startId = resumeLevelId(save);
    this.cursor = Math.max(0, this.nodes.findIndex((n) => n.id === startId));
    const here = this.nodes[this.cursor];
    this.token = this.add.container(here?.x ?? 120, (here?.y ?? 250) - 32).setDepth(10);
    const tokenFace = this.add.image(0, 0, 'map-token');
    this.token.add(tokenFace);
    this.tweens.add({
      targets: tokenFace,
      y: -6,
      duration: 420,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add
      .text(GAME_WIDTH / 2, 56, 'WORLD MAP', {
        ...textStyle('40px', '#ffffff'),
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    addCoinPurse(this, GAME_WIDTH - 108, 56, save.coins);

    this.add.rectangle(0, footerTop, GAME_WIDTH, GAME_HEIGHT - footerTop, 0x10161c, 1).setOrigin(0, 0);
    this.add.rectangle(GAME_WIDTH / 2, footerTop + 1, GAME_WIDTH, 2, UI.panelStroke, 0.8);

    this.add
      .text(32, footerTop + 16, `Lives  ${session.lives}`, textStyle('18px'))
      .setOrigin(0, 0);

    this.add
      .text(GAME_WIDTH - 32, footerTop + 16, 'Tap a course', {
        ...textStyle('18px', UI.muted),
        align: 'right',
      })
      .setOrigin(1, 0);

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
          this.playSelected();
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
      .setOrigin(0.5, 0);

    this.refreshHint();
    this.playWorldMusic(here?.world ?? 1);

    const unlessPaused = (action: () => void) => () => {
      if (!this.scene.isPaused()) {
        action();
      }
    };
    this.input.keyboard?.on('keydown-LEFT', unlessPaused(() => this.moveHorizontal(-1)));
    this.input.keyboard?.on('keydown-RIGHT', unlessPaused(() => this.moveHorizontal(1)));
    this.input.keyboard?.on('keydown-UP', unlessPaused(() => this.moveVertical(-1)));
    this.input.keyboard?.on('keydown-DOWN', unlessPaused(() => this.moveVertical(1)));
    this.input.keyboard?.on('keydown-A', unlessPaused(() => this.moveHorizontal(-1)));
    this.input.keyboard?.on('keydown-D', unlessPaused(() => this.moveHorizontal(1)));
    this.input.keyboard?.on('keydown-W', unlessPaused(() => this.moveVertical(-1)));
    this.input.keyboard?.on('keydown-S', unlessPaused(() => this.moveVertical(1)));
    this.input.keyboard?.on('keydown-ENTER', unlessPaused(() => this.playSelected()));
    this.input.keyboard?.on('keydown-SPACE', unlessPaused(() => this.playSelected()));
    this.input.keyboard?.on('keydown-ESC', unlessPaused(() => this.scene.start('TitleScene')));
  }

  private moveHorizontal(dir: number): void {
    const current = this.nodes[this.cursor];
    if (!current) {
      return;
    }
    const parsed = parseLevelId(current.id);
    const fromId = parsed.secret ? stageThreeId(parsed.world) : current.id;
    let index = CAMPAIGN_LEVEL_IDS.indexOf(fromId as (typeof CAMPAIGN_LEVEL_IDS)[number]) + dir;
    while (index >= 0 && index < CAMPAIGN_LEVEL_IDS.length) {
      const id = CAMPAIGN_LEVEL_IDS[index];
      if (id && isUnlocked(id)) {
        const next = this.nodes.findIndex((node) => node.id === id);
        if (next >= 0) {
          this.selectNode(next);
        }
        return;
      }
      index += dir;
    }
  }

  private moveVertical(dir: number): void {
    const current = this.nodes[this.cursor];
    if (!current) {
      return;
    }
    const parsed = parseLevelId(current.id);
    if (dir > 0 && !parsed.secret && parsed.stage === 3) {
      const secret = secretLevelId(parsed.world);
      const next = this.nodes.findIndex((node) => node.id === secret);
      if (next >= 0 && isUnlocked(secret)) {
        this.selectNode(next);
        return;
      }
    }
    if (dir < 0 && parsed.secret) {
      const stageThree = stageThreeId(parsed.world);
      const next = this.nodes.findIndex((node) => node.id === stageThree);
      if (next >= 0) {
        this.selectNode(next);
      }
    }
  }

  private selectNode(index: number): void {
    if (this.moving || this.scene.isPaused()) {
      return;
    }
    const node = this.nodes[index];
    if (!node || !isUnlocked(node.id) || index === this.cursor) {
      return;
    }
    this.cursor = index;
    setLastPlayed(node.id);
    audio.play(this, 'map');
    this.playWorldMusic(node.world);
    this.moving = true;
    this.tweens.add({
      targets: this.token,
      x: node.x,
      y: node.y - 32,
      duration: 180,
      onComplete: () => {
        this.moving = false;
      },
    });
    this.refreshHint();
  }

  private playWorldMusic(world: number): void {
    audio.playTheme(this, THEMES[world - 1] ?? 'grass');
  }

  private onNodeTap(index: number): void {
    if (this.scene.isPaused()) {
      return;
    }
    const now = performance.now();
    if (!shouldAcceptTap(this.lastNodeTapAt, now)) {
      return;
    }
    this.lastNodeTapAt = now;
    if (index === this.cursor) {
      this.playSelected();
      return;
    }
    this.selectNode(index);
  }

  private refreshHint(): void {
    const node = this.nodes[this.cursor];
    if (!node) {
      return;
    }
    const level = getLevel(node.id);
    const cleared = loadSave().cleared.includes(node.id);
    const parsed = parseLevelId(node.id);
    const boss = parsed.secret ? 'specialty boss' : parsed.stage === 4 ? 'world boss' : 'mini-boss';
    const stars = levelCollectibleCount(node.id);
    const meta = cleared ? `${boss}   ·   cleared` : boss;
    this.hint.setText(`${node.id}   ${level.name}\n${meta}   ·   stars ${stars}/3`);
  }

  private playSelected(): void {
    const node = this.nodes[this.cursor];
    if (!node || !isUnlocked(node.id) || this.moving) {
      return;
    }
    audio.play(this, 'select');
    this.scene.start('PlayScene', { levelId: node.id });
  }
}
