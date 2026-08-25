import { describe, expect, it } from 'vitest';
import {
  ALL_LEVEL_IDS,
  BOSS_KINDS,
  GROUND_Y,
  JUMP_HEIGHT_TILES,
  JUMP_REACH_TILES,
  MAP_ROWS,
  STOMP_BOUNCE_HEIGHT_TILES,
  STOMP_BOUNCE_VELOCITY,
  launchVelocity,
  themePhysics,
  THEMES,
  TILE,
  enemyRole,
  enemyThreatensTile,
  enemiesForWorld,
  hazardForTheme,
  parseLevelId,
  specialForTheme,
  worldBossKind,
  type LevelId,
} from '../config';
import { hazardThreatensTile } from '../entities/terrain-hazard';
import { miniBossTextureKey, worldBossTextureKey } from '../systems/characters';
import { getLevel } from './worlds';
import { bossSafeLandingX, getArenaLayout, type ArenaKeep } from './arena';
import { colliderBox, colliderRuns, enableOneWayCollision, liftOntoFloor, ONEWAY_HEIGHT } from './colliders';
import {
  buildCourse,
  lateStageEnemyQuota,
  NO_JUMP_ZONE_RUNUP,
  NO_JUMP_ZONE_WIDTH,
  placeNoJumpZone,
} from './grid';
import {
  aerialLungeCeiling,
  crownGuardLayout,
  crownGuardVisible,
  hurtboxFromOpaque,
  isFallingStomp,
  lockChargeDir,
  POST_STOMP_RECOVERY_MS,
  STOMP_INVULN_MS,
  stompBlocked,
  swimHomeY,
} from '../entities/boss-combat';

describe('late-stage length and checkpoints', () => {
  it('makes stage 3 and 4 longer than the early courses and gives them two flags', () => {
    for (let world = 1; world <= 6; world += 1) {
      const early = [`${world}-1`, `${world}-2`] as LevelId[];
      const late = [`${world}-3`, `${world}-4`] as LevelId[];
      const earlyWidth = Math.max(...early.map((id) => getLevel(id).rows[0]?.length ?? 0));
      for (const id of late) {
        const level = getLevel(id);
        const width = level.rows[0]?.length ?? 0;
        expect(width, id).toBeGreaterThan(earlyWidth);
        expect(level.course.checkpoints, id).toHaveLength(2);
        const [first, second] = level.course.checkpoints;
        expect(second?.x ?? 0, id).toBeGreaterThan((first?.x ?? 0) + 16);
      }
      expect(getLevel(`${world}-1` as LevelId).course.checkpoints).toHaveLength(1);
      expect(getLevel(`${world}-2` as LevelId).course.checkpoints).toHaveLength(1);
    }
  });

  it('packs more enemies into x-3 and x-4 as worlds get later', () => {
    const stageCounts = (stage: 3 | 4) =>
      ([1, 2, 3, 4, 5, 6] as const).map((world) => getLevel(`${world}-${stage}`).course.enemies.length);
    expect(stageCounts(3)).toEqual([1, 2, 3, 4, 5, 6].map((world) => lateStageEnemyQuota(world, 3)));
    expect(stageCounts(4)).toEqual([1, 2, 3, 4, 5, 6].map((world) => lateStageEnemyQuota(world, 4)));
    for (let world = 1; world <= 6; world += 1) {
      expect(getLevel(`${world}-3` as LevelId).course.enemies.length).toBeGreaterThan(
        getLevel(`${world}-2` as LevelId).course.enemies.length,
      );
    }
    expect(lateStageEnemyQuota(1, 3)).toBe(13);
    expect(lateStageEnemyQuota(6, 3)).toBe(18);
    expect(lateStageEnemyQuota(1, 4)).toBe(8);
    expect(lateStageEnemyQuota(6, 4)).toBe(13);
    expect(lateStageEnemyQuota(3, 1)).toBe(0);
  });
});

describe('biome campaign compilation', () => {
  it('compiles every course with complete progression features', () => {
    for (const id of ALL_LEVEL_IDS) {
      const level = getLevel(id);
      const width = level.rows[0]?.length ?? 0;

      expect(level.rows).toHaveLength(MAP_ROWS);
      expect(width).toBeGreaterThan(100);
      expect(level.rows.every((row) => row.length === width)).toBe(true);
      expect(level.course.collectibles).toHaveLength(3);
      expect(level.course.puzzles.length).toBe(level.stage === 4 ? 1 : level.stage);
      expect(level.course.checkpoints.length).toBe(level.stage >= 3 ? 2 : 1);
      for (const checkpoint of level.course.checkpoints) {
        expect(level.rows[GROUND_Y]?.[checkpoint.x]).toMatch(/[#@]/);
      }
      expect(level.course.miniVariant).toBe(level.stage < 4 ? level.stage : undefined);
      expect(level.rows.join('')).toContain(level.stage < 4 ? 'm' : 'B');
      expect(level.rows.join('')).toContain('W');
    }
  });

  it('uses solid jump-blocks for the hop hills at the arena entrance', () => {
    for (const id of ALL_LEVEL_IDS) {
      const level = getLevel(id);
      const bossCh = level.stage < 4 ? 'm' : 'B';
      const bossX = level.rows[GROUND_Y - 1]?.indexOf(bossCh) ?? -1;
      const layout = getArenaLayout(bossX, level.theme, level.stage === 4, level.rows[0]?.length ?? 0);
      expect(level.rows[GROUND_Y - 1]?.[layout.floorStart + 2], id).toBe('#');
      expect(level.rows[GROUND_Y - 1]?.[layout.floorStart + 3], id).toBe('#');
      expect(level.rows[GROUND_Y - 1]?.[layout.floorStart + 4], id).toBe('#');
    }
  });

  it('leaves the arena gate as open air the player can walk through', () => {
    for (const id of ALL_LEVEL_IDS) {
      const level = getLevel(id);
      const bossCh = level.stage < 4 ? 'm' : 'B';
      const bossX = level.rows[GROUND_Y - 1]?.indexOf(bossCh) ?? -1;
      const layout = getArenaLayout(bossX, level.theme, level.stage === 4, level.rows[0]?.length ?? 0);
      for (let x = layout.gateX; x < layout.floorStart; x += 1) {
        for (let y = 0; y < GROUND_Y; y += 1) {
          expect(level.rows[y]?.[x]).toBe('.');
        }
      }
    }
  });

  it('gives each biome a distinct special', () => {
    expect(getLevel('1-1').course.special).toBe('grow');
    expect(getLevel('2-1').course.special).toBe('frost-path');
    expect(getLevel('3-1').course.special).toBe('sand-surge');
    expect(getLevel('4-1').course.special).toBe('bubble-pulse');
    expect(getLevel('5-1').course.special).toBe('shadow-blink');
    expect(getLevel('6-1').course.special).toBe('liana-swing');
    expect(THEMES.map((theme) => specialForTheme(theme))).toEqual([
      'grow',
      'frost-path',
      'sand-surge',
      'bubble-pulse',
      'shadow-blink',
      'liana-swing',
    ]);
  });

  it('introduces movement and ranged enemies by stage, then biome traps', () => {
    for (const id of ALL_LEVEL_IDS) {
      const level = getLevel(id);
      const roles = new Set(level.course.enemies.map((enemy) => enemyRole(enemy.kind)));
      if (level.stage === 1) {
        expect([...roles]).toEqual(['movement']);
        expect(level.course.traps).toEqual([]);
      } else if (level.stage === 2) {
        expect(roles).toEqual(new Set(['movement', 'ranged']));
        expect(level.course.traps).toEqual([]);
      } else {
        expect(roles).toEqual(new Set(['movement', 'ranged']));
        expect(level.course.traps.length).toBeGreaterThan(0);
        expect(level.course.traps.every((trap) => trap.kind === hazardForTheme(level.theme))).toBe(true);
      }
    }
  });

  it('keeps spawn, checkpoint, and solid puzzles off ground enemies', () => {
    for (const id of ALL_LEVEL_IDS) {
      const level = getLevel(id);
      const spawnX = level.rows[GROUND_Y - 1]?.indexOf('P') ?? 3;
      const groundEnemies = level.course.enemies.filter((enemy) => enemy.tilesUp === 0);
      expect(groundEnemies.some((enemy) => enemy.x === spawnX), id).toBe(false);
      expect(
        groundEnemies.some((enemy) =>
          level.course.checkpoints.some((checkpoint) => Math.abs(enemy.x - checkpoint.x) <= 1),
        ),
        id,
      ).toBe(false);
      expect(level.course.traps.every((trap) => trap.x >= 8), id).toBe(true);
      expect(level.course.traps.some((trap) => trap.x === spawnX), id).toBe(false);
      expect(
        level.course.traps.some((trap) =>
          level.course.checkpoints.some((checkpoint) => Math.abs(trap.x - checkpoint.x) <= 1),
        ),
        id,
      ).toBe(false);
      for (const puzzle of level.course.puzzles) {
        if (
          puzzle.kind !== 'ice-wall' &&
          puzzle.kind !== 'sand-wall' &&
          puzzle.kind !== 'shadow-wall' &&
          puzzle.kind !== 'moss-curtain'
        ) {
          continue;
        }
        expect(groundEnemies.some((enemy) => enemy.x === puzzle.x), id).toBe(false);
        expect(level.course.traps.some((trap) => trap.x === puzzle.x), id).toBe(false);
        expect(
          level.course.checkpoints.some((checkpoint) => puzzle.x === checkpoint.x),
          id,
        ).toBe(false);
        expect(puzzle.x, id).not.toBe(spawnX);
      }
    }
    const keep = getLevel('5-3');
    expect(keep.course.checkpoints).toHaveLength(2);
    expect(keep.course.checkpoints[0]?.x).toBeLessThan(keep.course.checkpoints[1]?.x ?? 0);
    for (const checkpoint of keep.course.checkpoints) {
      expect(keep.course.enemies.some((enemy) => enemy.x === checkpoint.x && enemy.tilesUp === 0)).toBe(
        false,
      );
      expect(keep.course.puzzles.some((puzzle) => puzzle.x === checkpoint.x)).toBe(false);
    }
  });

  it('keeps spawn and checkpoint outside projectile attack range', () => {
    for (const id of ALL_LEVEL_IDS) {
      const level = getLevel(id);
      const spawnX = level.rows[GROUND_Y - 1]?.indexOf('P') ?? 3;
      for (const origin of [spawnX, ...level.course.checkpoints.map((checkpoint) => checkpoint.x)]) {
        for (const enemy of level.course.enemies) {
          expect(
            enemyThreatensTile(enemy.kind, enemy.x, origin),
            `${id} ${enemy.kind}@${enemy.x} vs ${origin}`,
          ).toBe(false);
        }
        for (const trap of level.course.traps) {
          expect(
            hazardThreatensTile(trap.kind, trap.x, origin, trap.facing),
            `${id} ${trap.kind}@${trap.x} vs ${origin}`,
          ).toBe(false);
        }
      }
    }
  });

  it('keeps each enemy roster exclusive to its biome', () => {
    for (const id of ALL_LEVEL_IDS) {
      const { world } = parseLevelId(id);
      const allowed = new Set(enemiesForWorld(world));
      expect(getLevel(id).course.enemies.every((enemy) => allowed.has(enemy.kind))).toBe(true);
    }
  });
});

describe('no-jump down-current zones', () => {
  function isWalkableFloor(rows: string[], x: number): boolean {
    const ground = rows[GROUND_Y]?.[x];
    const above = rows[GROUND_Y - 1]?.[x];
    return (ground === '#' || ground === 'G' || ground === 'W') && above === '.';
  }

  it('places a wide walk-through field next to a pit instead of on the lip', () => {
    const rows = buildCourse({
      width: 60,
      pits: [[20, 10]],
      playerX: 3,
    });
    const placed = placeNoJumpZone(rows, 24, new Set([3, 4, 5, 6]));
    expect(placed).toBeDefined();
    expect(placed?.width).toBe(NO_JUMP_ZONE_WIDTH);
    const start = placed?.x ?? 0;
    const end = start + (placed?.width ?? 0);
    for (let x = start; x < end; x += 1) {
      expect(x < 20 || x >= 30, `zone sat in the pit @${x}`).toBe(true);
      expect(isWalkableFloor(rows, x), `column ${x}`).toBe(true);
    }
    for (let x = start - NO_JUMP_ZONE_RUNUP; x < end + NO_JUMP_ZONE_RUNUP; x += 1) {
      expect(isWalkableFloor(rows, x), `run-up ${x}`).toBe(true);
    }
  });

  it('keeps ocean no-jump fields big, on solid ground, and jumpable at both edges', () => {
    for (const id of ['4-1', '4-2', '4-3', '4-4'] as const) {
      const level = getLevel(id);
      const groundEnemies = new Set(
        level.course.enemies.filter((enemy) => enemy.tilesUp === 0).map((enemy) => enemy.x),
      );
      expect(level.course.puzzles.length).toBeGreaterThan(0);
      for (const [index, puzzle] of level.course.puzzles.entries()) {
        expect(puzzle.kind, id).toBe('down-current');
        expect(puzzle.width, id).toBeGreaterThanOrEqual(6);
        const desired = Math.floor(level.course.rows[0]!.length * ((index + 1) / (level.course.puzzles.length + 1)));
        const center = puzzle.x + (puzzle.width - 1) / 2;
        expect(Math.abs(center - desired), `${id} stayed near its original region`).toBeLessThan(28);
        for (let x = puzzle.x; x < puzzle.x + puzzle.width; x += 1) {
          expect(isWalkableFloor(level.rows, x), `${id} zone @${x}`).toBe(true);
          expect(groundEnemies.has(x), `${id} enemy in zone @${x}`).toBe(false);
        }
        for (let i = 1; i <= NO_JUMP_ZONE_RUNUP; i += 1) {
          expect(isWalkableFloor(level.rows, puzzle.x - i), `${id} left run-up`).toBe(true);
          expect(isWalkableFloor(level.rows, puzzle.x + puzzle.width - 1 + i), `${id} right run-up`).toBe(true);
        }
        expect(JUMP_REACH_TILES).toBe(NO_JUMP_ZONE_RUNUP);
      }
    }
  });
});

describe('stomp recovery tuning', () => {
  it('jumps 2.5 tiles and bounces 4 tiles under every theme gravity', () => {
    for (const theme of THEMES) {
      const { gravity, jump } = themePhysics(theme);
      const jumpApex = (jump ** 2) / (2 * gravity);
      const bounce = launchVelocity(gravity, STOMP_BOUNCE_HEIGHT_TILES);
      const bounceApex = (bounce ** 2) / (2 * gravity);
      expect(jumpApex, theme).toBeCloseTo(TILE * JUMP_HEIGHT_TILES);
      expect(bounceApex, theme).toBeCloseTo(TILE * STOMP_BOUNCE_HEIGHT_TILES);
    }
    expect(STOMP_BOUNCE_VELOCITY).toBe(launchVelocity(1800, STOMP_BOUNCE_HEIGHT_TILES));
  });

  it('sends boss stomps toward the opposite safe edge', () => {
    const arena: ArenaKeep = { left: 100, right: 900, top: 100, bottom: 600, enterX: 120 };
    expect(bossSafeLandingX(arena, 300)).toBe(824);
    expect(bossSafeLandingX(arena, 700)).toBe(176);
  });
});

describe('falling stomp', () => {
  const boss = {
    top: 200,
    bottom: 320,
    left: 400,
    right: 520,
    width: 120,
    height: 120,
    velocity: { y: 0 },
  };
  const hopper = {
    top: 260,
    bottom: 300,
    left: 400,
    right: 440,
    width: 40,
    height: 40,
    velocity: { y: 0 },
  };

  it('accepts a falling landing on the head', () => {
    expect(
      isFallingStomp(
        { top: 160, bottom: 220, left: 430, right: 464, width: 34, height: 36, velocity: { y: 200 } },
        boss,
      ),
    ).toBe(true);
  });

  it('accepts a jump-apex landing that still looks like the player is above', () => {
    expect(
      isFallingStomp(
        { top: 160, bottom: 220, left: 430, right: 464, width: 34, height: 36, velocity: { y: -40 } },
        boss,
      ),
    ).toBe(true);
  });

  it('accepts a hopping enemy that rises into a player who was already above', () => {
    expect(
      isFallingStomp(
        { top: 168, bottom: 204, left: 408, right: 442, width: 34, height: 36, velocity: { y: 80 }, deltaY: 12 },
        { ...hopper, top: 186, bottom: 226, deltaY: -28 },
      ),
    ).toBe(true);
    expect(
      isFallingStomp(
        { top: 150, bottom: 186, left: 430, right: 464, width: 34, height: 36, velocity: { y: 90 }, deltaY: 10 },
        { ...boss, top: 158, bottom: 278, deltaY: -42 },
      ),
    ).toBe(true);
  });

  it('rejects side bumps, including mid-air clips against the torso', () => {
    expect(
      isFallingStomp(
        { top: 240, bottom: 276, left: 500, right: 534, width: 34, height: 36, velocity: { y: 120 } },
        boss,
      ),
    ).toBe(false);
    expect(
      isFallingStomp(
        { top: 210, bottom: 246, left: 508, right: 542, width: 34, height: 36, velocity: { y: 220 } },
        boss,
      ),
    ).toBe(false);
    expect(
      isFallingStomp(
        { top: 262, bottom: 298, left: 430, right: 464, width: 34, height: 36, velocity: { y: 180 } },
        hopper,
      ),
    ).toBe(false);
  });

  it('rejects jumping up into the underside', () => {
    expect(
      isFallingStomp(
        { top: 280, bottom: 316, left: 430, right: 464, width: 34, height: 36, velocity: { y: -280 } },
        boss,
      ),
    ).toBe(false);
  });

  it('keeps the hurtbox on the visible sprite instead of empty frame padding', () => {
    const box = hurtboxFromOpaque({ x: 25, y: 31, width: 78, height: 97 });
    expect(box.width).toBeLessThan(78);
    expect(box.height).toBeGreaterThan(80);
    expect(box.offsetY).toBeLessThan(40);
    expect(box.offsetX).toBeGreaterThan(25);
  });
});

describe('boss crown guard telegraph', () => {
  it('blocks stomps except during an open recovery window', () => {
    expect(stompBlocked({ dying: false, invulnerable: false, rhythm: 'recovery' })).toBe(false);
    expect(stompBlocked({ dying: false, invulnerable: true, rhythm: 'recovery' })).toBe(true);
    expect(stompBlocked({ dying: false, invulnerable: false, rhythm: 'telegraph' })).toBe(true);
    expect(stompBlocked({ dying: false, invulnerable: false, rhythm: 'attack' })).toBe(true);
    expect(stompBlocked({ dying: true, invulnerable: false, rhythm: 'recovery' })).toBe(true);
  });

  it('shows the crown guard when a jump would bounce, and hides it in the stomp window', () => {
    expect(
      crownGuardVisible({ dying: false, engaged: true, invulnerable: false, rhythm: 'telegraph' }),
    ).toBe(true);
    expect(
      crownGuardVisible({ dying: false, engaged: true, invulnerable: false, rhythm: 'attack' }),
    ).toBe(true);
    expect(
      crownGuardVisible({ dying: false, engaged: true, invulnerable: true, rhythm: 'recovery' }),
    ).toBe(true);
    expect(
      crownGuardVisible({ dying: false, engaged: true, invulnerable: false, rhythm: 'recovery' }),
    ).toBe(false);
    expect(
      crownGuardVisible({ dying: false, engaged: false, invulnerable: false, rhythm: 'telegraph' }),
    ).toBe(false);
  });

  it('overlays the crown guard on the body and keeps it translucent', () => {
    const pose = crownGuardLayout(400, 220, 96, 80, 0);
    expect(pose.x).toBe(400);
    expect(pose.y).toBe(220);
    expect(pose.scale).toBeGreaterThan(1);
    expect(pose.scale).toBeLessThan(1.6);
    expect(pose.alpha).toBeGreaterThan(0.45);
    expect(pose.alpha).toBeLessThan(0.7);
  });
});

describe('boss pacing helpers', () => {
  const arena: ArenaKeep = { left: 100, right: 900, top: 32, bottom: 576, enterX: 120 };

  it('keeps post-stomp i-frames shorter than the open recovery window', () => {
    expect(STOMP_INVULN_MS).toBe(280);
    expect(POST_STOMP_RECOVERY_MS).toBe(1100);
    expect(STOMP_INVULN_MS).toBeLessThan(POST_STOMP_RECOVERY_MS);
  });

  it('commits a charge direction and does not flip when the player crosses behind', () => {
    const locked = lockChargeDir(700, 400);
    expect(locked).toBe(1);
    expect(locked).toBe(1);
    expect(lockChargeDir(100, 400)).toBe(-1);
    expect(lockChargeDir(400, 400)).toBe(-1);
  });

  it('keeps swim-home in the lower third and below the aerial ceiling', () => {
    const home = swimHomeY(540, arena);
    const ceiling = aerialLungeCeiling(arena);
    const lowerThirdTop = arena.bottom - (arena.bottom - arena.top) / 3;
    expect(home).toBeGreaterThanOrEqual(lowerThirdTop);
    expect(home).toBeLessThanOrEqual(arena.bottom);
    expect(home).toBeGreaterThan(ceiling);
    expect(swimHomeY(40, arena)).toBe(lowerThirdTop);
    expect(ceiling).toBe(arena.bottom - 3 * TILE);
    expect(ceiling).toBeGreaterThan(arena.top);
  });
});

describe('mini-boss looks', () => {
  it('gives each biome its own texture family', () => {
    const keys = THEMES.map((theme) => miniBossTextureKey(theme, 1, 'idle'));
    expect(new Set(keys).size).toBe(THEMES.length);
    expect(miniBossTextureKey('grass', 1, 'idle')).not.toBe(miniBossTextureKey('rainforest', 1, 'idle'));
  });
});

describe('world bosses', () => {
  it('ties each world to a unique themed creature', () => {
    const kinds = [1, 2, 3, 4, 5, 6].map((world) => worldBossKind(world));
    expect(kinds).toEqual(['piranha', 'walrus', 'scorpion', 'fish', 'gargoyle', 'howler']);
    expect(new Set(kinds).size).toBe(BOSS_KINDS.length);
    expect(BOSS_KINDS).toEqual(['piranha', 'walrus', 'scorpion', 'fish', 'gargoyle', 'howler']);
  });

  it('gives every world boss its own texture family', () => {
    const keys = BOSS_KINDS.map((kind) => worldBossTextureKey(kind, 'idle'));
    expect(new Set(keys).size).toBe(BOSS_KINDS.length);
    expect(worldBossTextureKey('piranha', 'idle')).not.toBe(worldBossTextureKey('fish', 'idle'));
    expect(worldBossTextureKey('walrus', 'attack')).not.toBe(worldBossTextureKey('scorpion', 'attack'));
  });
});

describe('floor colliders', () => {
  it('merges consecutive solid and one-way tiles in a row', () => {
    const runs = colliderRuns(['..=..', '###.#']);
    expect(runs).toEqual([
      { tileX: 2, tileY: 0, tilesWide: 1, kind: 'oneway' },
      { tileX: 0, tileY: 1, tilesWide: 3, kind: 'solid' },
      { tileX: 4, tileY: 1, tilesWide: 1, kind: 'solid' },
    ]);
  });

  it('turns a long ground strip into one collider', () => {
    const level = getLevel('1-1');
    const ground = colliderRuns(level.rows).filter((run) => run.tileY === GROUND_Y && run.kind === 'solid');
    expect(ground.some((run) => run.tilesWide >= 8)).toBe(true);
    expect(ground.length).toBeLessThan(level.rows[GROUND_Y]?.length ?? 0);
    const box = colliderBox({ tileX: 2, tileY: GROUND_Y, tilesWide: 5, kind: 'solid' });
    expect(box.width).toBe(TILE * 5);
    expect(box.height).toBe(TILE);
    expect(colliderBox({ tileX: 0, tileY: 3, tilesWide: 2, kind: 'oneway' }).height).toBe(ONEWAY_HEIGHT);
  });

  it('lifts bodies that have sunk through the floor and ignores ones above it', () => {
    expect(liftOntoFloor(580, 576)).toBe(4);
    expect(liftOntoFloor(576, 576)).toBe(0);
    expect(liftOntoFloor(500, 576)).toBe(0);
  });

  it('makes one-way platforms collide only from above', () => {
    const body = { checkCollision: { up: false, down: true, left: true, right: true } };
    enableOneWayCollision(body);
    expect(body.checkCollision).toEqual({ up: true, down: false, left: false, right: false });
  });
});
