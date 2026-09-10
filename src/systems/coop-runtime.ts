import type { LevelId } from '../config';
import { EMPTY_PLAYER_INPUT, type PlayerInput } from '../entities/player-input';
import type { BossPose, PlayerPose, RuntimeMessage } from '../network/protocol';
import type { CoopRuntimeSession } from '../network/runtime-session';
import type { PlayerId } from '../network/role';
import {
  bothPlayersDown,
  createCoopTeamState,
  reduceCoopTeam,
  type CoopTeamState,
  type TeamCheckpoint,
} from './coop-team';

export interface CoopSnapshotPayload {
  host: PlayerPose;
  guest: PlayerPose;
  lives: number;
  boss?: BossPose;
}

export type CoopRuntimeEvent =
  | { type: 'snapshot'; host: PlayerPose; guest: PlayerPose; lives: number; boss?: BossPose }
  | { type: 'checkpoint'; x: number; y: number }
  | { type: 'player-impact'; kind: 'side' | 'head' }
  | { type: 'player-down'; playerId: PlayerId }
  | { type: 'special'; playerId: PlayerId; direction: -1 | 1 }
  | { type: 'reward-coin' }
  | { type: 'reward-star'; index: number }
  | { type: 'team-restart'; levelId: LevelId }
  | { type: 'level-complete'; levelId: LevelId }
  | { type: 'leave'; reason: string };

export class CoopRuntime {
  readonly pausesWorld = false;
  private team: CoopTeamState;
  private remoteInput: PlayerInput = EMPTY_PLAYER_INPUT;
  private sequence = 0;
  private lastSnapshotAt = 0;
  private lastInputSentAt = 0;

  constructor(
    readonly link: CoopRuntimeSession,
    spawn: Readonly<{ lives: number; x: number; y: number }>,
  ) {
    this.team = createCoopTeamState(spawn.lives, {
      id: 'start',
      order: 0,
      x: spawn.x,
      y: spawn.y,
    });
  }

  get isAuthority(): boolean {
    return this.link.role === 'host';
  }

  get remoteName(): string {
    return this.link.remoteName;
  }

  get lives(): number {
    return this.team.lives;
  }

  setLevelId(levelId: LevelId): void {
    this.link.levelId = levelId;
  }

  isActive(role: PlayerId): boolean {
    return this.team.players[role].status === 'active';
  }

  peekRemoteInput(): PlayerInput {
    return this.remoteInput;
  }

  takeRemoteInput(): PlayerInput {
    const input = this.remoteInput;
    this.remoteInput = {
      ...input,
      jumpJust: false,
      downJust: false,
      specialJust: false,
    };
    return input;
  }

  subscribe(listener: (event: CoopRuntimeEvent) => void): () => void {
    return this.link.transport.subscribe((message) => {
      const event = this.ingest(message);
      if (event) {
        listener(event);
      }
    });
  }

  maybeSendInput(now: number, input: PlayerInput): void {
    if (this.isAuthority) {
      return;
    }
    if (now >= this.lastInputSentAt + 33 || input.jumpJust || input.downJust || input.specialJust) {
      this.lastInputSentAt = now;
      this.send({ type: 'input', sequence: ++this.sequence, input });
    }
  }

  maybeBroadcastSnapshot(now: number, snapshot: CoopSnapshotPayload): void {
    if (!this.isAuthority || now < this.lastSnapshotAt + 50) {
      return;
    }
    this.lastSnapshotAt = now;
    this.send({
      type: 'snapshot',
      sequence: ++this.sequence,
      ...snapshot,
    });
  }

  sendSpecial(playerId: PlayerId, direction: -1 | 1): void {
    this.send({ type: 'special', playerId, direction });
  }

  sendImpact(kind: 'side' | 'head', upperPlayerId?: PlayerId): void {
    this.send({ type: 'player-impact', kind, upperPlayerId });
  }

  sendLevelComplete(levelId: LevelId, completionId: string): void {
    this.send({ type: 'level-complete', levelId, completionId });
  }

  sendTeamRestart(levelId: LevelId): void {
    this.send({ type: 'team-restart', levelId });
  }

  markPlayerDown(playerId: PlayerId): 'spectating' | 'team-wipe' | 'ignored' {
    const next = this.apply({
      type: 'player-down',
      eventId: `down:${playerId}:${++this.sequence}`,
      playerId,
    });
    if (!next) {
      return 'ignored';
    }
    this.send({ type: 'player-died', playerId });
    return bothPlayersDown(this.team) ? 'team-wipe' : 'spectating';
  }

  noteCheckpoint(checkpoint: TeamCheckpoint): void {
    this.apply({
      type: 'activate-checkpoint',
      eventId: checkpoint.id,
      checkpoint,
    });
    this.send({ type: 'checkpoint', x: checkpoint.x, y: checkpoint.y });
  }

  grantCoin(eventId: string): boolean {
    return this.grantReward(eventId, { id: eventId, coins: 1 });
  }

  grantStar(eventId: string, index: number): boolean {
    return this.grantReward(eventId, { id: eventId, coins: 0, starIndex: index });
  }

  spendTeamLife(causedBy: PlayerId): 'restart' | 'game-over' | 'ignored' {
    const next = this.apply({
      type: 'team-death',
      eventId: `wipe:${++this.sequence}`,
      causedBy,
    });
    if (!next) {
      return 'ignored';
    }
    return this.team.gameOver ? 'game-over' : 'restart';
  }

  private grantReward(eventId: string, reward: { id: string; coins: number; starIndex?: number }): boolean {
    const next = this.apply({ type: 'grant-reward', eventId, reward });
    if (!next) {
      return false;
    }
    this.send({
      type: 'reward',
      eventId,
      reward: reward.starIndex === undefined ? 'coin' : 'star',
      index: reward.starIndex,
    });
    return true;
  }

  private apply(action: Parameters<typeof reduceCoopTeam>[1]): boolean {
    const next = reduceCoopTeam(this.team, action);
    if (next === this.team) {
      return false;
    }
    this.team = next;
    return true;
  }

  private send(message: RuntimeMessage): void {
    this.link.transport.send(message);
  }

  private ingest(message: RuntimeMessage): CoopRuntimeEvent | undefined {
    switch (message.type) {
      case 'input':
        if (!this.isAuthority) {
          return undefined;
        }
        this.remoteInput = message.input;
        return undefined;
      case 'snapshot':
        if (this.isAuthority) {
          return undefined;
        }
        this.syncFromSnapshot(message);
        return {
          type: 'snapshot',
          host: message.host,
          guest: message.guest,
          lives: message.lives,
          boss: message.boss,
        };
      case 'checkpoint':
        this.apply({
          type: 'activate-checkpoint',
          eventId: `checkpoint:${message.x}:${message.y}`,
          checkpoint: {
            id: `checkpoint:${message.x}:${message.y}`,
            order: message.x,
            x: message.x,
            y: message.y,
          },
        });
        return { type: 'checkpoint', x: message.x, y: message.y };
      case 'player-impact':
        return this.isAuthority ? undefined : { type: 'player-impact', kind: message.kind };
      case 'player-died':
        if (this.isAuthority) {
          return undefined;
        }
        this.apply({
          type: 'player-down',
          eventId: `down:${message.playerId}:${++this.sequence}`,
          playerId: message.playerId,
        });
        return { type: 'player-down', playerId: message.playerId };
      case 'special':
        return this.isAuthority
          ? undefined
          : { type: 'special', playerId: message.playerId, direction: message.direction };
      case 'reward': {
        const applied = this.apply({
          type: 'grant-reward',
          eventId: message.eventId,
          reward: {
            id: message.eventId,
            coins: message.reward === 'coin' ? 1 : 0,
            starIndex: message.index,
          },
        });
        if (!applied) {
          return undefined;
        }
        return message.reward === 'coin'
          ? { type: 'reward-coin' }
          : typeof message.index === 'number'
            ? { type: 'reward-star', index: message.index }
            : undefined;
      }
      case 'team-restart':
        return { type: 'team-restart', levelId: message.levelId };
      case 'level-complete':
        return this.isAuthority ? undefined : { type: 'level-complete', levelId: message.levelId };
      case 'leave':
        return { type: 'leave', reason: message.reason };
      default: {
        const neverMessage: never = message;
        return neverMessage;
      }
    }
  }

  private syncFromSnapshot(snapshot: CoopSnapshotPayload): void {
    this.team = {
      ...this.team,
      lives: snapshot.lives,
      gameOver: snapshot.lives <= 0,
      players: {
        host: {
          ...this.team.players.host,
          status: snapshot.host.alive ? 'active' : 'eliminated',
        },
        guest: {
          ...this.team.players.guest,
          status: snapshot.guest.alive ? 'active' : 'eliminated',
        },
      },
    };
  }
}
