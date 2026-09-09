import {
  onDisconnect,
  onValue,
  ref,
  remove,
  serverTimestamp,
  set,
  type Unsubscribe,
} from 'firebase/database';
import { getFirebaseServices } from './firebase-client';

export interface PresenceState {
  online: boolean;
  connectionCount: number;
  lastOnlineMs: number | null;
}

export interface PresenceHandle {
  stop: () => Promise<void>;
}

export async function startPresence(uid: string): Promise<PresenceHandle> {
  const { database } = getFirebaseServices();
  const connectionId = crypto.randomUUID();
  const connection = ref(database, `presence/${uid}/connections/${connectionId}`);
  const lastOnline = ref(database, `presence/${uid}/lastOnline`);
  const disconnectConnection = onDisconnect(connection);
  const disconnectLastOnline = onDisconnect(lastOnline);

  await disconnectConnection.remove();
  await disconnectLastOnline.set(serverTimestamp());
  await set(connection, true);

  let stopped = false;
  return {
    stop: async () => {
      if (stopped) {
        return;
      }
      stopped = true;
      await Promise.all([
        disconnectConnection.cancel(),
        disconnectLastOnline.cancel(),
        remove(connection),
        set(lastOnline, serverTimestamp()),
      ]);
    },
  };
}

export function observePresence(
  uid: string,
  listener: (presence: PresenceState) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const presence = ref(getFirebaseServices().database, `presence/${uid}`);
  return onValue(presence, (snapshot) => {
    const data: unknown = snapshot.val();
    if (!isRecord(data)) {
      listener({ online: false, connectionCount: 0, lastOnlineMs: null });
      return;
    }
    const connections = isRecord(data.connections) ? Object.keys(data.connections).length : 0;
    listener({
      online: connections > 0,
      connectionCount: connections,
      lastOnlineMs: typeof data.lastOnline === 'number' ? data.lastOnline : null,
    });
  }, (error) => onError?.(error));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
