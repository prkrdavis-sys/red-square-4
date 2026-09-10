import { describe, expect, it } from 'vitest';
import {
  createCoopTeamState,
  reduceCoopTeam,
  type CoopTeamState,
  type TeamCheckpoint,
} from './coop-team';

const start: TeamCheckpoint = { id: 'start', order: 0, x: 64, y: 512 };

function team(lives = 3): CoopTeamState {
  return createCoopTeamState(lives, start);
}

describe('co-op team reducer', () => {
  it('keeps the furthest authoritative checkpoint', () => {
    const checkpoint = { id: 'mid', order: 2, x: 640, y: 320 };
    const advanced = reduceCoopTeam(team(), {
      type: 'activate-checkpoint',
      eventId: 'checkpoint-2',
      checkpoint,
    });
    const stale = reduceCoopTeam(advanced, {
      type: 'activate-checkpoint',
      eventId: 'checkpoint-1',
      checkpoint: { id: 'early', order: 1, x: 320, y: 448 },
    });
    expect(stale.checkpoint).toEqual(checkpoint);
  });

  it('spends one shared life and revives both players at the checkpoint', () => {
    const checkpoint = { id: 'mid', order: 1, x: 704, y: 256 };
    const checked = reduceCoopTeam(team(), {
      type: 'activate-checkpoint',
      eventId: 'checkpoint',
      checkpoint,
    });
    const revived = reduceCoopTeam(checked, {
      type: 'team-death',
      eventId: 'death-1',
      causedBy: 'guest',
    });
    expect(revived.lives).toBe(2);
    expect(revived.players.host).toMatchObject({
      status: 'active',
      spawnX: 704,
      spawnY: 256,
      revivalToken: 1,
    });
    expect(revived.players.guest.revivalToken).toBe(1);
  });

  it('deduplicates replayed death events', () => {
    const action = { type: 'team-death', eventId: 'death-1', causedBy: 'host' } as const;
    const once = reduceCoopTeam(team(), action);
    expect(reduceCoopTeam(once, action)).toBe(once);
  });

  it('eliminates the team when its final shared life is spent', () => {
    const ended = reduceCoopTeam(team(1), {
      type: 'team-death',
      eventId: 'last-life',
      causedBy: 'guest',
    });
    expect(ended.gameOver).toBe(true);
    expect(ended.players.host.status).toBe('eliminated');
    expect(ended.players.guest.status).toBe('eliminated');
  });

  it('marks one player down without spending a life', () => {
    const downed = reduceCoopTeam(team(), {
      type: 'player-down',
      eventId: 'down-guest',
      playerId: 'guest',
    });
    expect(downed.lives).toBe(3);
    expect(downed.players.guest.status).toBe('eliminated');
    expect(downed.players.host.status).toBe('active');
  });

  it('revives only downed players when a checkpoint is taken', () => {
    const downed = reduceCoopTeam(team(), {
      type: 'player-down',
      eventId: 'down-host',
      playerId: 'host',
    });
    const revived = reduceCoopTeam(downed, {
      type: 'activate-checkpoint',
      eventId: 'checkpoint-2',
      checkpoint: { id: 'mid', order: 2, x: 640, y: 320 },
    });
    expect(revived.players.host).toMatchObject({
      status: 'active',
      spawnX: 640,
      spawnY: 320,
      revivalToken: 1,
    });
    expect(revived.players.guest.revivalToken).toBe(0);
  });

  it('deduplicates rewards by reward id even across distinct event packets', () => {
    const once = reduceCoopTeam(team(), {
      type: 'grant-reward',
      eventId: 'packet-a',
      reward: { id: 'boss-1', coins: 5 },
    });
    const twice = reduceCoopTeam(once, {
      type: 'grant-reward',
      eventId: 'packet-b',
      reward: { id: 'boss-1', coins: 5 },
    });
    expect(twice.totalCoins).toBe(5);
    expect(twice.rewards).toEqual([{ id: 'boss-1', coins: 5 }]);
  });
});
