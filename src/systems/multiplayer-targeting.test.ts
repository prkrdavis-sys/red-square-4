import { describe, expect, it } from 'vitest';
import { selectMultiplayerTarget, type TargetPoint } from './multiplayer-targeting';

const players: readonly TargetPoint[] = [
  { id: 'host', x: 30, y: 40, targetable: true },
  { id: 'guest', x: 10, y: 0, targetable: true },
];

describe('multiplayer target selection', () => {
  it('selects the nearest active player', () => {
    expect(selectMultiplayerTarget({ x: 0, y: 0 }, players)).toEqual({
      id: 'guest',
      distanceSquared: 100,
    });
  });

  it('ignores untargetable and out-of-range players', () => {
    expect(
      selectMultiplayerTarget(
        { x: 0, y: 0 },
        [
          { ...players[0]!, targetable: false },
          players[1]!,
        ],
        5,
      ),
    ).toBeNull();
  });

  it('uses player id as a deterministic tie breaker', () => {
    const result = selectMultiplayerTarget(
      { x: 0, y: 0 },
      [
        { id: 'guest', x: -10, y: 0, targetable: true },
        { id: 'host', x: 10, y: 0, targetable: true },
      ],
    );
    expect(result?.id).toBe('guest');
  });
});
