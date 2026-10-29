export interface SwoopVec {
  x: number;
  y: number;
}

export interface SwoopPath {
  start: SwoopVec;
  control: SwoopVec;
  end: SwoopVec;
}

export const SWOOP_DURATION_MS = 800;

const ARC_STEPS = 24;

/** Straight dive that ends on the point locked when the swoop starts. */
export function swoopPath(from: SwoopVec, target: SwoopVec): SwoopPath {
  return {
    start: { x: from.x, y: from.y },
    control: { x: (from.x + target.x) / 2, y: (from.y + target.y) / 2 },
    end: { x: target.x, y: target.y },
  };
}

export function sampleSwoop(path: SwoopPath, t: number): SwoopVec {
  const clamped = Math.min(1, Math.max(0, t));
  const u = 1 - clamped;
  return {
    x: u * u * path.start.x + 2 * u * clamped * path.control.x + clamped * clamped * path.end.x,
    y: u * u * path.start.y + 2 * u * clamped * path.control.y + clamped * clamped * path.end.y,
  };
}

function arcLengths(path: SwoopPath): number[] {
  const lengths = [0];
  let prev = sampleSwoop(path, 0);
  for (let step = 1; step <= ARC_STEPS; step += 1) {
    const point = sampleSwoop(path, step / ARC_STEPS);
    lengths.push((lengths[step - 1] ?? 0) + Math.hypot(point.x - prev.x, point.y - prev.y));
    prev = point;
  }
  return lengths;
}

/** Map a 0..1 distance fraction onto the bezier so speed stays even along the dive. */
export function swoopParameter(path: SwoopPath, distanceFraction: number): number {
  const lengths = arcLengths(path);
  const total = lengths[ARC_STEPS] ?? 0;
  if (total <= 0) {
    return 0;
  }
  const target = Math.min(1, Math.max(0, distanceFraction)) * total;
  for (let step = 1; step <= ARC_STEPS; step += 1) {
    const end = lengths[step] ?? 0;
    const start = lengths[step - 1] ?? 0;
    if (target <= end) {
      const span = end - start;
      const local = span === 0 ? 0 : (target - start) / span;
      return (step - 1 + local) / ARC_STEPS;
    }
  }
  return 1;
}

export function swoopPointAt(path: SwoopPath, elapsedMs: number, durationMs = SWOOP_DURATION_MS): SwoopVec {
  const fraction = durationMs <= 0 ? 1 : Math.min(1, Math.max(0, elapsedMs / durationMs));
  return sampleSwoop(path, swoopParameter(path, fraction));
}
