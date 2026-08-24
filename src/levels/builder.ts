import Phaser from 'phaser';
import { GROUND_Y, MAP_ROWS, TILE, type Theme } from '../config';
import { Baddie } from '../entities/Baddie';
import { Boss } from '../entities/Boss';
import { MemoryGem } from '../entities/MemoryGem';
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
import { colliderBox, colliderRuns, enableOneWayCollision, ONEWAY_HEIGHT, type ColliderRun } from './colliders';
import type { CompiledCourse, PuzzleFeature } from './grid';
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
  puzzleTargets: Phaser.Physics.Arcade.StaticGroup;
  miniBoss: Boss | undefined;
  worldBoss: Boss | undefined;
  arena: ArenaKeep | undefined;
  bossFences: Phaser.GameObjects.Rectangle[];
}

function addTileImage(scene: Phaser.Scene, x: number, y: number, key: string, oneWay = false): void {
  const image = scene.add.image(x, y, key).setOrigin(0, 0);
  image.setDisplaySize(TILE, oneWay ? ONEWAY_HEIGHT : TILE);
}

function addColliderRun(group: Phaser.Physics.Arcade.StaticGroup, run: ColliderRun, key: string): void {
  const box = colliderBox(run);
  const sprite = group.create(box.x, box.y, key) as Phaser.Physics.Arcade.Sprite;
  sprite.setOrigin(0, 0);
  sprite.setVisible(false);
  sprite.setDisplaySize(box.width, box.height);
  const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
  body.updateFromGameObject();
  if (run.kind === 'oneway') {
    enableOneWayCollision(body);
  }
}

function addHazard(
  group: Phaser.Physics.Arcade.StaticGroup,
  x: number,
  y: number,
  key: string,
): void {
  const sprite = group.create(x, y, key) as Phaser.Physics.Arcade.Sprite;
  sprite.setOrigin(0, 0);
  sprite.setDisplaySize(TILE, TILE);
  const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
  body.updateFromGameObject();
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
          addTileImage(scene, px, py, pickTile(scene, solidTileKey(theme), `kenney-${theme}-solid`));
          break;
        case '@':
          addTileImage(scene, px, py, arenaTileKey(theme));
          break;
        case 'G':
          addTileImage(scene, px, py, pickTile(scene, arenaGateTileKey(theme), kenneyArenaGateKey(theme)));
          break;
        case 'W':
          addTileImage(scene, px, py, pickTile(scene, arenaWallTileKey(theme), kenneyArenaWallKey(theme)));
          break;
        case '=':
          addTileImage(scene, px, py, pickTile(scene, onewayTileKey(theme), `kenney-${theme}-oneway`), true);
          break;
        case '~':
          addHazard(hazards, px, py, 'tile-lava');
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

  for (const run of colliderRuns(rows)) {
    const cell = rows[run.tileY]?.[run.tileX] ?? '#';
    addColliderRun(run.kind === 'oneway' ? oneways : solids, run, physicsKey(scene, theme, cell, run.kind));
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
    const collectible = new MemoryGem(
      scene,
      pickup.x * TILE + TILE / 2,
      (GROUND_Y - pickup.tilesUp) * TILE - TILE / 2,
    );
    collectible.setData('index', index);
    collectibles.add(collectible);
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
  stretchCheckpointPlane(checkpoint, MAP_ROWS * TILE);

  for (const puzzle of course.puzzles) {
    addPuzzleTarget(scene, puzzleTargets, puzzle);
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
    puzzleTargets,
    miniBoss,
    worldBoss,
    arena,
    bossFences,
  };
}

function addPuzzleTarget(
  scene: Phaser.Scene,
  group: Phaser.Physics.Arcade.StaticGroup,
  puzzle: PuzzleFeature,
): void {
  if (puzzle.kind === 'down-current') {
    addDownCurrentZone(scene, group, puzzle);
    return;
  }
  const isWall = puzzle.kind === 'ice-wall' || puzzle.kind === 'sand-wall' || puzzle.kind === 'shadow-wall';
  const width = isWall ? 30 : TILE;
  const height = isWall ? puzzle.height * TILE : 28;
  const target = group.create(
    puzzle.x * TILE + TILE / 2,
    GROUND_Y * TILE - height / 2,
    `puzzle-${puzzle.kind}`,
  ) as Phaser.Physics.Arcade.Sprite;
  target.setDisplaySize(width, height);
  target.setData('kind', puzzle.kind);
  target.setData('solid', isWall);
  target.setAlpha(0.9);
  target.setDepth(isWall ? 14 : 11);
  const body = target.body as Phaser.Physics.Arcade.StaticBody;
  body.setSize(width, height);
  body.updateFromGameObject();
}

function addDownCurrentZone(
  scene: Phaser.Scene,
  group: Phaser.Physics.Arcade.StaticGroup,
  puzzle: PuzzleFeature,
): void {
  const width = Math.max(1, puzzle.width) * TILE;
  const height = GROUND_Y * TILE - TILE;
  const x = puzzle.x * TILE + width / 2;
  const y = GROUND_Y * TILE - height / 2;
  const target = group.create(x, y, 'puzzle-down-current') as Phaser.Physics.Arcade.Sprite;
  target.setDisplaySize(width, height);
  target.setVisible(false);
  target.setAlpha(0);
  target.setData('kind', puzzle.kind);
  target.setData('solid', false);
  target.setDepth(11);
  const body = target.body as Phaser.Physics.Arcade.StaticBody;
  body.setSize(width, height);
  body.updateFromGameObject();

  const flow = scene.add.tileSprite(x, y, width, height, 'puzzle-down-current');
  flow.setDepth(11);
  flow.setAlpha(0.58);
  const leftEdge = scene.add.rectangle(x - width / 2, y, 10, height, 0x7af0ff, 0.42);
  leftEdge.setDepth(11);
  const rightEdge = scene.add.rectangle(x + width / 2, y, 10, height, 0x7af0ff, 0.42);
  rightEdge.setDepth(11);
  const badge = scene.add.image(x, GROUND_Y * TILE - TILE * 2.4, 'puzzle-no-jump');
  badge.setDepth(12);
  badge.setScale(1.05);
  scene.tweens.add({
    targets: badge,
    y: badge.y - 10,
    duration: 980,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  target.setData('flow', flow);
  target.setData('badge', badge);
  target.setData('edges', [leftEdge, rightEdge]);
  target.once('destroy', () => {
    flow.destroy();
    badge.destroy();
    leftEdge.destroy();
    rightEdge.destroy();
  });
}

/** Hitbox is a full-height plane at the flag X so flying over still counts. */
function stretchCheckpointPlane(checkpoint: Phaser.Physics.Arcade.Sprite, worldHeightPx: number): void {
  const body = checkpoint.body as Phaser.Physics.Arcade.Body | null;
  if (!body) {
    return;
  }
  const planeHeight = worldHeightPx + 400;
  body.setAllowGravity(false);
  body.setImmovable(true);
  body.setSize(TILE, planeHeight, false);
  body.setOffset(checkpoint.displayOriginX - TILE / 2, checkpoint.displayOriginY - checkpoint.y);
}

function addBossFence(scene: Phaser.Scene, centerX: number, heightPx: number): Phaser.GameObjects.Rectangle {
  const fence = scene.add.rectangle(centerX, heightPx / 2, 24, heightPx, 0x000000, 0);
  scene.physics.add.existing(fence, true);
  const body = fence.body as Phaser.Physics.Arcade.StaticBody;
  body.setSize(24, heightPx);
  body.updateFromGameObject();
  return fence;
}

function physicsKey(scene: Phaser.Scene, theme: Theme, cell: string, kind: 'solid' | 'oneway'): string {
  if (kind === 'oneway') {
    return pickTile(scene, onewayTileKey(theme), `kenney-${theme}-oneway`);
  }
  switch (cell) {
    case '@':
      return arenaTileKey(theme);
    case 'G':
      return pickTile(scene, arenaGateTileKey(theme), kenneyArenaGateKey(theme));
    case 'W':
      return pickTile(scene, arenaWallTileKey(theme), kenneyArenaWallKey(theme));
    default:
      return pickTile(scene, solidTileKey(theme), `kenney-${theme}-solid`);
  }
}

function pickTile(scene: Phaser.Scene, generated: string, kenney: string): string {
  return scene.textures.exists(kenney) ? kenney : generated;
}
