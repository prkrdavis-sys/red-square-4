import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { maybeShake } from '../data/settings';
import {
  BOSS_BLAST_CORE_PEAK,
  BOSS_BLAST_RING_PEAK,
  BOSS_DEATH_BLAST_MS,
  BOSS_FLAK_INDEXES,
  bossFlakCentroid,
  scaleBossFlakPoly,
  type BossFlakPoint,
} from './boss-flak';
import { spawnFlakBurst } from './flak';

export const DEATH_BLAST_MS = 1500;

function track<T extends Phaser.GameObjects.GameObject>(
  bits: Phaser.GameObjects.GameObject[],
  object: T,
): T {
  bits.push(object);
  return object;
}

function burst(
  scene: Phaser.Scene,
  bits: Phaser.GameObjects.GameObject[],
  x: number,
  y: number,
  texture: string,
  config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig,
  count: number,
  depth = 44,
): void {
  const emitter = scene.add.particles(x, y, texture, { ...config, emitting: false });
  emitter.setDepth(depth);
  track(bits, emitter);
  emitter.explode(count);
}

export function spawnDeathBlast(scene: Phaser.Scene, x: number, y: number, flipX = false): void {
  const bits: Phaser.GameObjects.GameObject[] = [];
  const cleanup = (): void => {
    for (const bit of bits) {
      bit.destroy();
    }
    bits.length = 0;
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);

  maybeShake(scene, 980, 0.048);
  scene.cameras.main.flash(220, 255, 220, 170);

  const flash = track(
    bits,
    scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xfff4d8, 0.92)
      .setScrollFactor(0)
      .setDepth(70),
  );
  scene.tweens.add({
    targets: flash,
    alpha: 0,
    duration: 260,
    ease: 'Quad.easeOut',
  });

  const wash = track(
    bits,
    scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xff4a12, 0.42)
      .setScrollFactor(0)
      .setDepth(69),
  );
  scene.tweens.add({
    targets: wash,
    alpha: 0,
    duration: 640,
    ease: 'Quad.easeOut',
  });

  const scorch = track(bits, scene.add.ellipse(x, y + 28, 70, 24, 0x140808, 0.72).setDepth(10));
  scene.tweens.add({
    targets: scorch,
    scaleX: 9,
    scaleY: 3.4,
    duration: 180,
    ease: 'Cubic.easeOut',
  });
  scene.tweens.add({
    targets: scorch,
    alpha: 0,
    duration: 700,
    delay: 780,
    ease: 'Sine.easeIn',
  });

  const core = track(
    bits,
    scene.add.image(x, y, 'blast-core').setDepth(46).setScale(0.18).setBlendMode(Phaser.BlendModes.ADD),
  );
  scene.tweens.add({
    targets: core,
    scale: 14.5,
    duration: 160,
    ease: 'Cubic.easeOut',
    onComplete: () => {
      if (!core.active) {
        return;
      }
      scene.tweens.add({
        targets: core,
        scale: 22,
        alpha: 0,
        duration: 620,
        ease: 'Quad.easeIn',
      });
    },
  });

  const aftershock = track(
    bits,
    scene.add.image(x, y - 20, 'blast-core').setDepth(45).setScale(0.1).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD),
  );
  scene.tweens.add({
    targets: aftershock,
    scale: 11,
    alpha: 0.85,
    duration: 140,
    delay: 160,
    ease: 'Cubic.easeOut',
    onComplete: () => {
      if (!aftershock.active) {
        return;
      }
      scene.tweens.add({
        targets: aftershock,
        scale: 16,
        alpha: 0,
        duration: 520,
        ease: 'Quad.easeIn',
      });
    },
  });

  for (let i = 0; i < 3; i += 1) {
    const ring = track(
      bits,
      scene.add.image(x, y, 'blast-ring').setDepth(43).setScale(0.15).setAlpha(0.95),
    );
    scene.tweens.add({
      targets: ring,
      scale: 16 + i * 5,
      alpha: 0,
      duration: 520 + i * 180,
      delay: i * 70,
      ease: 'Cubic.easeOut',
    });
  }

  for (let i = 0; i < 12; i += 1) {
    const angle = (Math.PI * 2 * i) / 12;
    const dist = 210 + (i % 4) * 90;
    const fire = track(
      bits,
      scene.add
        .image(x, y, 'blast-core')
        .setDepth(44)
        .setScale(0.35)
        .setBlendMode(Phaser.BlendModes.ADD),
    );
    scene.tweens.add({
      targets: fire,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist * 0.78,
      scale: 4.2,
      alpha: 0,
      duration: 480 + (i % 3) * 80,
      ease: 'Cubic.easeOut',
    });
  }

  const stem = track(bits, scene.add.image(x, y, 'blast-smoke').setDepth(41).setScale(0.9).setTint(0x5a4030));
  scene.tweens.add({
    targets: stem,
    y: y - 190,
    scaleX: 2.8,
    scaleY: 5.4,
    alpha: 0,
    duration: 1180,
    ease: 'Cubic.easeOut',
  });
  for (let i = 0; i < 6; i += 1) {
    const spread = i - 2.5;
    const cap = track(
      bits,
      scene.add
        .image(x + spread * 28, y - 24, 'blast-smoke')
        .setDepth(42)
        .setScale(0.55)
        .setTint(i % 2 === 0 ? 0xff9966 : 0x6a6058),
    );
    scene.tweens.add({
      targets: cap,
      x: x + spread * 128,
      y: y - 250 - Math.abs(spread) * 10,
      scale: 3.6 + Math.abs(spread) * 0.35,
      alpha: 0,
      duration: 1240,
      delay: 50 + i * 28,
      ease: 'Cubic.easeOut',
    });
  }

  burst(
    scene,
    bits,
    x,
    y,
    'blast-core',
    {
      speed: { min: 180, max: 760 },
      scale: { start: 0.7, end: 0.05 },
      lifespan: { min: 420, max: 820 },
      blendMode: Phaser.BlendModes.ADD,
      tint: [0xffffff, 0xffee88, 0xff6622, 0xe23b3b],
      gravityY: -70,
      rotate: { min: 0, max: 360 },
    },
    56,
  );
  burst(
    scene,
    bits,
    x,
    y,
    'blast-smoke',
    {
      speed: { min: 40, max: 280 },
      scale: { start: 0.8, end: 2.4 },
      lifespan: { min: 700, max: 1200 },
      tint: [0x5a4030, 0xffaa77, 0x8a8070],
      gravityY: -120,
      alpha: { start: 0.85, end: 0 },
    },
    36,
  );
  burst(
    scene,
    bits,
    x,
    y,
    'blast-spark',
    {
      speed: { min: 260, max: 920 },
      scale: { start: 1.3, end: 0.2 },
      lifespan: { min: 380, max: 780 },
      blendMode: Phaser.BlendModes.ADD,
      gravityY: 420,
      rotate: { min: -120, max: 120 },
    },
    40,
  );
  spawnFlakBurst(scene, x, y, flipX);

  scene.time.delayedCall(90, () => maybeShake(scene, 420, 0.018));
  scene.time.delayedCall(DEATH_BLAST_MS + 80, cleanup);
}

function pathPoly(ctx: CanvasRenderingContext2D, poly: readonly BossFlakPoint[]): void {
  const first = poly[0];
  if (!first) {
    return;
  }
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < poly.length; i += 1) {
    const point = poly[i];
    if (!point) {
      continue;
    }
    ctx.lineTo(point.x, point.y);
  }
  ctx.closePath();
}

function drawableSource(source: unknown): CanvasImageSource | undefined {
  if (source instanceof HTMLCanvasElement || source instanceof HTMLImageElement) {
    return source;
  }
  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
    return source;
  }
  return undefined;
}

function polyBounds(poly: readonly BossFlakPoint[]): { x: number; y: number; w: number; h: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of poly) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const pad = 2;
  const x = Math.max(0, Math.floor(minX - pad));
  const y = Math.max(0, Math.floor(minY - pad));
  return {
    x,
    y,
    w: Math.max(4, Math.ceil(maxX + pad) - x),
    h: Math.max(4, Math.ceil(maxY + pad) - y),
  };
}

function opaqueBox(
  source: CanvasImageSource,
  cutX: number,
  cutY: number,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { x: 0, y: 0, w: width, h: height };
  }
  ctx.drawImage(source, cutX, cutY, width, height, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] <= 12) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (minX > maxX) {
    return { x: 0, y: 0, w: width, h: height };
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function stampBossShard(
  scene: Phaser.Scene,
  key: string,
  source: CanvasImageSource,
  cutX: number,
  cutY: number,
  width: number,
  height: number,
  poly: readonly BossFlakPoint[],
  crop: { x: number; y: number; w: number; h: number },
): boolean {
  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
  const texture = scene.textures.createCanvas(key, crop.w, crop.h);
  if (!texture) {
    return false;
  }
  const ctx = texture.getContext();
  ctx.clearRect(0, 0, crop.w, crop.h);
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.translate(-crop.x, -crop.y);
  pathPoly(ctx, poly);
  ctx.clip();
  ctx.drawImage(source, cutX, cutY, width, height, 0, 0, width, height);
  ctx.restore();
  texture.refresh();
  return true;
}

function spawnBossShards(
  scene: Phaser.Scene,
  bits: Phaser.GameObjects.GameObject[],
  sprite: Phaser.GameObjects.Sprite,
): void {
  const frame = sprite.frame;
  const source = drawableSource(sprite.texture.getSourceImage());
  const width = Math.max(8, Math.round(frame.cutWidth || frame.width));
  const height = Math.max(8, Math.round(frame.cutHeight || frame.height));
  const raw =
    source === undefined
      ? { x: 0, y: 0, w: width, h: height }
      : opaqueBox(source, frame.cutX, frame.cutY, width, height);
  const inset = Math.round(Math.min(raw.w, raw.h) * 0.14);
  const art = {
    x: raw.x + inset,
    y: raw.y + inset,
    w: Math.max(8, raw.w - inset * 2),
    h: Math.max(8, raw.h - inset * 2),
  };
  const keys: string[] = [];
  const dropKeys = (): void => {
    for (const key of keys) {
      if (scene.textures.exists(key)) {
        scene.textures.remove(key);
      }
    }
    keys.length = 0;
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, dropKeys);

  for (const index of BOSS_FLAK_INDEXES) {
    const key = `boss-flak-${scene.time.now}-${index}`;
    const poly = scaleBossFlakPoly(index, art.w, art.h).map((point) => ({
      x: point.x + art.x,
      y: point.y + art.y,
    }));
    const crop = polyBounds(poly);
    const stamped =
      source !== undefined &&
      stampBossShard(scene, key, source, frame.cutX, frame.cutY, width, height, poly, crop);
    if (stamped) {
      keys.push(key);
    }
    const localX = crop.x + crop.w / 2 - width / 2;
    const localY = crop.y + crop.h / 2 - height / 2;
    const shard = track(
      bits,
      scene.add
        .image(
          sprite.x + (sprite.flipX ? -localX : localX) * sprite.scaleX,
          sprite.y + localY * sprite.scaleY,
          stamped ? key : sprite.texture.key,
          stamped ? undefined : sprite.frame.name,
        )
        .setDepth(22)
        .setScale(stamped ? sprite.scaleX : sprite.scaleX * 0.4, stamped ? sprite.scaleY : sprite.scaleY * 0.4)
        .setFlipX(sprite.flipX)
        .setOrigin(0.5, 0.5),
    );
    const center = bossFlakCentroid(index, art.w, art.h);
    const nx = (center.x / art.w - 0.5) * (sprite.flipX ? -2 : 2);
    const ny = center.y / art.h - 0.5;
    const dist = 70 + Math.abs(nx) * 28;
    const lift = 42 + Math.random() * 24;
    scene.tweens.add({
      targets: shard,
      x: shard.x + nx * dist,
      angle: nx * 150 + (Math.random() - 0.5) * 80,
      duration: 980,
      ease: 'Cubic.easeOut',
    });
    scene.tweens.add({
      targets: shard,
      y: shard.y + ny * 22 - lift,
      duration: 240,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (!shard.active) {
          return;
        }
        scene.tweens.add({
          targets: shard,
          y: shard.y + 140 + Math.abs(ny) * 30,
          alpha: 0,
          duration: 720,
          ease: 'Cubic.easeIn',
        });
      },
    });
  }

  scene.time.delayedCall(BOSS_DEATH_BLAST_MS + 80, dropKeys);
}

export function spawnBossDeathBlast(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite): void {
  const bits: Phaser.GameObjects.GameObject[] = [];
  const cleanup = (): void => {
    for (const bit of bits) {
      bit.destroy();
    }
    bits.length = 0;
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);

  const x = sprite.x;
  const y = sprite.y;
  spawnBossShards(scene, bits, sprite);
  sprite.setVisible(false);

  maybeShake(scene, 200, 0.007);

  const core = track(
    bits,
    scene.add
      .image(x, y, 'blast-core')
      .setDepth(24)
      .setScale(0.12)
      .setBlendMode(Phaser.BlendModes.ADD),
  );
  scene.tweens.add({
    targets: core,
    scale: BOSS_BLAST_CORE_PEAK,
    duration: 140,
    ease: 'Cubic.easeOut',
    onComplete: () => {
      if (!core.active) {
        return;
      }
      scene.tweens.add({
        targets: core,
        scale: BOSS_BLAST_CORE_PEAK * 1.18,
        alpha: 0,
        duration: 420,
        ease: 'Quad.easeIn',
      });
    },
  });

  const ring = track(
    bits,
    scene.add.image(x, y, 'blast-ring').setDepth(23).setScale(0.1).setAlpha(0.9),
  );
  scene.tweens.add({
    targets: ring,
    scale: BOSS_BLAST_RING_PEAK,
    alpha: 0,
    duration: 480,
    ease: 'Cubic.easeOut',
  });

  const stem = track(
    bits,
    scene.add.image(x, y + 8, 'blast-smoke').setDepth(21).setScale(0.28, 0.34).setTint(0x5a4030),
  );
  scene.tweens.add({
    targets: stem,
    y: y - 52,
    scaleX: 0.55,
    scaleY: 1.15,
    alpha: 0,
    duration: 820,
    ease: 'Cubic.easeOut',
  });
  for (let i = 0; i < 4; i += 1) {
    const spread = i - 1.5;
    const cap = track(
      bits,
      scene.add
        .image(x + spread * 10, y - 10, 'blast-smoke')
        .setDepth(22)
        .setScale(0.22)
        .setTint(i % 2 === 0 ? 0xff9966 : 0x6a6058),
    );
    scene.tweens.add({
      targets: cap,
      x: x + spread * 38,
      y: y - 64 - Math.abs(spread) * 6,
      scale: 0.72 + Math.abs(spread) * 0.08,
      alpha: 0,
      duration: 880,
      delay: 30 + i * 24,
      ease: 'Cubic.easeOut',
    });
  }

  burst(
    scene,
    bits,
    x,
    y,
    'blast-core',
    {
      speed: { min: 40, max: 180 },
      scale: { start: 0.22, end: 0.04 },
      lifespan: { min: 280, max: 520 },
      blendMode: Phaser.BlendModes.ADD,
      tint: [0xffffff, 0xffee88, 0xff6622],
      gravityY: -40,
    },
    14,
    24,
  );
  burst(
    scene,
    bits,
    x,
    y,
    'blast-spark',
    {
      speed: { min: 80, max: 240 },
      scale: { start: 0.55, end: 0.08 },
      lifespan: { min: 260, max: 480 },
      blendMode: Phaser.BlendModes.ADD,
      gravityY: 280,
      rotate: { min: -80, max: 80 },
    },
    12,
    24,
  );

  scene.time.delayedCall(BOSS_DEATH_BLAST_MS + 80, cleanup);
}
