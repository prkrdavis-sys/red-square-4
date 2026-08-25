import type { SpecialKind } from '../config';

const LABELS: Record<SpecialKind, string> = {
  grow: 'Grow',
  'frost-path': 'Frost',
  'sand-surge': 'Surge',
  'bubble-pulse': 'Bubble',
  'shadow-blink': 'Blink',
  'liana-swing': 'Swing',
};

const DESCRIPTIONS: Record<SpecialKind, string> = {
  grow: 'Sprout a short-lived platform ahead of you.',
  'frost-path': 'Dash forward and lay a trail of ice.',
  'sand-surge': 'Burst up and forward on a dune.',
  'bubble-pulse': 'Launch yourself on a rising bubble.',
  'shadow-blink': 'Blink a short distance in the direction you face.',
  'liana-swing': 'Grab a vine and swing forward.',
};

export function specialLabel(kind: SpecialKind): string {
  return LABELS[kind];
}

export function specialDescription(kind: SpecialKind): string {
  return DESCRIPTIONS[kind];
}
