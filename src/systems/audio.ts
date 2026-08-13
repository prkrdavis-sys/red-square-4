import Phaser from 'phaser';

import { applySettings, loadSettings } from '../data/settings';

type SfxName = 'jump' | 'stomp' | 'hurt' | 'poof' | 'victory' | 'drop' | 'map' | 'select';

let audioCtx: AudioContext | null = null;

function ctx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function peak(base: number): number {
  const settings = loadSettings();
  if (settings.muted) {
    return 0;
  }
  return base * settings.volume;
}

function envGain(duration: number, gainPeak: number): GainNode {
  const context = ctx();
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainPeak), context.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
  gain.connect(context.destination);
  return gain;
}

function beep(freq: number, duration: number, type: OscillatorType, gainPeak = 0.12, slide = 0): void {
  const scaled = peak(gainPeak);
  if (scaled <= 0) {
    return;
  }
  const context = ctx();
  const osc = context.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, context.currentTime);
  if (slide !== 0) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), context.currentTime + duration);
  }
  osc.connect(envGain(duration, scaled));
  osc.start();
  osc.stop(context.currentTime + duration + 0.02);
}

function noiseBurst(duration: number, gainPeak: number, freq = 900): void {
  const scaled = peak(gainPeak);
  if (scaled <= 0) {
    return;
  }
  const context = ctx();
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
  filter.connect(envGain(duration, scaled));
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
    case 'victory':
      beep(523.25, 0.12, 'square', 0.09);
      window.setTimeout(() => beep(659.25, 0.12, 'square', 0.09), 110);
      window.setTimeout(() => beep(783.99, 0.12, 'square', 0.09), 220);
      window.setTimeout(() => beep(1046.5, 0.28, 'square', 0.11), 340);
      break;
    default: {
      const neverName: never = name;
      return neverName;
    }
  }
}

export const audio = {
  unlock(): void {
    const context = ctx();
    if (context.state === 'suspended') {
      void context.resume();
    }
  },

  play(scene: Phaser.Scene, name: SfxName): void {
    this.unlock();
    applySettings(scene);
    const settings = loadSettings();
    if (settings.muted) {
      return;
    }
    const cacheKey = `sfx-${name}`;
    if (scene.cache.audio.exists(cacheKey)) {
      const base = name === 'victory' ? 0.7 : 0.45;
      scene.sound.play(cacheKey, { volume: base * settings.volume });
      return;
    }
    synth(name);
  },
};
