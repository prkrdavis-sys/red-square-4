import Phaser from 'phaser';
import { GROUND_Y, MAP_ROWS, TILE, type Theme } from '../config';
import { Baddie } from '../entities/Baddie';
import { Boss } from '../entities/Boss';
import { Player } from '../entities/Player';
import {
  arenaGateTileKey,
  arenaTileKey,
  arenaWallTileKey,
  kenneyArenaGateKey,
  kenneyArenaWallKey,
  onewayTileKey,
  solidTileKey,
} from '../systems/textures';
import { arenaKeepBounds, decorateArena, getArenaLayout, type ArenaKeep } from './arena';
import type { CompiledCourse } from './grid';
import { getWorldBossKind } from './worlds';

export interface BuiltLevel {
  widthPx: number;
  heightPx: number;
  player: Player;
  solids: Phaser.Physics.Arcade.StaticGroup;
  oneways: Phaser.Physics.Arcade.StaticGroup;
  hazards: Phaser.Physics.Arcade.StaticGroup;
  baddies: Phaser.Physics.Arcade.Group;
  projectiles: Phaser.Physics.Arcade.Group;
  collectibles: Phaser.Physics.Arcade.Group;
  shields: Phaser.Physics.Arcade.Group;
  checkpoints: Phaser.Physics.Arcade.Group;
  specialAnchors: Phaser.Physics.Arcade.StaticGroup;
  puzzleTargets: Phaser.Physics.Arcade.StaticGroup;
  miniBoss: Boss | undefined;
  worldBoss: Boss | undefined;
  arena: ArenaKeep | undefined;
  bossFences: Phaser.GameObjects.Rectangle[];
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

export function buildLevel(
  scene: Phaser.Scene,
  rows: string[],
  theme: Theme,
  world: number,
  course: CompiledCourse,
): BuiltLevel {
  const cols = rows[0]?.length ?? 0;
  const solids = scene.physics.add.staticGroup();
  const oneways = scene.physics.add.staticGroup();
  const hazards = scene.physics.add.staticGroup();
  const baddies = scene.physics.add.group({ runChildUpdate: false, allowGravity: true });
  const projectiles = scene.physics.add.group({ runChildUpdate: false, allowGravity: false });
  const collectibles = scene.physics.add.group({ runChildUpdate: false, allowGravity: false, immovable: true });
  const shields = scene.physics.add.group({ runChildUpdate: false, allowGravity: false, immovable: true });
  const checkpoints = scene.physics.add.group({ runChildUpdate: false, allowGravity: false, immovable: true });
  const specialAnchors = scene.physics.add.staticGroup();
  const puzzleTargets = scene.physics.add.staticGroup();

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
        case 'G':
          addStatic(solids, px, py, pickTile(scene, arenaGateTileKey(theme), kenneyArenaGateKey(theme)));
          break;
        case 'W':
          addStatic(solids, px, py, pickTile(scene, arenaWallTileKey(theme), kenneyArenaWallKey(theme)));
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
        case 'e':
          break;
        case 'm':
          miniBoss = new Boss(
            scene,
            px + TILE / 2,
            py + TILE / 2 - 8,
            getWorldBossKind(world),
            1,
            theme,
            course.miniVariant,
          );
          break;
        case 'B':
          worldBoss = new Boss(
            scene,
            px + TILE / 2,
            py + TILE / 2 - 16,
            getWorldBossKind(world),
            3,
            theme,
          );
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

  for (const spawn of course.enemies) {
    const y = (GROUND_Y - 1 - spawn.tilesUp) * TILE + TILE / 2;
    const baddie = new Baddie(scene, spawn.x * TILE + TILE / 2, y, spawn.kind, 60 + (spawn.x % 3) * 12);
    baddies.add(baddie);
  }

  course.collectibles.forEach((pickup, index) => {
    const collectible = collectibles.create(
      pickup.x * TILE + TILE / 2,
      (GROUND_Y - pickup.tilesUp) * TILE - TILE / 2,
      'memory-sprout',
    ) as Phaser.Physics.Arcade.Sprite;
    collectible.setData('index', index);
    collectible.setDepth(14);
    collectible.setScale(0.9);
  });

  const shield = shields.create(
    course.shield.x * TILE + TILE / 2,
    (GROUND_Y - course.shield.tilesUp) * TILE - TILE / 2,
    'shield-pickup',
  ) as Phaser.Physics.Arcade.Sprite;
  shield.setDepth(14);

  const checkpoint = checkpoints.create(
    course.checkpoint.x * TILE + TILE / 2,
    GROUND_Y * TILE - 30,
    'checkpoint',
  ) as Phaser.Physics.Arcade.Sprite;
  checkpoint.setData('spawnX', course.checkpoint.x * TILE + TILE / 2);
  checkpoint.setData('spawnY', (GROUND_Y - 1) * TILE + TILE / 2);
  checkpoint.setDepth(13);

  for (const anchor of course.specialAnchors) {
    const marker = specialAnchors.create(
      anchor.x * TILE + TILE / 2,
      (GROUND_Y - anchor.tilesUp) * TILE - TILE / 2,
      `special-anchor-${theme}`,
    ) as Phaser.Physics.Arcade.Sprite;
    marker.setData('special', course.special);
    marker.setDepth(12);
  }

  for (const puzzle of course.puzzles) {
    const isWall = puzzle.kind === 'ice-wall' || puzzle.kind === 'sand-wall' || puzzle.kind === 'shadow-wall';
    const width = puzzle.kind === 'down-current' ? TILE * 2.5 : isWall ? 30 : TILE;
    const height = puzzle.kind === 'down-current' ? TILE * 3 : isWall ? puzzle.height * TILE : 28;
    const target = puzzleTargets.create(
      puzzle.x * TILE + TILE / 2,
      GROUND_Y * TILE - height / 2,
      `puzzle-${puzzle.kind}`,
    ) as Phaser.Physics.Arcade.Sprite;
    target.setDisplaySize(width, height);
    target.setData('kind', puzzle.kind);
    target.setData('solid', isWall);
    target.setAlpha(puzzle.kind === 'down-current' ? 0.42 : 0.9);
    target.setDepth(isWall ? 14 : 11);
    const body = target.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(width, height);
    body.updateFromGameObject();
  }

  const heightPx = MAP_ROWS * TILE;
  const boss = worldBoss ?? miniBoss;
  let arena: ArenaKeep | undefined;
  const bossFences: Phaser.GameObjects.Rectangle[] = [];
  if (boss) {
    const grand = Boolean(worldBoss);
    const layout = getArenaLayout(Math.floor(boss.x / TILE), theme, grand, cols);
    arena = arenaKeepBounds(layout);
    boss.setArena(arena);
    decorateArena(scene, boss.x, theme, grand, cols);
    bossFences.push(addBossFence(scene, arena.left - 12, heightPx));
    bossFences.push(addBossFence(scene, arena.right + 12, heightPx));
  }

  return {
    widthPx: cols * TILE,
    heightPx,
    player,
    solids,
    oneways,
    hazards,
    baddies,
    projectiles,
    collectibles,
    shields,
    checkpoints,
    specialAnchors,
    puzzleTargets,
    miniBoss,
    worldBoss,
    arena,
    bossFences,
  };
}

function addBossFence(scene: Phaser.Scene, centerX: number, heightPx: number): Phaser.GameObjects.Rectangle {
  const fence = scene.add.rectangle(centerX, heightPx / 2, 24, heightPx, 0x000000, 0);
  scene.physics.add.existing(fence, true);
  const body = fence.body as Phaser.Physics.Arcade.StaticBody;
  body.setSize(24, heightPx);
  body.updateFromGameObject();
  return fence;
}

function pickTile(scene: Phaser.Scene, generated: string, kenney: string): string {
  return scene.textures.exists(kenney) ? kenney : generated;
}
