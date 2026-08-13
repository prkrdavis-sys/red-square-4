import Phaser from 'phaser';
import { MAP_ROWS, TILE, type Theme } from '../config';
import { Baddie } from '../entities/Baddie';
import { Boss } from '../entities/Boss';
import { Player } from '../entities/Player';
import { arenaTileKey, onewayTileKey, solidTileKey } from '../systems/textures';
import { decorateArena } from './arena';
import { getWorldBossKind } from './worlds';

export interface BuiltLevel {
  widthPx: number;
  heightPx: number;
  player: Player;
  solids: Phaser.Physics.Arcade.StaticGroup;
  oneways: Phaser.Physics.Arcade.StaticGroup;
  hazards: Phaser.Physics.Arcade.StaticGroup;
  baddies: Phaser.Physics.Arcade.Group;
  miniBoss: Boss | undefined;
  worldBoss: Boss | undefined;
}

const ONEWAY_HEIGHT = 18;

function addStatic(
  group: Phaser.Physics.Arcade.StaticGroup,
  x: number,
  y: number,
  key: string,
  oneWay = false,
): Phaser.Physics.Arcade.Sprite {
  const sprite = group.create(x, y, key) as Phaser.Physics.Arcade.Sprite;
  sprite.setOrigin(0, 0);
  const height = oneWay ? ONEWAY_HEIGHT : TILE;
  sprite.setDisplaySize(TILE, height);
  const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
  body.updateFromGameObject();
  if (oneWay) {
    body.checkCollision.up = true;
    body.checkCollision.down = false;
    body.checkCollision.left = false;
    body.checkCollision.right = false;
  }
  return sprite;
}

export function buildLevel(scene: Phaser.Scene, rows: string[], theme: Theme, world: number): BuiltLevel {
  const cols = rows[0]?.length ?? 0;
  const solids = scene.physics.add.staticGroup();
  const oneways = scene.physics.add.staticGroup();
  const hazards = scene.physics.add.staticGroup();
  const baddies = scene.physics.add.group({ runChildUpdate: false, allowGravity: true });

  let player: Player | undefined;
  let miniBoss: Boss | undefined;
  let worldBoss: Boss | undefined;

  for (let y = 0; y < MAP_ROWS; y += 1) {
    const row = rows[y] ?? '';
    for (let x = 0; x < cols; x += 1) {
      const cell = row[x] ?? '.';
      const px = x * TILE;
      const py = y * TILE;
      switch (cell) {
        case '#':
          addStatic(solids, px, py, pickTile(scene, solidTileKey(theme), `kenney-${theme}-solid`));
          break;
        case '@':
          addStatic(solids, px, py, arenaTileKey(theme));
          break;
        case '=':
          addStatic(oneways, px, py, pickTile(scene, onewayTileKey(theme), `kenney-${theme}-oneway`), true);
          break;
        case '~':
          addStatic(hazards, px, py, 'tile-lava');
          break;
        case 'P':
          player = new Player(scene, px + TILE / 2, py + TILE / 2);
          break;
        case 'e': {
          const alt = (x + y) % 2 === 0 ? 'baddie' : 'baddie-alt';
          const baddie = new Baddie(scene, px + TILE / 2, py + TILE / 2, alt, 60 + (x % 3) * 12);
          baddies.add(baddie);
          break;
        }
        case 'm':
          miniBoss = new Boss(scene, px + TILE / 2, py + TILE / 2 - 8, getWorldBossKind(world), 1);
          break;
        case 'B':
          worldBoss = new Boss(scene, px + TILE / 2, py + TILE / 2 - 16, getWorldBossKind(world), 3);
          break;
        case '.':
          break;
        default:
          break;
      }
    }
  }

  if (!player) {
    player = new Player(scene, TILE * 3, TILE * 8);
  }

  player.applyTheme(theme);

  const boss = worldBoss ?? miniBoss;
  if (boss) {
    decorateArena(scene, boss.x, theme, Boolean(worldBoss), cols);
  }

  return {
    widthPx: cols * TILE,
    heightPx: MAP_ROWS * TILE,
    player,
    solids,
    oneways,
    hazards,
    baddies,
    miniBoss,
    worldBoss,
  };
}

function pickTile(scene: Phaser.Scene, generated: string, kenney: string): string {
  return scene.textures.exists(kenney) ? kenney : generated;
}
