import Phaser from 'phaser';
import { paintCanvas, rgba, rng, type Ctx } from './canvas-paint';

export const CONSOLE_KEY = 'escape-console';
export const CONSOLE_W = 112;
export const CONSOLE_H = 128;
export const CONSOLE_BUTTON_KEY = 'escape-button';
export const CONSOLE_BUTTON_LIT_KEY = 'escape-button-lit';
export const CONSOLE_BUTTON_W = 60;
export const CONSOLE_BUTTON_H = 34;
/** Where the button's base sits on the console, from the console's top-left. */
export const CONSOLE_BUTTON_SEAT = { x: 56, y: 30 };
/** Readout window on the slanted panel, from the console's top-left. */
export const CONSOLE_READOUT = { x: 22, y: 44, w: 30, h: 10 };
export const ALARM_GLOW_KEY = 'escape-alarm-glow';

export const UFO_KEY = 'ufo';
export const UFO_W = 240;
export const UFO_H = 112;
/** Centre of the emitter ring under the hull, from the UFO's top-left. */
export const UFO_EMITTER_Y = 92;
/** Centre of the glass dome, from the UFO's top-left. */
export const UFO_DOME_Y = 34;
/** Rim-light ellipse, relative to the UFO centre. */
export const UFO_RIM = { y: 16, rx: 104, ry: 12 };
export const UFO_LIGHT_KEY = 'ufo-light';
export const UFO_BEAM_KEY = 'ufo-beam';
export const UFO_BEAM_W = 320;
export const UFO_BEAM_H = 480;
export const UFO_BEAM_TOP_W = 76;
export const UFO_STREAK_KEY = 'ufo-streak';

function hazardBand(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = rgba(0xf2c21a);
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = rgba(0x1a1810);
  for (let sx = x - h; sx < x + w + h; sx += 16) {
    ctx.beginPath();
    ctx.moveTo(sx, y + h);
    ctx.lineTo(sx + 8, y + h);
    ctx.lineTo(sx + 8 + h, y);
    ctx.lineTo(sx + h, y);
    ctx.closePath();
    ctx.fill();
  }
  const shade = ctx.createLinearGradient(0, y, 0, y + h);
  shade.addColorStop(0, 'rgba(255,255,255,0.28)');
  shade.addColorStop(0.5, 'rgba(255,255,255,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = shade;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function rivet(ctx: Ctx, x: number, y: number): void {
  ctx.fillStyle = rgba(0x2c3036);
  ctx.beginPath();
  ctx.arc(x, y, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba(0xdce2e8, 0.8);
  ctx.fillRect(x - 1, y - 1.5, 1, 1);
}

/** Brushed steel: a horizontal sheen plus faint vertical grain. */
function steel(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number, dark = 0x5a626c, light = 0xb8c0c8): void {
  const sheen = ctx.createLinearGradient(x, 0, x + w, 0);
  sheen.addColorStop(0, rgba(dark));
  sheen.addColorStop(0.28, rgba(light));
  sheen.addColorStop(0.42, rgba(0xe4e8ec));
  sheen.addColorStop(0.62, rgba(light));
  sheen.addColorStop(1, rgba(dark));
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, w, h);
  const rand = rng(seed);
  for (let i = 0; i < w * 1.5; i += 1) {
    ctx.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(x + Math.floor(rand() * w), y + Math.floor(rand() * h), 1, 2 + Math.floor(rand() * 8));
  }
}

function paintConsole(ctx: Ctx): void {
  const w = CONSOLE_W;
  const h = CONSOLE_H;
  // Floor shadow and plinth.
  ctx.fillStyle = 'rgba(30,22,6,0.4)';
  ctx.beginPath();
  ctx.ellipse(w / 2, h - 3, w / 2 - 4, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  steel(ctx, 8, h - 16, w - 16, 13, 0xc0501, 0x3c424a, 0x8a929c);
  ctx.strokeStyle = rgba(0x1c2024);
  ctx.lineWidth = 2;
  ctx.strokeRect(9, h - 15, w - 18, 11);
  // Pedestal column, narrower than the plinth.
  steel(ctx, 22, 58, w - 44, h - 74, 0xc0502);
  ctx.strokeStyle = rgba(0x23272c);
  ctx.strokeRect(23, 59, w - 46, h - 76);
  // Access hatch with vents and a warning sticker.
  ctx.strokeStyle = rgba(0x3a4048, 0.9);
  ctx.lineWidth = 1;
  ctx.strokeRect(32, 72, w - 64, 30);
  for (let vy = 76; vy < 98; vy += 4) {
    ctx.fillStyle = rgba(0x1e2226, 0.85);
    ctx.fillRect(36, vy, 22, 2);
  }
  ctx.fillStyle = rgba(0xf2c21a);
  ctx.beginPath();
  ctx.moveTo(70, 78);
  ctx.lineTo(79, 94);
  ctx.lineTo(61, 94);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgba(0x1a1810);
  ctx.fillRect(69.2, 83, 1.8, 6);
  ctx.fillRect(69.2, 90.5, 1.8, 1.8);
  rivet(ctx, 27, 64);
  rivet(ctx, w - 27, 64);
  rivet(ctx, 27, h - 22);
  rivet(ctx, w - 27, h - 22);
  hazardBand(ctx, 22, h - 30, w - 44, 8);
  // Slanted control deck, wider than the column.
  ctx.beginPath();
  ctx.moveTo(6, 58);
  ctx.lineTo(w - 6, 58);
  ctx.lineTo(w - 12, 30);
  ctx.lineTo(12, 30);
  ctx.closePath();
  const deck = ctx.createLinearGradient(0, 30, 0, 58);
  deck.addColorStop(0, rgba(0x9aa2ac));
  deck.addColorStop(1, rgba(0x5c646e));
  ctx.fillStyle = deck;
  ctx.fill();
  ctx.strokeStyle = rgba(0x1e2226);
  ctx.lineWidth = 2;
  ctx.stroke();
  hazardBand(ctx, 6, 56, w - 12, 6);
  ctx.strokeStyle = rgba(0x1e2226);
  ctx.strokeRect(6, 56, w - 12, 6);
  // Readout bezel; the glowing digits are drawn live by EscapeConsole.
  const r = CONSOLE_READOUT;
  ctx.fillStyle = rgba(0x14181c);
  ctx.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
  ctx.fillStyle = rgba(0x0a1a10);
  ctx.fillRect(r.x, r.y, r.w, r.h);
  // Toggle switches and a key slot on the right of the deck.
  for (let i = 0; i < 3; i += 1) {
    const sx = 72 + i * 9;
    ctx.fillStyle = rgba(0x23272c);
    ctx.fillRect(sx - 2, 45, 5, 8);
    ctx.fillStyle = rgba(0xd8dde2);
    ctx.fillRect(sx - 1, i === 1 ? 42 : 46, 3, 5);
  }
  // Button collar: a dark bezel ring the dome sits in.
  const seat = CONSOLE_BUTTON_SEAT;
  ctx.fillStyle = rgba(0x1a1c20);
  ctx.beginPath();
  ctx.ellipse(seat.x, seat.y, 32, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(0xb8c0c8, 0.9);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(seat.x, seat.y - 1, 32, 8, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = rgba(0x2a0808);
  ctx.beginPath();
  ctx.ellipse(seat.x, seat.y, 26, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Big glossy red dome with a specular highlight; `lit` glows from inside. */
function paintButton(ctx: Ctx, lit: boolean): void {
  const cx = CONSOLE_BUTTON_W / 2;
  const base = CONSOLE_BUTTON_H - 6;
  const rx = 25;
  const ry = 22;
  if (lit) {
    const halo = ctx.createRadialGradient(cx, base - 10, 4, cx, base - 10, 30);
    halo.addColorStop(0, 'rgba(255,90,70,0.55)');
    halo.addColorStop(1, 'rgba(255,40,30,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, CONSOLE_BUTTON_W, CONSOLE_BUTTON_H);
  }
  ctx.fillStyle = rgba(lit ? 0x8a1410 : 0x5a0a08);
  ctx.beginPath();
  ctx.ellipse(cx, base, rx, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, base, rx, ry, 0, Math.PI, Math.PI * 2);
  ctx.closePath();
  const dome = ctx.createRadialGradient(cx - 7, base - ry * 0.7, 2, cx, base - 6, rx + 4);
  dome.addColorStop(0, rgba(lit ? 0xffd0c0 : 0xff8a78));
  dome.addColorStop(0.25, rgba(lit ? 0xff4a34 : 0xe8261c));
  dome.addColorStop(0.75, rgba(lit ? 0xd01c12 : 0xa81008));
  dome.addColorStop(1, rgba(0x5a0806));
  ctx.fillStyle = dome;
  ctx.fill();
  ctx.strokeStyle = rgba(0x3a0404);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(cx - 9, base - ry + 7, 7, 3.5, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx + 11, base - 7, 3, 5, 0.5, 0, Math.PI * 2);
  ctx.fill();
}

function paintRadial(ctx: Ctx, size: number, inner: string, outer: string): void {
  const glow = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  glow.addColorStop(0, inner);
  glow.addColorStop(0.4, inner.replace(/[\d.]+\)$/, '0.45)'));
  glow.addColorStop(1, outer);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
}

/** Classic chrome saucer: lower hull, lit mid-band, upper hull, glass dome with a pilot. */
function paintUfo(ctx: Ctx): void {
  const cx = UFO_W / 2;
  const midY = 58;
  // Emitter glow under the hull.
  const under = ctx.createRadialGradient(cx, UFO_EMITTER_Y, 2, cx, UFO_EMITTER_Y, 42);
  under.addColorStop(0, 'rgba(210,255,220,0.95)');
  under.addColorStop(0.35, 'rgba(120,255,170,0.55)');
  under.addColorStop(1, 'rgba(60,255,140,0)');
  ctx.fillStyle = under;
  ctx.fillRect(cx - 44, UFO_EMITTER_Y - 30, 88, 50);
  // Lower hull.
  ctx.beginPath();
  ctx.ellipse(cx, midY + 6, 92, 26, 0, 0, Math.PI);
  ctx.closePath();
  const lower = ctx.createLinearGradient(0, midY, 0, midY + 32);
  lower.addColorStop(0, rgba(0x8a96a4));
  lower.addColorStop(0.5, rgba(0x4a5460));
  lower.addColorStop(1, rgba(0x222830));
  ctx.fillStyle = lower;
  ctx.fill();
  ctx.strokeStyle = rgba(0x14181e);
  ctx.lineWidth = 2;
  ctx.stroke();
  // Hull panel seams radiating from the emitter.
  ctx.strokeStyle = 'rgba(20,24,30,0.55)';
  ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(cx + i * 10, midY + 30);
    ctx.lineTo(cx + i * 28, midY + 8);
    ctx.stroke();
  }
  // Emitter ring.
  ctx.fillStyle = rgba(0x1a2a22);
  ctx.beginPath();
  ctx.ellipse(cx, UFO_EMITTER_Y - 2, 26, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(190,255,210,0.95)';
  ctx.beginPath();
  ctx.ellipse(cx, UFO_EMITTER_Y - 2, 20, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Wide rim disc with a bright chrome sheen.
  ctx.beginPath();
  ctx.ellipse(cx, midY, UFO_W / 2 - 4, 16, 0, 0, Math.PI * 2);
  const rim = ctx.createLinearGradient(0, midY - 16, 0, midY + 16);
  rim.addColorStop(0, rgba(0xf4f8fc));
  rim.addColorStop(0.35, rgba(0xc4ccd6));
  rim.addColorStop(0.55, rgba(0x7a8694));
  rim.addColorStop(1, rgba(0x3a424c));
  ctx.fillStyle = rim;
  ctx.fill();
  ctx.strokeStyle = rgba(0x14181e);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(cx, midY - 2, UFO_W / 2 - 14, 11, 0, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  // Light sockets along the rim; the chasing bulbs are separate sprites on top.
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI;
    const lx = cx + Math.cos(a) * (UFO_RIM.rx);
    const ly = midY + Math.sin(a) * UFO_RIM.ry;
    ctx.fillStyle = rgba(0x1c2228);
    ctx.beginPath();
    ctx.arc(lx, ly, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Upper hull.
  ctx.beginPath();
  ctx.ellipse(cx, midY - 6, 62, 18, 0, Math.PI, Math.PI * 2);
  ctx.closePath();
  const upper = ctx.createLinearGradient(cx - 62, 0, cx + 62, 0);
  upper.addColorStop(0, rgba(0x5a6470));
  upper.addColorStop(0.35, rgba(0xdce4ec));
  upper.addColorStop(0.55, rgba(0xa8b2be));
  upper.addColorStop(1, rgba(0x48525e));
  ctx.fillStyle = upper;
  ctx.fill();
  ctx.strokeStyle = rgba(0x14181e);
  ctx.lineWidth = 2;
  ctx.stroke();
  // Pilot: a little big-eyed grey silhouette behind the glass.
  const domeY = UFO_DOME_Y;
  ctx.fillStyle = rgba(0x6a9a78);
  ctx.beginPath();
  ctx.ellipse(cx, domeY + 4, 9, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - 7, domeY + 12, 14, 12);
  ctx.fillStyle = rgba(0x0a1410);
  ctx.beginPath();
  ctx.ellipse(cx - 4, domeY + 4, 3.2, 4.6, -0.5, 0, Math.PI * 2);
  ctx.ellipse(cx + 4, domeY + 4, 3.2, 4.6, 0.5, 0, Math.PI * 2);
  ctx.fill();
  // Glass dome.
  ctx.beginPath();
  ctx.ellipse(cx, midY - 18, 34, 38, 0, Math.PI, Math.PI * 2);
  ctx.closePath();
  const glass = ctx.createRadialGradient(cx - 12, domeY - 12, 3, cx, domeY + 6, 42);
  glass.addColorStop(0, 'rgba(230,255,255,0.75)');
  glass.addColorStop(0.35, 'rgba(140,230,255,0.35)');
  glass.addColorStop(1, 'rgba(40,120,170,0.55)');
  ctx.fillStyle = glass;
  ctx.fill();
  ctx.strokeStyle = 'rgba(210,245,255,0.9)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(cx - 16, domeY - 10, 5, 9, 0.5, 0, Math.PI * 2);
  ctx.fill();
  // Dome collar.
  ctx.fillStyle = rgba(0x39424c);
  ctx.fillRect(cx - 36, midY - 20, 72, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(cx - 34, midY - 20, 68, 1);
}

/** Tractor beam: a trapezoid of light, brightest at the core, with faint vertical striations. */
function paintBeam(ctx: Ctx): void {
  const w = UFO_BEAM_W;
  const h = UFO_BEAM_H;
  const top = UFO_BEAM_TOP_W / 2;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(w / 2 - top, 0);
  ctx.lineTo(w / 2 + top, 0);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.clip();
  const across = ctx.createLinearGradient(0, 0, w, 0);
  across.addColorStop(0, 'rgba(90,255,160,0)');
  across.addColorStop(0.2, 'rgba(110,255,170,0.28)');
  across.addColorStop(0.5, 'rgba(220,255,230,0.62)');
  across.addColorStop(0.8, 'rgba(110,255,170,0.28)');
  across.addColorStop(1, 'rgba(90,255,160,0)');
  ctx.fillStyle = across;
  ctx.fillRect(0, 0, w, h);
  const down = ctx.createLinearGradient(0, 0, 0, h);
  down.addColorStop(0, 'rgba(255,255,255,0.5)');
  down.addColorStop(0.25, 'rgba(255,255,255,0.08)');
  down.addColorStop(0.85, 'rgba(0,0,0,0)');
  down.addColorStop(1, 'rgba(160,255,200,0.3)');
  ctx.fillStyle = down;
  ctx.fillRect(0, 0, w, h);
  const rand = rng(0xbea4);
  for (let i = 0; i < 26; i += 1) {
    const t = rand();
    ctx.strokeStyle = `rgba(230,255,240,${0.05 + rand() * 0.12})`;
    ctx.lineWidth = 1 + rand() * 3;
    ctx.beginPath();
    ctx.moveTo(w / 2 + (t - 0.5) * top * 2, 0);
    ctx.lineTo(w / 2 + (t - 0.5) * w, h);
    ctx.stroke();
  }
  ctx.restore();
}

function paintStreak(ctx: Ctx): void {
  const trail = ctx.createLinearGradient(0, 0, 256, 0);
  trail.addColorStop(0, 'rgba(120,255,180,0)');
  trail.addColorStop(0.7, 'rgba(180,255,210,0.5)');
  trail.addColorStop(1, 'rgba(255,255,255,0.95)');
  ctx.fillStyle = trail;
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.lineTo(240, 2);
  ctx.quadraticCurveTo(256, 12, 240, 22);
  ctx.closePath();
  ctx.fill();
}

export function drawEscapeTextures(scene: Phaser.Scene): void {
  paintCanvas(scene, CONSOLE_KEY, CONSOLE_W, CONSOLE_H, paintConsole);
  paintCanvas(scene, CONSOLE_BUTTON_KEY, CONSOLE_BUTTON_W, CONSOLE_BUTTON_H, (ctx) => paintButton(ctx, false));
  paintCanvas(scene, CONSOLE_BUTTON_LIT_KEY, CONSOLE_BUTTON_W, CONSOLE_BUTTON_H, (ctx) => paintButton(ctx, true));
  paintCanvas(scene, ALARM_GLOW_KEY, 160, 160, (ctx) => paintRadial(ctx, 160, 'rgba(255,60,40,0.9)', 'rgba(255,30,20,0)'));
  paintCanvas(scene, UFO_KEY, UFO_W, UFO_H, paintUfo);
  paintCanvas(scene, UFO_LIGHT_KEY, 16, 16, (ctx) => paintRadial(ctx, 16, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)'));
  paintCanvas(scene, UFO_BEAM_KEY, UFO_BEAM_W, UFO_BEAM_H, paintBeam);
  paintCanvas(scene, UFO_STREAK_KEY, 256, 24, paintStreak);
}
