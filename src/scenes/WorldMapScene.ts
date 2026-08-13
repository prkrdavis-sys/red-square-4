import Phaser from 'phaser';
import { ALL_LEVEL_IDS, GAME_HEIGHT, GAME_WIDTH, themeName, themeSky, type LevelId, type Theme } from '../config';
import { isUnlocked, loadSave, resumeLevelId, session, setLastPlayed } from '../data/progress';
import { applySettings } from '../data/settings';
import { getLevel } from '../levels/worlds';
import { audio } from '../systems/audio';
import { MenuButton, textStyle } from '../ui/menu';

interface NodeView {
  id: LevelId;
  x: number;
  y: number;
  world: number;
  stage: number;
}

function nodePosition(world: number, stage: number): { x: number; y: number } {
  const band = 70 + (world - 1) * 242;
  const col = stage === 1 || stage === 4 ? 0 : 1;
  const row = stage <= 2 ? 0 : 1;
  return {
    x: band + 56 + col * 118,
    y: 250 + row * 170,
  };
}

const WORLD_THEMES: Theme[] = ['grass', 'snow', 'desert', 'ocean', 'castle'];

export class WorldMapScene extends Phaser.Scene {
  private nodes: NodeView[] = [];
  private cursor = 0;
  private token!: Phaser.GameObjects.Container;
  private hint!: Phaser.GameObjects.Text;
  private moving = false;

  constructor() {
    super('WorldMapScene');
  }

  create(): void {
    applySettings(this);
    this.cameras.main.setBackgroundColor(0x15202b);
    this.nodes = ALL_LEVEL_IDS.map((id) => {
      const level = getLevel(id);
      const pos = nodePosition(level.world, level.stage);
      return { id, x: pos.x, y: pos.y, world: level.world, stage: level.stage };
    });

    for (let world = 1; world <= 5; world += 1) {
      const theme = WORLD_THEMES[world - 1] ?? 'grass';
      const x = 48 + (world - 1) * 242;
      this.add.rectangle(x, 120, 230, 520, themeSky(theme), 0.55).setOrigin(0, 0);
      this.add
        .text(x + 115, 148, `WORLD ${world}`, {
          fontFamily: 'Courier New, monospace',
          fontSize: '18px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 4,
        })
        .setOrigin(0.5);
      this.add
        .text(x + 115, 174, themeName(theme), {
          fontFamily: 'Courier New, monospace',
          fontSize: '13px',
          color: '#fff4d0',
        })
        .setOrigin(0.5);
    }

    const save = loadSave();
    const pathGfx = this.add.graphics();
    for (let i = 0; i < this.nodes.length - 1; i += 1) {
      const a = this.nodes[i];
      const b = this.nodes[i + 1];
      if (!a || !b) {
        continue;
      }
      const cleared = save.cleared.includes(a.id);
      pathGfx.lineStyle(6, cleared ? 0xf5d76e : 0x445566, 1);
      pathGfx.lineBetween(a.x, a.y, b.x, b.y);
    }

    for (const node of this.nodes) {
      const unlocked = isUnlocked(node.id);
      const cleared = save.cleared.includes(node.id);
      const img = this.add.image(node.x, node.y, unlocked ? 'map-node' : 'map-node-locked');
      if (cleared) {
        img.setTint(0x9be37a);
      }
      this.add
        .text(node.x, node.y, `${node.world}-${node.stage}`, {
          fontFamily: 'Courier New, monospace',
          fontSize: '12px',
          color: unlocked ? '#222222' : '#888888',
        })
        .setOrigin(0.5);
    }

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
        fontFamily: 'Courier New, monospace',
        fontSize: '40px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.add
      .text(24, GAME_HEIGHT - 84, `Lives  ${session.lives}     Arrows move     Enter play`, textStyle('18px'))
      .setOrigin(0, 0.5);

    new MenuButton(
      this,
      130,
      GAME_HEIGHT - 36,
      'TITLE',
      () => {
        if (!this.scene.isPaused()) {
          this.scene.start('TitleScene');
        }
      },
      200,
      44,
    );

    this.hint = this.add
      .text(GAME_WIDTH / 2, 640, '', {
        fontFamily: 'Courier New, monospace',
        fontSize: '20px',
        color: '#fff4d6',
      })
      .setOrigin(0.5);

    this.refreshHint();

    const unlessPaused = (action: () => void) => () => {
      if (!this.scene.isPaused()) {
        action();
      }
    };
    this.input.keyboard?.on('keydown-LEFT', unlessPaused(() => this.move(-1)));
    this.input.keyboard?.on('keydown-RIGHT', unlessPaused(() => this.move(1)));
    this.input.keyboard?.on('keydown-UP', unlessPaused(() => this.move(-1)));
    this.input.keyboard?.on('keydown-DOWN', unlessPaused(() => this.move(1)));
    this.input.keyboard?.on('keydown-A', unlessPaused(() => this.move(-1)));
    this.input.keyboard?.on('keydown-D', unlessPaused(() => this.move(1)));
    this.input.keyboard?.on('keydown-W', unlessPaused(() => this.move(-1)));
    this.input.keyboard?.on('keydown-S', unlessPaused(() => this.move(1)));
    this.input.keyboard?.on('keydown-ENTER', unlessPaused(() => this.playSelected()));
    this.input.keyboard?.on('keydown-SPACE', unlessPaused(() => this.playSelected()));
    this.input.keyboard?.on('keydown-ESC', unlessPaused(() => this.scene.start('TitleScene')));
  }

  private move(dir: number): void {
    if (this.moving) {
      return;
    }
    let next = this.cursor + dir;
    while (next >= 0 && next < this.nodes.length) {
      const node = this.nodes[next];
      if (node && isUnlocked(node.id)) {
        this.cursor = next;
        setLastPlayed(node.id);
        audio.play(this, 'map');
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
        return;
      }
      next += dir;
    }
  }

  private refreshHint(): void {
    const node = this.nodes[this.cursor];
    if (!node) {
      return;
    }
    const level = getLevel(node.id);
    const cleared = loadSave().cleared.includes(node.id);
    const boss = level.stage === 4 ? '  ·  world boss' : '  ·  mini-boss';
    this.hint.setText(`${node.id}  ${level.name}${boss}${cleared ? '  ·  cleared' : ''}`);
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
