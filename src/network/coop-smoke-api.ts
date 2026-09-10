import Phaser from 'phaser';
import { type LevelId } from '../config';
import { BroadcastRuntimeTransport } from './broadcast-transport';
import { setActiveCoopSession, type CoopRole } from './runtime-session';

interface CoopSmokeApi {
  start(role: CoopRole, channelName: string, levelId: LevelId): void;
}

declare global {
  interface Window {
    __rs4CoopSmoke?: CoopSmokeApi;
  }
}

export function installCoopSmokeApi(game: Phaser.Game): void {
  if (!import.meta.env.DEV) {
    return;
  }
  window.__rs4CoopSmoke = {
    start(role: CoopRole, channelName: string, levelId: LevelId): void {
      const transport = new BroadcastRuntimeTransport(channelName);
      const link = {
        role,
        levelId,
        localPlayerId: role,
        remotePlayerId: role === 'host' ? 'guest' : 'host',
        localName: role === 'host' ? 'Host' : 'Guest',
        remoteName: role === 'host' ? 'Guest' : 'Host',
        transport,
      };
      setActiveCoopSession(link);
      game.scene.start('PlayScene', { levelId, session: link, skipControlsHint: true });
    },
  };
}
