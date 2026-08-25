import Phaser from 'phaser';
import { FlakFragment, type FlakSnapshot } from '../entities/FlakFragment';
import type { LevelId } from '../config';
import { FLAK_PIECE_INDEXES, HERO_FLAK_SIZE, flakPieceCentroid, isFlakPieceIndex } from './flak-pieces';

const FLAK_DATA_KEY = 'flak';

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
    if (!isFlakPieceIndex(piece.piece)) {
      continue;
    }
    const frag = new FlakFragment(scene, piece.x, piece.y, piece.piece, piece.scale, piece.flipX);
    group.add(frag);
    frag.applyMotion(piece.vx, piece.vy, piece.angle, piece.angularVelocity);
  }
}

export function spawnFlakBurst(scene: Phaser.Scene, x: number, y: number, flipX = false): void {
  const group = getFlakGroup(scene);
  if (!group) {
    return;
  }
  for (const piece of FLAK_PIECE_INDEXES) {
    const center = flakPieceCentroid(piece);
    const dx = (flipX ? HERO_FLAK_SIZE - center.x : center.x) - HERO_FLAK_SIZE / 2;
    const dy = center.y - HERO_FLAK_SIZE / 2;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    const frag = new FlakFragment(scene, x + nx * 10, y + ny * 10, piece, 1, flipX);
    group.add(frag);
    const speed = 240 + Math.random() * 130;
    frag.arcadeBody.setVelocity(nx * speed, ny * speed - 180);
    frag.arcadeBody.setAngularVelocity((Math.random() - 0.5) * 200);
    frag.setAngle(nx * 6 + (Math.random() - 0.5) * 8);
  }
}
