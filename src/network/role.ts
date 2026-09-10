export type PlayerId = 'host' | 'guest';
export type CoopRole = PlayerId;

const PLAYER_IDS: readonly PlayerId[] = ['host', 'guest'];

export function isPlayerId(value: unknown): value is PlayerId {
  return typeof value === 'string' && PLAYER_IDS.includes(value as PlayerId);
}

export function otherRole(role: PlayerId): PlayerId {
  switch (role) {
    case 'host':
      return 'guest';
    case 'guest':
      return 'host';
    default: {
      const neverRole: never = role;
      return neverRole;
    }
  }
}
