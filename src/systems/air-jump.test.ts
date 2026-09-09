import { describe, expect, it } from 'vitest';
import { JUMP_HEIGHT_TILES, TILE, launchVelocity, THEMES, themePhysics } from '../config';
import {
  airJumpHint,
  airJumpMode,
  applyFlowerSpring,
  applySwimStroke,
  awningWallJumpSide,
  awningWallJumpVelocity,
  canCarpetGlide,
  canFeatherFlutter,
  canFlowerSpring,
  canGhostHover,
  canParasolHang,
  canSwimStroke,
  carpetGlideVelocity,
  carpetTrailPosition,
  CARPET_GLIDE_DAMP,
  CARPET_GLIDE_MAX_FALL,
  CARPET_TRAIL_OFFSET_X,
  FEATHER_FLUTTER_AMP,
  FEATHER_FLUTTER_BASE_FALL,
  FEATHER_FLUTTER_PERIOD_MS,
  featherFlutterVelocity,
  featherLeafPosition,
  flowerSpringSpawn,
  flowerSpringVelocity,
  flyingCarpetPosition,
  FLOWER_SPRING_HEIGHT_TILES,
  GHOST_HOVER_DAMP,
  GHOST_HOVER_MAX_FALL,
  PARASOL_HANG_DAMP,
  PARASOL_HANG_MAX_FALL,
  ghostHoverVelocity,
  ghostShroudPosition,
  parasolHangVelocity,
  parasolPosition,
  iceFlashSpawn,
  iceSkatePosition,
  nextTripleJumpStep,
  swimStrokeVelocity,
  tripleChainLive,
  tripleJumpHeightTiles,
  tripleJumpVelocity,
  TRIPLE_JUMP_HEIGHT_2_TILES,
  TRIPLE_JUMP_HEIGHT_3_TILES,
  TRIPLE_JUMP_MIN_SPEED,
  TRIPLE_JUMP_WINDOW_MS,
} from './air-jump';

describe('airJumpMode', () => {
  it('maps every theme to a jump special', () => {
    expect(airJumpMode('grass')).toBe('flower-spring');
    expect(airJumpMode('snow')).toBe('triple-jump');
    expect(airJumpMode('ocean')).toBe('swim-stroke');
    expect(airJumpMode('desert')).toBe('carpet-glide');
    expect(airJumpMode('castle')).toBe('ghost-hover');
    expect(airJumpMode('rainforest')).toBe('feather-flutter');
    expect(airJumpMode('beach')).toBe('parasol-hang');
    expect(airJumpMode('rainy-city')).toBe('awning-wall-jump');
  });

  it('covers every theme', () => {
    for (const theme of THEMES) {
      expect(airJumpMode(theme)).toMatch(
        /^(flower-spring|triple-jump|carpet-glide|swim-stroke|ghost-hover|feather-flutter|parasol-hang|awning-wall-jump)$/,
      );
    }
  });
});

describe('airJumpHint', () => {
  it('explains each world’s jump special', () => {
    expect(airJumpHint('grass')).toBe('Tap jump in the air to bounce on a flower spring.');
    expect(airJumpHint('snow')).toBe('Chain running jumps for a triple jump.');
    expect(airJumpHint('ocean')).toBe('Tap jump in the air to swim.');
    expect(airJumpHint('desert')).toBe('Hold jump in the air to ride a flying carpet.');
    expect(airJumpHint('castle')).toBe('Hold jump in the air to hover like a ghost.');
    expect(airJumpHint('rainforest')).toBe('Hold jump in the air to flutter down.');
    expect(airJumpHint('beach')).toBe('Hold jump in the air to hang from a parasol.');
    expect(airJumpHint('rainy-city')).toBe('Tap jump against a wall or awning to spring upward and away.');
  });
});

describe('swim strokes', () => {
  const gravity = themePhysics('ocean').gravity;

  it('launches a weaker stroke than a ground jump', () => {
    const stroke = swimStrokeVelocity(gravity);
    const jump = themePhysics('ocean').jump;
    expect(stroke).toBeLessThan(0);
    expect(stroke).toBeGreaterThan(jump);
  });

  it('replaces fall or rise with the stroke speed', () => {
    const stroke = swimStrokeVelocity(gravity);
    expect(applySwimStroke(stroke)).toBe(stroke);
  });

  it('fires on a mid-air tap when unlocked and ready', () => {
    expect(
      canSwimStroke({
        jumpLocked: false,
        grounded: false,
        jumpJust: true,
        now: 400,
        strokeReadyAt: 260,
      }),
    ).toBe(true);
  });

  it('rejects locked, grounded, held, or cooling-down strokes', () => {
    const ready = {
      jumpLocked: false,
      grounded: false,
      jumpJust: true,
      now: 400,
      strokeReadyAt: 260,
    };
    expect(canSwimStroke({ ...ready, jumpLocked: true })).toBe(false);
    expect(canSwimStroke({ ...ready, grounded: true })).toBe(false);
    expect(canSwimStroke({ ...ready, jumpJust: false })).toBe(false);
    expect(canSwimStroke({ ...ready, now: 200 })).toBe(false);
  });
});

describe('carpet glide', () => {
  it('only slows a held falling jump', () => {
    expect(canCarpetGlide({ jumpHeld: true, grounded: false, velocityY: 80 })).toBe(true);
    expect(canCarpetGlide({ jumpHeld: false, grounded: false, velocityY: 80 })).toBe(false);
    expect(canCarpetGlide({ jumpHeld: true, grounded: true, velocityY: 80 })).toBe(false);
    expect(canCarpetGlide({ jumpHeld: true, grounded: false, velocityY: -20 })).toBe(false);
    expect(canCarpetGlide({ jumpHeld: true, grounded: false, velocityY: 20 })).toBe(false);
  });

  it('damps and caps downward speed, and leaves a rise alone', () => {
    expect(carpetGlideVelocity(-120)).toBe(-120);
    expect(carpetGlideVelocity(80)).toBeCloseTo(80 * CARPET_GLIDE_DAMP);
    expect(carpetGlideVelocity(400)).toBe(CARPET_GLIDE_MAX_FALL);
  });

  it('parks the rug under the hero and trails behind facing', () => {
    const pos = flyingCarpetPosition(100, 80, 0);
    expect(pos.x).toBe(100);
    expect(pos.y).toBeGreaterThan(80);
    expect(carpetTrailPosition(100, 110, false).x).toBe(100 - CARPET_TRAIL_OFFSET_X);
    expect(carpetTrailPosition(100, 110, true).x).toBe(100 + CARPET_TRAIL_OFFSET_X);
  });
});

describe('flower spring', () => {
  const gravity = themePhysics('grass').gravity;

  it('launches a hop weaker or equal to the 2.5-tile ground jump', () => {
    const spring = flowerSpringVelocity(gravity);
    const jump = themePhysics('grass').jump;
    expect(spring).toBe(launchVelocity(gravity, FLOWER_SPRING_HEIGHT_TILES));
    expect(spring).toBeLessThan(0);
    expect(spring).toBeGreaterThanOrEqual(jump);
    expect(FLOWER_SPRING_HEIGHT_TILES).toBeLessThanOrEqual(JUMP_HEIGHT_TILES);
  });

  it('replaces fall or rise with the spring speed', () => {
    const spring = flowerSpringVelocity(gravity);
    expect(applyFlowerSpring(spring)).toBe(spring);
  });

  it('fires one mid-air tap per airborne sequence', () => {
    expect(
      canFlowerSpring({
        jumpLocked: false,
        grounded: false,
        jumpJust: true,
        used: false,
      }),
    ).toBe(true);
  });

  it('rejects locked, grounded, held, or already-used springs', () => {
    const ready = {
      jumpLocked: false,
      grounded: false,
      jumpJust: true,
      used: false,
    };
    expect(canFlowerSpring({ ...ready, jumpLocked: true })).toBe(false);
    expect(canFlowerSpring({ ...ready, grounded: true })).toBe(false);
    expect(canFlowerSpring({ ...ready, jumpJust: false })).toBe(false);
    expect(canFlowerSpring({ ...ready, used: true })).toBe(false);
  });

  it('spawns the pad under the feet', () => {
    const pos = flowerSpringSpawn(100, 80);
    expect(pos.x).toBe(100);
    expect(pos.y).toBeGreaterThan(80);
  });
});

describe('triple jump', () => {
  const gravity = themePhysics('snow').gravity;

  it('keeps the first hop at the campaign 2.5-tile apex', () => {
    expect(tripleJumpHeightTiles(1)).toBe(JUMP_HEIGHT_TILES);
    expect(tripleJumpVelocity(gravity, 1)).toBe(themePhysics('snow').jump);
    const apex = tripleJumpVelocity(gravity, 1) ** 2 / (2 * gravity);
    expect(apex).toBeCloseTo(TILE * JUMP_HEIGHT_TILES);
  });

  it('raises hop 2 and hop 3', () => {
    expect(tripleJumpHeightTiles(2)).toBe(TRIPLE_JUMP_HEIGHT_2_TILES);
    expect(tripleJumpHeightTiles(3)).toBe(TRIPLE_JUMP_HEIGHT_3_TILES);
    const first = tripleJumpVelocity(gravity, 1);
    const second = tripleJumpVelocity(gravity, 2);
    const third = tripleJumpVelocity(gravity, 3);
    expect(second).toBeLessThan(first);
    expect(third).toBeLessThan(second);
  });

  it('advances only inside the run-up window', () => {
    expect(
      nextTripleJumpStep({
        previousStep: 1,
        now: 500,
        chainUntil: 500 + TRIPLE_JUMP_WINDOW_MS,
        velocityX: TRIPLE_JUMP_MIN_SPEED + 1,
      }),
    ).toBe(2);
    expect(
      nextTripleJumpStep({
        previousStep: 2,
        now: 500,
        chainUntil: 500 + TRIPLE_JUMP_WINDOW_MS,
        velocityX: -(TRIPLE_JUMP_MIN_SPEED + 20),
      }),
    ).toBe(3);
  });

  it('resets when the window expires, you stop, or the chain finishes', () => {
    const running = {
      previousStep: 1 as const,
      now: 1000,
      chainUntil: 500,
      velocityX: 200,
    };
    expect(nextTripleJumpStep(running)).toBe(1);
    expect(nextTripleJumpStep({ ...running, chainUntil: 1200, velocityX: 0 })).toBe(1);
    expect(nextTripleJumpStep({ ...running, previousStep: 0, chainUntil: 1200 })).toBe(1);
    expect(nextTripleJumpStep({ ...running, previousStep: 3, chainUntil: 1200 })).toBe(1);
  });

  it('keeps the chain live in air, and on the ground only while running in-window', () => {
    expect(
      tripleChainLive({
        chainStep: 1,
        now: 200,
        chainUntil: 100,
        grounded: false,
        velocityX: 0,
      }),
    ).toBe(true);
    expect(
      tripleChainLive({
        chainStep: 1,
        now: 200,
        chainUntil: 400,
        grounded: true,
        velocityX: 120,
      }),
    ).toBe(true);
    expect(
      tripleChainLive({
        chainStep: 1,
        now: 500,
        chainUntil: 400,
        grounded: true,
        velocityX: 120,
      }),
    ).toBe(false);
    expect(
      tripleChainLive({
        chainStep: 1,
        now: 200,
        chainUntil: 400,
        grounded: true,
        velocityX: 0,
      }),
    ).toBe(false);
    expect(
      tripleChainLive({
        chainStep: 0,
        now: 200,
        chainUntil: 400,
        grounded: false,
        velocityX: 200,
      }),
    ).toBe(false);
  });

  it('parks ice skates and the burst under the feet', () => {
    const skates = iceSkatePosition(100, 80, 0);
    const flash = iceFlashSpawn(100, 80);
    expect(skates.x).toBe(100);
    expect(skates.y).toBeGreaterThan(80);
    expect(flash.y).toBeGreaterThan(80);
  });
});

describe('ghost hover', () => {
  it('only slows a held falling jump', () => {
    expect(canGhostHover({ jumpHeld: true, grounded: false, velocityY: 80 })).toBe(true);
    expect(canGhostHover({ jumpHeld: false, grounded: false, velocityY: 80 })).toBe(false);
    expect(canGhostHover({ jumpHeld: true, grounded: true, velocityY: 80 })).toBe(false);
    expect(canGhostHover({ jumpHeld: true, grounded: false, velocityY: 20 })).toBe(false);
  });

  it('floats harder than the carpet and still lets you land', () => {
    expect(ghostHoverVelocity(-120)).toBe(-120);
    expect(ghostHoverVelocity(80)).toBeCloseTo(80 * GHOST_HOVER_DAMP);
    expect(ghostHoverVelocity(400)).toBe(GHOST_HOVER_MAX_FALL);
    expect(GHOST_HOVER_DAMP).toBeLessThan(CARPET_GLIDE_DAMP);
    expect(GHOST_HOVER_MAX_FALL).toBeLessThan(CARPET_GLIDE_MAX_FALL);
    expect(GHOST_HOVER_MAX_FALL).toBeGreaterThan(0);
  });

  it('wraps a shroud around the hero', () => {
    const pos = ghostShroudPosition(100, 80, 0);
    expect(pos.x).toBe(100);
    expect(pos.y).toBeGreaterThan(80);
  });
});

describe('feather flutter', () => {
  it('only beats a held falling jump', () => {
    expect(canFeatherFlutter({ jumpHeld: true, grounded: false, velocityY: 40 })).toBe(true);
    expect(canFeatherFlutter({ jumpHeld: false, grounded: false, velocityY: 40 })).toBe(false);
    expect(canFeatherFlutter({ jumpHeld: true, grounded: true, velocityY: 40 })).toBe(false);
    expect(canFeatherFlutter({ jumpHeld: true, grounded: false, velocityY: -20 })).toBe(false);
  });

  it('oscillates descent instead of sliding at one cap', () => {
    expect(featherFlutterVelocity(-80, 0)).toBe(-80);
    const rest = featherFlutterVelocity(400, 0);
    const drop = featherFlutterVelocity(400, FEATHER_FLUTTER_PERIOD_MS / 4);
    const lift = featherFlutterVelocity(400, (FEATHER_FLUTTER_PERIOD_MS * 3) / 4);
    expect(rest).toBeCloseTo(FEATHER_FLUTTER_BASE_FALL);
    expect(drop).toBeCloseTo(FEATHER_FLUTTER_BASE_FALL + FEATHER_FLUTTER_AMP);
    expect(lift).toBeCloseTo(FEATHER_FLUTTER_BASE_FALL - FEATHER_FLUTTER_AMP);
    expect(drop).not.toBeCloseTo(lift);
  });

  it('parks the leaf under the hero and beats it', () => {
    const rest = featherLeafPosition(100, 80, 0);
    const beat = featherLeafPosition(100, 80, FEATHER_FLUTTER_PERIOD_MS / 4);
    expect(rest.x).toBe(100);
    expect(rest.y).toBeGreaterThan(80);
    expect(beat.y).not.toBeCloseTo(rest.y);
  });
});

describe('parasol hang', () => {
  it('only hangs on a held falling jump', () => {
    expect(canParasolHang({ jumpHeld: true, grounded: false, velocityY: 80 })).toBe(true);
    expect(canParasolHang({ jumpHeld: false, grounded: false, velocityY: 80 })).toBe(false);
    expect(canParasolHang({ jumpHeld: true, grounded: true, velocityY: 80 })).toBe(false);
    expect(canParasolHang({ jumpHeld: true, grounded: false, velocityY: 20 })).toBe(false);
  });

  it('floats more than castle hover', () => {
    expect(parasolHangVelocity(-120)).toBe(-120);
    expect(parasolHangVelocity(80)).toBeCloseTo(80 * PARASOL_HANG_DAMP);
    expect(parasolHangVelocity(400)).toBe(PARASOL_HANG_MAX_FALL);
    expect(PARASOL_HANG_DAMP).toBeLessThan(GHOST_HOVER_DAMP);
    expect(PARASOL_HANG_MAX_FALL).toBeLessThan(GHOST_HOVER_MAX_FALL);
    expect(PARASOL_HANG_MAX_FALL).toBeGreaterThan(0);
  });

  it('parks the parasol above the hero', () => {
    const pos = parasolPosition(100, 80, 0);
    expect(pos.x).toBe(100);
    expect(pos.y).toBeLessThan(80);
  });
});

describe('awning wall jump', () => {
  const ready = {
    grounded: false,
    jumpJust: true,
    jumpLocked: false,
    touchingLeft: true,
    touchingRight: false,
    lastSide: 0 as const,
  };

  it('launches only from a newly touched wall side', () => {
    expect(awningWallJumpSide(ready)).toBe(-1);
    expect(awningWallJumpSide({ ...ready, touchingLeft: false, touchingRight: true })).toBe(1);
    expect(awningWallJumpSide({ ...ready, lastSide: -1 })).toBe(0);
    expect(awningWallJumpSide({ ...ready, jumpJust: false })).toBe(0);
    expect(awningWallJumpSide({ ...ready, grounded: true })).toBe(0);
  });

  it('launches upward and away from the wall', () => {
    const gravity = themePhysics('rainy-city').gravity;
    expect(awningWallJumpVelocity(gravity, -1).x).toBeGreaterThan(0);
    expect(awningWallJumpVelocity(gravity, 1).x).toBeLessThan(0);
    expect(awningWallJumpVelocity(gravity, -1).y).toBeLessThan(themePhysics('rainy-city').jump);
  });
});
