import type { PlayerId } from '../network/role';

export interface TeamCheckpoint {
  id: string;
  order: number;
  x: number;
  y: number;
}

export interface TeamPlayerState {
  id: PlayerId;
  status: 'active' | 'eliminated';
  spawnX: number;
  spawnY: number;
  revivalToken: number;
}

export interface TeamReward {
  id: string;
  coins: number;
  starIndex?: number;
}

export interface CoopTeamState {
  lives: number;
  checkpoint: TeamCheckpoint;
  players: Readonly<Record<PlayerId, TeamPlayerState>>;
  rewards: readonly TeamReward[];
  totalCoins: number;
  processedEventIds: readonly string[];
  gameOver: boolean;
}

export type CoopTeamAction =
  | {
      type: 'activate-checkpoint';
      eventId: string;
      checkpoint: TeamCheckpoint;
    }
  | {
      type: 'player-down';
      eventId: string;
      playerId: PlayerId;
    }
  | {
      type: 'team-death';
      eventId: string;
      causedBy: PlayerId;
    }
  | {
      type: 'grant-reward';
      eventId: string;
      reward: TeamReward;
    };

export function createCoopTeamState(
  lives: number,
  initialCheckpoint: TeamCheckpoint,
): CoopTeamState {
  const safeLives = Math.max(0, Math.floor(lives));
  const status = safeLives > 0 ? 'active' : 'eliminated';
  return {
    lives: safeLives,
    checkpoint: initialCheckpoint,
    players: {
      host: {
        id: 'host',
        status,
        spawnX: initialCheckpoint.x,
        spawnY: initialCheckpoint.y,
        revivalToken: 0,
      },
      guest: {
        id: 'guest',
        status,
        spawnX: initialCheckpoint.x,
        spawnY: initialCheckpoint.y,
        revivalToken: 0,
      },
    },
    rewards: [],
    totalCoins: 0,
    processedEventIds: [],
    gameOver: safeLives === 0,
  };
}

function withProcessedEvent(state: CoopTeamState, eventId: string): readonly string[] {
  return [...state.processedEventIds, eventId];
}

function revivePlayer(
  player: TeamPlayerState,
  checkpoint: TeamCheckpoint,
  alive: boolean,
): TeamPlayerState {
  return {
    ...player,
    status: alive ? 'active' : 'eliminated',
    spawnX: checkpoint.x,
    spawnY: checkpoint.y,
    revivalToken: player.revivalToken + (alive ? 1 : 0),
  };
}

function reviveIfDown(player: TeamPlayerState, checkpoint: TeamCheckpoint): TeamPlayerState {
  return player.status === 'active' ? player : revivePlayer(player, checkpoint, true);
}

export function bothPlayersDown(state: CoopTeamState): boolean {
  return state.players.host.status === 'eliminated' && state.players.guest.status === 'eliminated';
}

export function reduceCoopTeam(state: CoopTeamState, action: CoopTeamAction): CoopTeamState {
  if (state.processedEventIds.includes(action.eventId)) {
    return state;
  }

  switch (action.type) {
    case 'activate-checkpoint': {
      if (action.checkpoint.order <= state.checkpoint.order) {
        return {
          ...state,
          players: {
            host: reviveIfDown(state.players.host, state.checkpoint),
            guest: reviveIfDown(state.players.guest, state.checkpoint),
          },
          processedEventIds: withProcessedEvent(state, action.eventId),
        };
      }
      return {
        ...state,
        checkpoint: action.checkpoint,
        players: {
          host: reviveIfDown(state.players.host, action.checkpoint),
          guest: reviveIfDown(state.players.guest, action.checkpoint),
        },
        processedEventIds: withProcessedEvent(state, action.eventId),
      };
    }
    case 'player-down': {
      const player = state.players[action.playerId];
      if (player.status === 'eliminated') {
        return {
          ...state,
          processedEventIds: withProcessedEvent(state, action.eventId),
        };
      }
      return {
        ...state,
        players: {
          ...state.players,
          [action.playerId]: { ...player, status: 'eliminated' },
        },
        processedEventIds: withProcessedEvent(state, action.eventId),
      };
    }
    case 'team-death': {
      if (state.gameOver) {
        return {
          ...state,
          processedEventIds: withProcessedEvent(state, action.eventId),
        };
      }
      const lives = Math.max(0, state.lives - 1);
      const alive = lives > 0;
      return {
        ...state,
        lives,
        players: {
          host: revivePlayer(state.players.host, state.checkpoint, alive),
          guest: revivePlayer(state.players.guest, state.checkpoint, alive),
        },
        processedEventIds: withProcessedEvent(state, action.eventId),
        gameOver: !alive,
      };
    }
    case 'grant-reward': {
      const alreadyGranted = state.rewards.some((reward) => reward.id === action.reward.id);
      return {
        ...state,
        rewards: alreadyGranted ? state.rewards : [...state.rewards, action.reward],
        totalCoins: alreadyGranted
          ? state.totalCoins
          : state.totalCoins + Math.max(0, Math.floor(action.reward.coins)),
        processedEventIds: withProcessedEvent(state, action.eventId),
      };
    }
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
