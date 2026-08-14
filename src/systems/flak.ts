import Phaser from 'phaser';
import { FlakFragment, type FlakKind, type FlakSnapshot } from '../entities/FlakFragment';
import type { LevelId } from '../config';

const FLAK_DATA_KEY = 'flak';
const FLAK_BURST_COUNT = 44;
const FLAK_KINDS: FlakKind[] = ['chunk', 'shard', 'sliver', 'char', 'gold'];

interface RememberedFlak {
  levelId: LevelId;
  pieces: FlakSnapshot[];
}

let remembered: RememberedFlak | null = null;

export function setFlakGroup(scene: Phaser.Scene, group: Phaser.GameObjects.Group): void {
  scene.data.set(FLAK_DATA_KEY, group);
}

export function getFlakGroup(scene: Phaser.Scene): Phaser.GameObjects.Group | undefined {
  const group = scene.data.get(FLAK_DATA_KEY);
  return group instanceof Phaser.GameObjects.Group ? group : undefined;
}

export function forgetFlak(): void {
  remembered = null;
}

export function rememberFlak(levelId: LevelId, group: Phaser.GameObjects.Group, killY: number): void {
  const pieces: FlakSnapshot[] = [];
  for (const child of group.getChildren()) {
    if (!(child instanceof FlakFragment) || !child.active || !child.body) {
      continue;
    }
    if (child.y > killY) {
      continue;
    }
    pieces.push(child.snapshot());
  }
  remembered = { levelId, pieces };
}

export function restoreFlak(
  scene: Phaser.Scene,
  group: Phaser.GameObjects.Group,
  levelId: LevelId,
): void {
  if (!remembered || remembered.levelId !== levelId) {
    return;
  }
  for (const piece of remembered.pieces) {
    const frag = new FlakFragment(scene, piece.x, piece.y, piece.kind, piece.scale);
    group.add(frag);
    frag.applyMotion(piece.vx, piece.vy, piece.angle, piece.angularVelocity);
  }
}

function pickKind(index: number): FlakKind {
  if (index < 8) {
    return 'chunk';
  }
  return FLAK_KINDS[index % FLAK_KINDS.length] ?? 'shard';
}

function pickScale(kind: FlakKind): number {
  switch (kind) {
    case 'chunk':
      return 1.15 + Math.random() * 0.7;
    case 'shard':
      return 0.95 + Math.random() * 0.55;
    case 'sliver':
      return 0.8 + Math.random() * 0.55;
    case 'char':
      return 0.9 + Math.random() * 0.5;
    case 'gold':
      return 0.85 + Math.random() * 0.4;
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

export function spawnFlakBurst(scene: Phaser.Scene, x: number, y: number): void {
  const group = getFlakGroup(scene);
  if (!group) {
    return;
  }
  for (let i = 0; i < FLAK_BURST_COUNT; i += 1) {
    const kind = pickKind(i);
    const frag = new FlakFragment(
      scene,
      x + (Math.random() - 0.5) * 18,
      y + (Math.random() - 0.5) * 14,
      kind,
      pickScale(kind),
    );
    group.add(frag);
    const angle = (Math.PI * 2 * i) / FLAK_BURST_COUNT + (Math.random() - 0.5) * 0.62;
    const near = i % 5 === 0;
    const speed = near ? 140 + Math.random() * 220 : 260 + Math.random() * 680;
    frag.arcadeBody.setVelocity(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed - (near ? 80 : 240) - Math.random() * 240,
    );
    frag.arcadeBody.setAngularVelocity((Math.random() - 0.5) * 980);
    frag.setAngle(Math.random() * 360);
  }
}
