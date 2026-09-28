import Phaser from 'phaser';
import { TILE } from '../config';
import { drawBackroomsScenery } from './backrooms-scenery';
import { paintCanvas, rgba, rng, type Ctx } from './canvas-paint';
import { drawEscapeTextures } from './escape-textures';

export const NOCLIP_TILE_KEY = 'noclip-tile';
export const NOCLIP_TILE_GLITCH_KEY = 'noclip-tile-glitch';
export const NOCLIP_GLOW_KEY = 'noclip-glow';
export const NOCLIP_SHARD_KEY = 'noclip-shard';

/** Damp, mustard office carpet: mottled pile, loops of fibre and a few water stains. */
function paintCarpet(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number): void {
  const rand = rng(seed);
  ctx.fillStyle = rgba(0xb09446);
  ctx.fillRect(x, y, w, h);
  const tones = [0x9c8038, 0xa88c40, 0xbca050, 0xc6aa5a, 0x8e7432];
  for (let i = 0; i < w * h * 0.32; i += 1) {
    ctx.fillStyle = rgba(tones[Math.floor(rand() * tones.length)] ?? 0xb09446, 0.55 + rand() * 0.45);
    ctx.fillRect(x + Math.floor(rand() * w), y + Math.floor(rand() * h), 1, rand() < 0.4 ? 2 : 1);
  }
  for (let i = 0; i < 3; i += 1) {
    const cx = x + rand() * w;
    const cy = y + h * 0.3 + rand() * h * 0.7;
    const r = 6 + rand() * 12;
    const stain = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
    stain.addColorStop(0, rgba(0x6a5420, 0.32));
    stain.addColorStop(0.7, rgba(0x6a5420, 0.16));
    stain.addColorStop(1, rgba(0x6a5420, 0));
    ctx.fillStyle = stain;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 1.3, r * 0.8, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintNoclipBase(ctx: Ctx): void {
  paintCarpet(ctx, 0, 0, TILE, TILE, 0x0c1a9);
  const seep = ctx.createLinearGradient(0, 0, 0, 10);
  seep.addColorStop(0, rgba(0xfff6c8, 0.75));
  seep.addColorStop(1, rgba(0xfff6c8, 0));
  ctx.fillStyle = seep;
  ctx.fillRect(0, 0, TILE, 10);
  ctx.strokeStyle = rgba(0x4a3c14, 0.9);
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, TILE - 2, TILE - 2);
  ctx.strokeStyle = rgba(0xfff0a0, 0.55);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(3, 3.5);
  ctx.lineTo(TILE - 3, 3.5);
  ctx.stroke();
  ctx.fillStyle = rgba(0xff2a8a, 0.16);
  ctx.fillRect(0, 0, 1, TILE);
  ctx.fillStyle = rgba(0x29e5ff, 0.16);
  ctx.fillRect(TILE - 1, 0, 1, TILE);
  ctx.fillStyle = rgba(0x141208, 0.9);
  ctx.fillRect(44, 22, 4, 2);
  ctx.fillRect(12, 46, 2, 2);
  for (let cy = 0; cy < 2; cy += 1) {
    for (let cx = 0; cx < 2; cx += 1) {
      ctx.fillStyle = (cx + cy) % 2 === 0 ? rgba(0xff00dc) : rgba(0x0a0a0a);
      ctx.fillRect(54 + cx * 2, 54 + cy * 2, 2, 2);
    }
  }
}

function drawNoclipTiles(scene: Phaser.Scene): void {
  paintCanvas(scene, NOCLIP_TILE_KEY, TILE, TILE, paintNoclipBase);
  paintCanvas(scene, NOCLIP_TILE_GLITCH_KEY, TILE, TILE, (ctx) => {
    paintNoclipBase(ctx);
    const rand = rng(0x9117c4);
    for (let band = 0; band < 6; band += 1) {
      const y = Math.floor(rand() * (TILE - 6));
      const h = 2 + Math.floor(rand() * 5);
      const shift = Math.round((rand() - 0.5) * 18);
      const slice = ctx.getImageData(0, y, TILE, h);
      ctx.putImageData(slice, shift, y);
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(0xff2a8a, 0.3);
    ctx.fillRect(3, 0, 4, TILE);
    ctx.fillStyle = rgba(0x29e5ff, 0.3);
    ctx.fillRect(TILE - 7, 0, 4, TILE);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = rgba(0x000000, 0.85);
    ctx.fillRect(18, 30, 14, 3);
    ctx.fillRect(38, 12, 6, 6);
  });
  paintCanvas(scene, NOCLIP_GLOW_KEY, 112, 72, (ctx) => {
    const glow = ctx.createRadialGradient(56, 72, 2, 56, 72, 64);
    glow.addColorStop(0, rgba(0xfff4b0, 0.7));
    glow.addColorStop(0.5, rgba(0xffe98a, 0.22));
    glow.addColorStop(1, rgba(0xffe98a, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 112, 72);
  });
  paintCanvas(scene, NOCLIP_SHARD_KEY, 8, 8, (ctx) => {
    ctx.fillStyle = rgba(0xd8c070);
    ctx.fillRect(0, 0, 8, 8);
    ctx.fillStyle = rgba(0xff2a8a, 0.8);
    ctx.fillRect(0, 0, 2, 8);
    ctx.fillStyle = rgba(0x29e5ff, 0.8);
    ctx.fillRect(6, 0, 2, 8);
  });
}

/* ------------------------------------------------------------------------------------------
 * The stalker: a gaunt, pitch-black figure with reverse knees and arms that hang past them.
 * Every frame is posed as a skeleton and skinned with tapered strokes, so the gait stays
 * consistent across run, leap, fall, climb, and idle.
 * ---------------------------------------------------------------------------------------- */

export const ENTITY_FRAME_W = 144;
export const ENTITY_FRAME_H = 184;
/** Row of the feet in every standing frame. */
export const ENTITY_BASELINE = 180;
export const ENTITY_HIP_X = 62;

export type EntityFrameKind = 'run' | 'leap' | 'fall' | 'climb' | 'idle';

export const ENTITY_FRAME_COUNTS: Record<EntityFrameKind, number> = {
  run: 8,
  leap: 2,
  fall: 2,
  climb: 4,
  idle: 2,
};

export const ENTITY_GLITCH_KEY = 'entity-glitch';

export function entityFrameKey(kind: EntityFrameKind, index: number): string {
  return `entity-${kind}-${index % ENTITY_FRAME_COUNTS[kind]}`;
}

const THIGH = 44;
const SHIN = 48;
const FOOT = 17;
const TORSO = 58;
const NECK = 17;
const UPPER_ARM = 47;
const FOREARM = 50;
const FINGER = 12;

interface Pt {
  x: number;
  y: number;
}

interface LegPose {
  thigh: number;
  shin: number;
  foot: number;
}

interface ArmPose {
  upper: number;
  fore: number;
  hand: number;
  spread: number;
}

interface EntityPose {
  /** Torso tilt from vertical; positive leans toward the facing direction. */
  lean: number;
  /** Spine curvature in px, pushed toward the back. */
  hunch: number;
  neck: number;
  headTilt: number;
  /** [far, near]. Angles are from straight down; positive swings forward. */
  legs: [LegPose, LegPose];
  arms: [ArmPose, ArmPose];
  /** Pin the hip instead of standing the lowest foot on the baseline. */
  hipY?: number;
}

interface EntityInk {
  near: string;
  far: string;
  rim: string;
  rimFar: string;
  bone: string;
}

const INK: EntityInk = {
  near: 'rgba(3,3,4,1)',
  far: 'rgba(16,15,16,1)',
  rim: 'rgba(74,68,52,0.55)',
  rimFar: 'rgba(74,68,52,0.28)',
  bone: 'rgba(92,88,74,0.34)',
};

function reach(from: Pt, len: number, angle: number): Pt {
  return { x: from.x + Math.sin(angle) * len, y: from.y + Math.cos(angle) * len };
}

function taper(ctx: Ctx, a: Pt, b: Pt, wa: number, wb: number): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.max(0.001, Math.hypot(dx, dy));
  const nx = -dy / len;
  const ny = dx / len;
  ctx.beginPath();
  ctx.moveTo(a.x + (nx * wa) / 2, a.y + (ny * wa) / 2);
  ctx.lineTo(b.x + (nx * wb) / 2, b.y + (ny * wb) / 2);
  ctx.lineTo(b.x - (nx * wb) / 2, b.y - (ny * wb) / 2);
  ctx.lineTo(a.x - (nx * wa) / 2, a.y - (ny * wa) / 2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(a.x, a.y, wa / 2, 0, Math.PI * 2);
  ctx.arc(b.x, b.y, wb / 2, 0, Math.PI * 2);
  ctx.fill();
}

function knob(ctx: Ctx, p: Pt, r: number): void {
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
}

interface Skeleton {
  hip: Pt;
  shoulder: Pt;
  neckTop: Pt;
  head: Pt;
  headAngle: number;
  legs: Array<{ knee: Pt; ankle: Pt; toe: Pt; pose: LegPose }>;
  arms: Array<{ elbow: Pt; wrist: Pt; pose: ArmPose }>;
  torsoDir: Pt;
  torsoNormal: Pt;
}

function solveSkeleton(pose: EntityPose): Skeleton {
  const solve = (hip: Pt): Skeleton => {
    const torsoDir = { x: Math.sin(pose.lean), y: -Math.cos(pose.lean) };
    const torsoNormal = { x: Math.cos(pose.lean), y: Math.sin(pose.lean) };
    const shoulder = { x: hip.x + torsoDir.x * TORSO, y: hip.y + torsoDir.y * TORSO };
    const neckAngle = pose.lean + pose.neck;
    const neckTop = { x: shoulder.x + Math.sin(neckAngle) * NECK, y: shoulder.y - Math.cos(neckAngle) * NECK };
    const headAngle = neckAngle + pose.headTilt;
    const head = { x: neckTop.x + Math.sin(headAngle) * 7, y: neckTop.y - Math.cos(headAngle) * 7 };
    const legs = pose.legs.map((leg) => {
      const knee = reach(hip, THIGH, leg.thigh);
      const ankle = reach(knee, SHIN, leg.shin);
      return { knee, ankle, toe: reach(ankle, FOOT, leg.foot), pose: leg };
    });
    const armRoot = { x: shoulder.x - torsoNormal.x * 2, y: shoulder.y + 3 };
    const arms = pose.arms.map((arm) => {
      const elbow = reach(armRoot, UPPER_ARM, arm.upper);
      return { elbow, wrist: reach(elbow, FOREARM, arm.fore), pose: arm };
    });
    return { hip, shoulder, neckTop, head, headAngle, legs, arms, torsoDir, torsoNormal };
  };
  if (pose.hipY !== undefined) {
    return solve({ x: ENTITY_HIP_X, y: pose.hipY });
  }
  const probe = solve({ x: ENTITY_HIP_X, y: 0 });
  const lowest = Math.max(...probe.legs.flatMap((leg) => [leg.ankle.y, leg.toe.y]));
  return solve({ x: ENTITY_HIP_X, y: ENTITY_BASELINE - lowest });
}

function paintLeg(ctx: Ctx, hip: Pt, leg: Skeleton['legs'][number], grow: number): void {
  taper(ctx, hip, leg.knee, 9 + grow, 5.5 + grow);
  knob(ctx, leg.knee, 4.2 + grow / 2);
  taper(ctx, leg.knee, leg.ankle, 5 + grow, 3 + grow);
  knob(ctx, leg.ankle, 2.6 + grow / 2);
  taper(ctx, leg.ankle, leg.toe, 3 + grow, 1.2 + grow);
  for (const splay of [-0.35, 0.3]) {
    const claw = reach(leg.ankle, FOOT * 0.8, leg.pose.foot + splay);
    taper(ctx, leg.ankle, claw, 2 + grow, 0.8 + grow);
  }
}

function paintArm(ctx: Ctx, shoulder: Pt, arm: Skeleton['arms'][number], grow: number): void {
  const root = { x: shoulder.x, y: shoulder.y + 3 };
  taper(ctx, root, arm.elbow, 6.5 + grow, 4 + grow);
  knob(ctx, arm.elbow, 3.3 + grow / 2);
  taper(ctx, arm.elbow, arm.wrist, 4 + grow, 2.6 + grow);
  const palm = reach(arm.wrist, 6, arm.pose.fore + arm.pose.hand);
  taper(ctx, arm.wrist, palm, 4 + grow, 4.4 + grow);
  const fan = [-0.3, -0.1, 0.1, 0.3];
  for (const [i, offset] of fan.entries()) {
    const base = arm.pose.fore + arm.pose.hand + offset * arm.pose.spread;
    const long = i === 1 || i === 2 ? 1.2 : 1;
    const mid = reach(palm, FINGER * long, base);
    const tip = reach(mid, FINGER * 0.85 * long, base + 0.38);
    taper(ctx, palm, mid, 1.9 + grow, 1.3 + grow);
    taper(ctx, mid, tip, 1.3 + grow, 0.5 + grow);
  }
  const thumb = reach(palm, FINGER * 0.8, arm.pose.fore + arm.pose.hand - 0.75 * arm.pose.spread - 0.3);
  taper(ctx, palm, thumb, 1.8 + grow, 0.6 + grow);
}

function paintTorso(ctx: Ctx, s: Skeleton, hunch: number, grow: number): void {
  const half = (t: number): number => {
    if (t < 0.25) {
      return 6.2 - t * 6;
    }
    if (t < 0.7) {
      return 4.4 + (t - 0.25) * 9;
    }
    return 8.4 + (t - 0.7) * 3;
  };
  const front: Pt[] = [];
  const back: Pt[] = [];
  for (let i = 0; i <= 12; i += 1) {
    const t = i / 12;
    const c = { x: s.hip.x + s.torsoDir.x * TORSO * t, y: s.hip.y + s.torsoDir.y * TORSO * t };
    const w = half(t) + grow / 2;
    const bow = hunch * Math.sin(Math.PI * Math.min(1, t * 1.1));
    front.push({ x: c.x + s.torsoNormal.x * w, y: c.y + s.torsoNormal.y * w });
    back.push({ x: c.x - s.torsoNormal.x * (w + bow), y: c.y - s.torsoNormal.y * (w + bow) });
  }
  ctx.beginPath();
  ctx.moveTo(front[0]!.x, front[0]!.y);
  for (const p of front) {
    ctx.lineTo(p.x, p.y);
  }
  for (const p of back.reverse()) {
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fill();
  taper(ctx, s.shoulder, s.neckTop, 3.4 + grow, 2.6 + grow);
}

function paintHead(ctx: Ctx, s: Skeleton, grow: number): void {
  ctx.save();
  ctx.translate(s.head.x, s.head.y);
  ctx.rotate(s.headAngle);
  ctx.beginPath();
  ctx.ellipse(0, 0, 5.4 + grow / 2, 8.6 + grow / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(1 - grow / 2, 5);
  ctx.lineTo(5 + grow, 10 + grow);
  ctx.lineTo(-2 - grow / 2, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function paintRibs(ctx: Ctx, s: Skeleton, ink: EntityInk): void {
  ctx.strokeStyle = ink.bone;
  ctx.lineWidth = 1;
  for (const t of [0.5, 0.6, 0.7, 0.8]) {
    const c = { x: s.hip.x + s.torsoDir.x * TORSO * t, y: s.hip.y + s.torsoDir.y * TORSO * t };
    ctx.beginPath();
    ctx.moveTo(c.x - s.torsoNormal.x * 3, c.y - s.torsoNormal.y * 3);
    ctx.quadraticCurveTo(
      c.x + s.torsoNormal.x * 4,
      c.y + s.torsoNormal.y * 4 + 2,
      c.x + s.torsoNormal.x * 7.5,
      c.y + s.torsoNormal.y * 7.5 + 3,
    );
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(s.hip.x - s.torsoNormal.x * 2, s.hip.y - s.torsoNormal.y * 2);
  ctx.lineTo(s.shoulder.x - s.torsoNormal.x * 3, s.shoulder.y - s.torsoNormal.y * 3);
  ctx.stroke();
}

function paintEntity(ctx: Ctx, pose: EntityPose, ink: EntityInk = INK, dx = 0): void {
  const s = solveSkeleton(pose);
  ctx.save();
  ctx.translate(dx, 0);
  const [farLeg, nearLeg] = s.legs;
  const [farArm, nearArm] = s.arms;
  const layer = (fill: string, grow: number, near: boolean): void => {
    ctx.fillStyle = fill;
    if (near) {
      paintLeg(ctx, s.hip, nearLeg!, grow);
      paintTorso(ctx, s, pose.hunch, grow);
      paintHead(ctx, s, grow);
      paintArm(ctx, s.shoulder, nearArm!, grow);
    } else {
      paintLeg(ctx, s.hip, farLeg!, grow);
      paintArm(ctx, s.shoulder, farArm!, grow);
    }
  };
  layer(ink.rimFar, 2.4, false);
  layer(ink.far, 0, false);
  layer(ink.rim, 2.4, true);
  layer(ink.near, 0, true);
  paintRibs(ctx, s, ink);
  ctx.fillStyle = 'rgba(210,205,180,0.28)';
  ctx.save();
  ctx.translate(s.head.x, s.head.y);
  ctx.rotate(s.headAngle);
  ctx.fillRect(1.5, -2, 1.4, 1.4);
  ctx.restore();
  ctx.restore();
}

function runPose(i: number): EntityPose {
  const p = (i / ENTITY_FRAME_COUNTS.run) * Math.PI * 2;
  const leg = (phase: number, limp: number): LegPose => {
    const swing = Math.sin(phase);
    const lift = Math.max(0, Math.cos(phase));
    const thigh = -0.26 + 0.4 * swing;
    const shin = thigh + (0.42 + 0.62 * lift) * limp;
    return { thigh, shin, foot: shin + 0.95 };
  };
  const arm = (phase: number): ArmPose => {
    const swing = Math.sin(phase);
    const upper = 0.08 + 0.42 * swing;
    return { upper, fore: upper + 0.12 + 0.28 * Math.max(0, swing), hand: 0.18, spread: 1 };
  };
  return {
    lean: 0.36 + 0.07 * Math.sin(p * 2),
    hunch: 6,
    neck: 0.35,
    headTilt: 0.42 + 0.14 * Math.sin(p * 2 + 1),
    legs: [leg(p + Math.PI, 1.2), leg(p, 1)],
    arms: [arm(p), arm(p + Math.PI)],
  };
}

const LEAP_POSES: EntityPose[] = [
  {
    lean: 0.72,
    hunch: 8,
    neck: 0.2,
    headTilt: 0.5,
    legs: [
      { thigh: -0.95, shin: 0.55, foot: 1.5 },
      { thigh: -0.7, shin: 0.75, foot: 1.6 },
    ],
    arms: [
      { upper: -0.8, fore: -0.5, hand: 0.1, spread: 0.9 },
      { upper: -0.6, fore: -0.35, hand: 0.1, spread: 0.9 },
    ],
  },
  {
    lean: 0.55,
    hunch: 5,
    neck: 0.1,
    headTilt: 0.2,
    legs: [
      { thigh: -0.7, shin: -0.1, foot: 0.9 },
      { thigh: 0.9, shin: 1.9, foot: 2.6 },
    ],
    arms: [
      { upper: 1.7, fore: 2.0, hand: 0.1, spread: 1.4 },
      { upper: 1.95, fore: 2.15, hand: 0.05, spread: 1.5 },
    ],
  },
];

const FALL_POSES: EntityPose[] = [
  {
    lean: -0.08,
    hunch: 3,
    neck: 0.1,
    headTilt: -0.5,
    hipY: 130,
    legs: [
      { thigh: 0.25, shin: 0.7, foot: 1.6 },
      { thigh: -0.35, shin: 0.1, foot: 1.2 },
    ],
    arms: [
      { upper: -1.75, fore: -2.2, hand: -0.2, spread: 1.6 },
      { upper: 1.7, fore: 2.1, hand: 0.2, spread: 1.6 },
    ],
  },
  {
    lean: 0.06,
    hunch: 3,
    neck: -0.1,
    headTilt: 0.6,
    hipY: 130,
    legs: [
      { thigh: -0.2, shin: 0.25, foot: 1.3 },
      { thigh: 0.4, shin: 0.95, foot: 1.8 },
    ],
    arms: [
      { upper: -1.95, fore: -2.45, hand: -0.3, spread: 1.8 },
      { upper: 1.9, fore: 2.3, hand: 0.3, spread: 1.8 },
    ],
  },
];

function climbPose(i: number): EntityPose {
  const reachUp = i % 2 === 0;
  const pull = i >= 2 ? 0.12 : 0;
  return {
    lean: 0.1 + pull,
    hunch: 5,
    neck: 0.05,
    headTilt: i % 2 === 0 ? -0.3 : 0.3,
    hipY: 186 - i * 3,
    legs: [
      { thigh: 0.35, shin: 0.9, foot: 1.8 },
      { thigh: -0.25, shin: 0.3, foot: 1.4 },
    ],
    arms: [
      reachUp
        ? { upper: 2.95, fore: 3.05, hand: 0.1, spread: 1.3 }
        : { upper: 2.5, fore: 3.4, hand: 0.4, spread: 1.1 },
      reachUp
        ? { upper: 2.55, fore: 3.35, hand: 0.4, spread: 1.1 }
        : { upper: 3.0, fore: 3.12, hand: 0.1, spread: 1.3 },
    ],
  };
}

function idlePose(i: number): EntityPose {
  return {
    lean: 0.2,
    hunch: 8,
    neck: 0.45,
    headTilt: i === 0 ? 0.6 : -0.35,
    legs: [
      { thigh: 0.05, shin: 0.5, foot: 1.35 },
      { thigh: -0.18, shin: 0.38, foot: 1.3 },
    ],
    arms: [
      { upper: 0.05, fore: 0.12, hand: 0.1, spread: 0.7 },
      { upper: 0.16, fore: 0.24 + i * 0.08, hand: 0.15, spread: i === 0 ? 0.8 : 1.5 },
    ],
  };
}

function poseFor(kind: EntityFrameKind, i: number): EntityPose {
  switch (kind) {
    case 'run':
      return runPose(i);
    case 'leap':
      return LEAP_POSES[i] ?? LEAP_POSES[0]!;
    case 'fall':
      return FALL_POSES[i] ?? FALL_POSES[0]!;
    case 'climb':
      return climbPose(i);
    case 'idle':
      return idlePose(i);
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

function drawEntityFrames(scene: Phaser.Scene): void {
  const kinds: EntityFrameKind[] = ['run', 'leap', 'fall', 'climb', 'idle'];
  for (const kind of kinds) {
    for (let i = 0; i < ENTITY_FRAME_COUNTS[kind]; i += 1) {
      paintCanvas(scene, entityFrameKey(kind, i), ENTITY_FRAME_W, ENTITY_FRAME_H, (ctx) => {
        paintEntity(ctx, poseFor(kind, i));
      });
    }
  }
  paintCanvas(scene, ENTITY_GLITCH_KEY, ENTITY_FRAME_W, ENTITY_FRAME_H, (ctx) => {
    const pose = runPose(3);
    const tint = (color: string): EntityInk => ({ near: color, far: color, rim: 'rgba(0,0,0,0)', rimFar: 'rgba(0,0,0,0)', bone: 'rgba(0,0,0,0)' });
    paintEntity(ctx, pose, tint('rgba(255,20,70,0.5)'), -4);
    paintEntity(ctx, pose, tint('rgba(20,230,255,0.45)'), 4);
    paintEntity(ctx, pose);
    const rand = rng(0xe771);
    for (let band = 0; band < 7; band += 1) {
      const y = Math.floor(rand() * (ENTITY_FRAME_H - 10));
      const h = 3 + Math.floor(rand() * 8);
      const slice = ctx.getImageData(0, y, ENTITY_FRAME_W, h);
      ctx.clearRect(0, y, ENTITY_FRAME_W, h);
      ctx.putImageData(slice, Math.round((rand() - 0.5) * 22), y);
    }
  });
}

export function createBackroomsTextures(scene: Phaser.Scene): void {
  drawNoclipTiles(scene);
  drawEntityFrames(scene);
  drawEscapeTextures(scene);
  drawBackroomsScenery(scene);
}
