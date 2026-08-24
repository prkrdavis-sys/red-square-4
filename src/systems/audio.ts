import Phaser from 'phaser';

import { type Theme } from '../config';
import { applySettings, loadSettings, onSettingsApplied } from '../data/settings';
import { themeBuffer } from './music';

type SfxName =
  | 'jump'
  | 'stomp'
  | 'hurt'
  | 'poof'
  | 'victory'
  | 'drop'
  | 'map'
  | 'select'
  | 'boss'
  | 'explode'
  | 'special'
  | 'collect'
  | 'phase'
  | 'enemy-shot'
  | 'firework'
  | 'firework-burst'
  | 'celebrate';

type SafariAudioState = AudioContextState | 'interrupted';

type AudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

const UNLOCK_EVENTS = ['pointerdown', 'mousedown', 'touchstart', 'click', 'keydown'] as const;

let audioCtx: AudioContext | null = null;
let unlockInstalled = false;

function audioContextConstructor(): typeof AudioContext | undefined {
  const audioWindow = window as AudioWindow;
  return window.AudioContext ?? audioWindow.webkitAudioContext;
}

function ctx(): AudioContext | null {
  if (audioCtx && audioCtx.state !== 'closed') {
    return audioCtx;
  }
  const Ctor = audioContextConstructor();
  if (!Ctor) {
    return null;
  }
  try {
    audioCtx = new Ctor();
  } catch {
    audioCtx = null;
  }
  return audioCtx;
}

function sceneContext(scene?: Phaser.Scene): AudioContext | null {
  if (audioCtx && audioCtx.state !== 'closed') {
    return audioCtx;
  }
  const fromPhaser = (scene?.sound as { context?: AudioContext } | undefined)?.context;
  if (fromPhaser && fromPhaser.state !== 'closed') {
    audioCtx = fromPhaser;
    return audioCtx;
  }
  return ctx();
}

function needsResume(context: AudioContext): boolean {
  const state = context.state as SafariAudioState;
  return state === 'suspended' || state === 'interrupted';
}

function prime(context: AudioContext): void {
  try {
    const buffer = context.createBuffer(1, 1, context.sampleRate || 44100);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(0);
  } catch {
    // Safari throws here when the context is not yet allowed to run.
  }
}

function peak(base: number): number {
  const settings = loadSettings();
  if (!settings.sfx) {
    return 0;
  }
  return base * settings.volume;
}

function envGain(context: AudioContext, duration: number, gainPeak: number): GainNode {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainPeak), context.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
  gain.connect(context.destination);
  return gain;
}

function beep(freq: number, duration: number, type: OscillatorType, gainPeak = 0.12, slide = 0): void {
  const scaled = peak(gainPeak);
  const context = ctx();
  if (scaled <= 0 || !context) {
    return;
  }
  const osc = context.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, context.currentTime);
  if (slide !== 0) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), context.currentTime + duration);
  }
  osc.connect(envGain(context, duration, scaled));
  osc.start();
  osc.stop(context.currentTime + duration + 0.02);
}

function noiseBurst(duration: number, gainPeak: number, freq = 900): void {
  const scaled = peak(gainPeak);
  const context = ctx();
  if (scaled <= 0 || !context) {
    return;
  }
  const bufferSize = Math.floor(context.sampleRate * duration);
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  const src = context.createBufferSource();
  src.buffer = buffer;
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq;
  src.connect(filter);
  filter.connect(envGain(context, duration, scaled));
  src.start();
}

function synth(name: SfxName): void {
  switch (name) {
    case 'jump':
      beep(280, 0.12, 'square', 0.08, 220);
      break;
    case 'stomp':
      beep(160, 0.09, 'triangle', 0.14, -80);
      noiseBurst(0.08, 0.1, 700);
      break;
    case 'hurt':
      beep(420, 0.22, 'sawtooth', 0.1, -280);
      break;
    case 'explode':
      noiseBurst(0.62, 0.46, 160);
      beep(46, 0.78, 'sine', 0.3, -10);
      beep(78, 0.42, 'triangle', 0.24, -28);
      beep(150, 0.2, 'sawtooth', 0.18, -100);
      window.setTimeout(() => noiseBurst(0.38, 0.3, 380), 45);
      window.setTimeout(() => beep(36, 0.95, 'sine', 0.2, -8), 70);
      window.setTimeout(() => noiseBurst(0.24, 0.2, 980), 110);
      window.setTimeout(() => beep(210, 0.14, 'square', 0.1, -170), 170);
      break;
    case 'poof':
      noiseBurst(0.28, 0.16, 500);
      beep(90, 0.2, 'triangle', 0.08, -40);
      break;
    case 'drop':
      beep(180, 0.08, 'square', 0.05, -60);
      break;
    case 'map':
      beep(520, 0.06, 'square', 0.05, 40);
      break;
    case 'select':
      beep(660, 0.08, 'square', 0.07, 80);
      break;
    case 'boss':
      noiseBurst(0.18, 0.14, 500);
      beep(140, 0.16, 'sawtooth', 0.16, -40);
      window.setTimeout(() => beep(220, 0.1, 'square', 0.12, 80), 70);
      window.setTimeout(() => beep(330, 0.12, 'square', 0.13, 40), 150);
      window.setTimeout(() => beep(98, 0.32, 'triangle', 0.14, -20), 240);
      break;
    case 'special':
      beep(240, 0.18, 'triangle', 0.1, 420);
      window.setTimeout(() => beep(620, 0.12, 'sine', 0.08, 120), 70);
      break;
    case 'collect':
      beep(740, 0.08, 'square', 0.08, 130);
      window.setTimeout(() => beep(1040, 0.12, 'triangle', 0.07, 100), 80);
      break;
    case 'phase':
      noiseBurst(0.15, 0.1, 800);
      beep(180, 0.3, 'sawtooth', 0.12, 260);
      break;
    case 'enemy-shot':
      beep(330, 0.09, 'square', 0.045, -120);
      break;
    case 'victory':
      beep(523.25, 0.12, 'square', 0.09);
      window.setTimeout(() => beep(659.25, 0.12, 'square', 0.09), 110);
      window.setTimeout(() => beep(783.99, 0.12, 'square', 0.09), 220);
      window.setTimeout(() => beep(1046.5, 0.28, 'square', 0.11), 340);
      break;
    case 'firework':
      noiseBurst(0.14, 0.04, 1100);
      beep(380, 0.14, 'sine', 0.035, 420);
      break;
    case 'firework-burst':
      noiseBurst(0.09, 0.055, 2600);
      beep(980, 0.07, 'triangle', 0.04, -320);
      window.setTimeout(() => {
        noiseBurst(0.06, 0.03, 3200);
        beep(1480, 0.05, 'sine', 0.025, -500);
      }, 35);
      break;
    case 'celebrate':
      beep(784, 0.055, 'square', 0.038);
      window.setTimeout(() => beep(988, 0.055, 'square', 0.038), 55);
      window.setTimeout(() => beep(1318.5, 0.09, 'triangle', 0.042), 110);
      break;
    default: {
      const neverName: never = name;
      return neverName;
    }
  }
}

function emit(scene: Phaser.Scene, name: SfxName): void {
  const settings = loadSettings();
  if (!settings.sfx) {
    return;
  }
  const cacheKey = `sfx-${name}`;
  if (scene.cache.audio.exists(cacheKey) && !scene.sound.locked) {
    const base = name === 'victory' || name === 'explode' ? 0.7 : 0.45;
    scene.sound.play(cacheKey, { volume: base * settings.volume });
    return;
  }
  synth(name);
}

let musicSource: AudioBufferSourceNode | null = null;
let musicGain: GainNode | null = null;
let currentTheme: Theme | null = null;
let pendingTheme: Theme = 'grass';
let musicDuck = 1;

function musicLevel(): number {
  const settings = loadSettings();
  if (!settings.music) {
    return 0;
  }
  return 0.18 * settings.volume * musicDuck;
}

function applyMusicMix(): void {
  if (!musicGain) {
    return;
  }
  try {
    musicGain.gain.setTargetAtTime(Math.max(0.0001, musicLevel()), musicGain.context.currentTime, 0.05);
  } catch {
    // Context may already be closed.
  }
}

function stopMusicSource(): void {
  try {
    musicSource?.stop();
  } catch {
    // Already stopped.
  }
  musicSource?.disconnect();
  musicGain?.disconnect();
  musicSource = null;
  musicGain = null;
  currentTheme = null;
}

function startTheme(theme: Theme): void {
  if (!loadSettings().music) {
    stopMusicSource();
    return;
  }
  const context = ctx();
  if (!context) {
    return;
  }
  if (currentTheme === theme && musicSource && musicGain) {
    applyMusicMix();
    return;
  }
  const buffer = themeBuffer(context, theme);
  stopMusicSource();
  musicGain = context.createGain();
  musicGain.gain.setValueAtTime(Math.max(0.0001, musicLevel()), context.currentTime);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(musicGain);
  musicGain.connect(context.destination);
  source.start();
  musicSource = source;
  currentTheme = theme;
  source.onended = () => {
    if (musicSource === source) {
      musicSource = null;
      currentTheme = null;
    }
  };
}

function syncMusic(): void {
  if (!loadSettings().music) {
    stopMusicSource();
    return;
  }
  const context = ctx();
  if (!context || needsResume(context)) {
    applyMusicMix();
    return;
  }
  startTheme(pendingTheme);
}

export const audio = {
  ensureContext(): AudioContext | null {
    return ctx();
  },

  install(): void {
    if (unlockInstalled) {
      return;
    }
    unlockInstalled = true;
    onSettingsApplied(() => {
      syncMusic();
    });
    const resume = () => {
      void this.unlock();
    };
    for (const type of UNLOCK_EVENTS) {
      window.addEventListener(type, resume, { capture: true });
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && audioCtx) {
        resume();
      }
    });
  },

  unlock(scene?: Phaser.Scene): Promise<boolean> {
    this.install();
    const context = sceneContext(scene);
    if (scene?.sound.locked) {
      scene.sound.unlock();
    }
    if (!context) {
      return Promise.resolve(false);
    }
    prime(context);
    if (!needsResume(context)) {
      syncMusic();
      return Promise.resolve(context.state === 'running');
    }
    return context
      .resume()
      .then(() => {
        prime(context);
        syncMusic();
        return context.state === 'running';
      })
      .catch(() => false);
  },

  playTheme(scene: Phaser.Scene, theme: Theme): void {
    pendingTheme = theme;
    musicDuck = 1;
    applySettings(scene);
    void this.unlock(scene).then(() => {
      if (pendingTheme === theme && loadSettings().music) {
        startTheme(theme);
      }
    });
  },

  setMusicDuck(amount: number): void {
    musicDuck = Math.min(1, Math.max(0, amount));
    applyMusicMix();
  },

  play(scene: Phaser.Scene, name: SfxName): void {
    applySettings(scene);
    const settings = loadSettings();
    if (!settings.sfx) {
      return;
    }
    const context = sceneContext(scene);
    if (context && !needsResume(context) && !scene.sound.locked) {
      emit(scene, name);
      return;
    }
    void this.unlock(scene).then(() => {
      if (loadSettings().sfx) {
        emit(scene, name);
      }
    });
  },
};
