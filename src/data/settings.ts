import Phaser from 'phaser';
import { lockLandscape } from '../systems/touch-controls';

const STORAGE_KEY = 'red-square-4-settings-v1';

export interface GameSettings {
  volume: number;
  music: boolean;
  sfx: boolean;
  screenshake: boolean;
  fullscreen: boolean;
}

type SettingsListener = (scene: Phaser.Scene) => void;

const applyListeners: SettingsListener[] = [];

export function defaultSettings(): GameSettings {
  return { volume: 0.8, music: true, sfx: true, screenshake: true, fullscreen: false };
}

function clampVolume(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function readFlag(value: unknown, fallback: boolean): boolean {
  if (value === true) {
    return true;
  }
  if (value === false) {
    return false;
  }
  return fallback;
}

export function onSettingsApplied(listener: SettingsListener): void {
  applyListeners.push(listener);
}

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultSettings();
    }
    const parsed = JSON.parse(raw) as Partial<GameSettings> & { muted?: boolean };
    const muted = parsed.muted === true;
    return {
      volume: typeof parsed.volume === 'number' ? clampVolume(parsed.volume) : 0.8,
      music: readFlag(parsed.music, !muted),
      sfx: readFlag(parsed.sfx, !muted),
      screenshake: parsed.screenshake !== false,
      fullscreen: parsed.fullscreen === true,
    };
  } catch {
    return defaultSettings();
  }
}

export function writeSettings(patch: Partial<GameSettings>): GameSettings {
  const next: GameSettings = { ...loadSettings(), ...patch };
  next.volume = clampVolume(next.volume);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function applySettings(scene: Phaser.Scene): void {
  const settings = loadSettings();
  scene.sound.mute = !settings.sfx;
  scene.sound.volume = settings.sfx ? settings.volume : 0;
  for (const listener of applyListeners) {
    listener(scene);
  }
}

export function maybeShake(scene: Phaser.Scene, duration: number, intensity: number): void {
  if (loadSettings().screenshake) {
    scene.cameras.main.shake(duration, intensity);
  }
}

export function setFullscreen(scene: Phaser.Scene, enabled: boolean): void {
  writeSettings({ fullscreen: enabled });
  if (enabled && !scene.scale.isFullscreen) {
    scene.scale.startFullscreen();
    lockLandscape();
    return;
  }
  if (!enabled && scene.scale.isFullscreen) {
    scene.scale.stopFullscreen();
  }
}
