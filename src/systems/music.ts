import { type Theme } from '../config';

const STEPS_PER_BEAT = 4;

interface VoiceNote {
  start: number;
  midi: number;
  steps: number;
}

interface PulseSpec {
  duty: number;
  gain: number;
  vibrato: number;
  notes: string;
}

interface Song {
  bpm: number;
  length: number;
  filterHz: number;
  echoMs: number;
  echoMix: number;
  pulse1: PulseSpec;
  pulse2: PulseSpec;
  bass: { gain: number; notes: string };
  drums: string;
}

const PITCH_CLASS: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function toMidi(token: string): number {
  const match = token.match(/^([A-G])([#b]?)(\d)$/);
  if (!match) {
    return 0;
  }
  const letter = match[1];
  if (!letter) {
    return 0;
  }
  let pc = PITCH_CLASS[letter] ?? 0;
  if (match[2] === '#') {
    pc += 1;
  }
  if (match[2] === 'b') {
    pc -= 1;
  }
  return (Number(match[3]) + 1) * 12 + pc;
}

function tokens(src: string): string[] {
  return src
    .replace(/\|/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

export function countSteps(src: string): number {
  let cursor = 0;
  for (const token of tokens(src)) {
    const dur = token.split('/')[1];
    const steps = dur ? Number(dur) : 2;
    if (Number.isFinite(steps) && steps > 0) {
      cursor += steps;
    }
  }
  return cursor;
}

export function parseNotes(src: string, loopSteps: number): VoiceNote[] {
  const raw: VoiceNote[] = [];
  let cursor = 0;
  for (const token of tokens(src)) {
    const [name, dur] = token.split('/');
    const steps = dur ? Number(dur) : 2;
    if (!name || !Number.isFinite(steps) || steps <= 0) {
      continue;
    }
    const midi = name === 'r' || name === 'R' || name === '-' ? 0 : toMidi(name);
    if (midi > 0) {
      raw.push({ start: cursor, midi, steps });
    }
    cursor += steps;
  }
  const phrase = cursor > 0 ? cursor : loopSteps;
  const notes: VoiceNote[] = [];
  for (let offset = 0; offset < loopSteps; offset += phrase) {
    for (const note of raw) {
      const start = note.start + offset;
      if (start >= loopSteps) {
        continue;
      }
      notes.push({
        start,
        midi: note.midi,
        steps: Math.min(note.steps, loopSteps - start),
      });
    }
  }
  return notes;
}

export function parseDrums(src: string, loopSteps: number): string {
  const pattern = src.replace(/\|/g, '').replace(/\s/g, '');
  if (pattern.length === 0) {
    return '-'.repeat(loopSteps);
  }
  let out = '';
  while (out.length < loopSteps) {
    out += pattern;
  }
  return out.slice(0, loopSteps);
}

function arp(chord: string[], steps: number): string {
  const notes: string[] = [];
  for (let i = 0; i < steps; i += 1) {
    notes.push(`${chord[i % chord.length]}/1`);
  }
  return notes.join(' ');
}

function drums(...bars: string[]): string {
  return bars.map((bar) => bar.replace(/\|/g, '').replace(/\s/g, '')).join('');
}

function polyBlep(phase: number, increment: number): number {
  if (increment <= 0) {
    return 0;
  }
  if (phase < increment) {
    const x = phase / increment;
    return x + x - x * x - 1;
  }
  if (phase > 1 - increment) {
    const x = (phase - 1) / increment;
    return x * x + x + x + 1;
  }
  return 0;
}

function envPulse(t: number, dur: number): number {
  const attack = 0.006;
  const decay = 0.05;
  const release = Math.min(0.06, dur * 0.18);
  const sustain = 0.62;
  if (t < attack) {
    return t / attack;
  }
  if (t < attack + decay) {
    return 1 - (1 - sustain) * ((t - attack) / decay);
  }
  if (t < dur - release) {
    return sustain;
  }
  if (t >= dur) {
    return 0;
  }
  return sustain * (1 - (t - (dur - release)) / release);
}

function envBass(t: number, dur: number): number {
  const attack = 0.003;
  const release = 0.012;
  if (t < attack) {
    return t / attack;
  }
  if (t > dur - release) {
    return Math.max(0, (dur - t) / release);
  }
  return 1;
}

function addPulse(
  data: Float32Array,
  sr: number,
  notes: VoiceNote[],
  bpm: number,
  duty: number,
  gain: number,
  vibrato: number,
  gate: number,
): void {
  const stepSec = 60 / bpm / STEPS_PER_BEAT;
  let phase = 0.12;
  for (const note of notes) {
    const start = Math.floor(note.start * stepSec * sr);
    const dur = note.steps * stepSec * gate;
    const count = Math.floor(dur * sr);
    const base = midiToFreq(note.midi);
    for (let i = 0; i < count; i += 1) {
      const idx = start + i;
      if (idx >= data.length) {
        break;
      }
      const t = i / sr;
      const freq = vibrato > 0 ? base * (1 + vibrato * Math.sin(2 * Math.PI * 5.4 * t)) : base;
      const increment = freq / sr;
      let sample = phase < duty ? 1 : -1;
      sample += polyBlep(phase, increment);
      let dutyPhase = phase - duty;
      if (dutyPhase < 0) {
        dutyPhase += 1;
      }
      sample -= polyBlep(dutyPhase, increment);
      data[idx] += sample * gain * envPulse(t, dur);
      phase += increment;
      if (phase >= 1) {
        phase -= 1;
      }
    }
  }
}

function addBass(data: Float32Array, sr: number, notes: VoiceNote[], bpm: number, gain: number): void {
  const stepSec = 60 / bpm / STEPS_PER_BEAT;
  let phase = 0;
  for (const note of notes) {
    const start = Math.floor(note.start * stepSec * sr);
    const dur = note.steps * stepSec * 0.98;
    const count = Math.floor(dur * sr);
    const increment = midiToFreq(note.midi) / sr;
    for (let i = 0; i < count; i += 1) {
      const idx = start + i;
      if (idx >= data.length) {
        break;
      }
      const tri = 1 - 4 * Math.abs(phase - 0.5);
      data[idx] += tri * gain * envBass(i / sr, dur);
      phase += increment;
      if (phase >= 1) {
        phase -= 1;
      }
    }
  }
}

function addHit(
  data: Float32Array,
  start: number,
  sr: number,
  seconds: number,
  sampleAt: (t: number) => number,
): void {
  const count = Math.floor(seconds * sr);
  for (let i = 0; i < count; i += 1) {
    const idx = start + i;
    if (idx >= data.length) {
      return;
    }
    data[idx] += sampleAt(i / sr);
  }
}

function addDrums(data: Float32Array, sr: number, pattern: string, bpm: number): void {
  const stepSec = 60 / bpm / STEPS_PER_BEAT;
  for (let step = 0; step < pattern.length; step += 1) {
    const kind = pattern[step];
    const at = Math.floor(step * stepSec * sr);
    switch (kind) {
      case 'k':
        addHit(data, at, sr, 0.11, (t) => {
          const freq = 130 * (40 / 130) ** (t / 0.09);
          return Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 16) * 0.22;
        });
        break;
      case 's':
        addHit(data, at, sr, 0.09, (t) => {
          const noise = Math.random() * 2 - 1;
          return (noise * 0.7 + Math.sin(2 * Math.PI * 190 * t) * 0.3) * Math.exp(-t * 22) * 0.16;
        });
        break;
      case 'h':
        addHit(data, at, sr, 0.035, (t) => (Math.random() * 2 - 1) * Math.exp(-t * 48) * 0.045);
        break;
      case 'o':
        addHit(data, at, sr, 0.09, (t) => (Math.random() * 2 - 1) * Math.exp(-t * 18) * 0.05);
        break;
      case 'c':
        addHit(data, at, sr, 0.06, (t) => (Math.random() * 2 - 1) * Math.exp(-t * 28) * 0.12);
        break;
      case 't':
        addHit(data, at, sr, 0.1, (t) => {
          const freq = 210 * (70 / 210) ** (t / 0.1);
          return Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 14) * 0.14;
        });
        break;
      case 'b':
        addHit(data, at, sr, 0.08, (t) => {
          const freq = 980 * (420 / 980) ** (t / 0.08);
          return Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 14) * 0.07;
        });
        break;
      case '-':
      case '.':
        break;
      default:
        break;
    }
  }
}

function lowpass(data: Float32Array, sr: number, hz: number): void {
  const rc = 1 / (2 * Math.PI * hz);
  const a = 1 / sr / (rc + 1 / sr);
  let prev = 0;
  for (let i = 0; i < data.length; i += 1) {
    prev += a * ((data[i] ?? 0) - prev);
    data[i] = prev;
  }
}

function foldTail(data: Float32Array, loopSamples: number): void {
  for (let i = loopSamples; i < data.length; i += 1) {
    const dest = i - loopSamples;
    data[dest] = (data[dest] ?? 0) + (data[i] ?? 0);
  }
}

function limit(data: Float32Array, loopSamples: number): void {
  for (let i = 0; i < loopSamples; i += 1) {
    data[i] = Math.tanh((data[i] ?? 0) * 0.92);
  }
}

function renderSong(context: AudioContext, song: Song): AudioBuffer {
  const sr = context.sampleRate;
  const loopSec = song.length * (60 / song.bpm / STEPS_PER_BEAT);
  const loopSamples = Math.floor(loopSec * sr);
  const tail = Math.floor(sr * Math.max(0.35, song.echoMs / 1000 + 0.12));
  const data = new Float32Array(loopSamples + tail);
  addPulse(data, sr, parseNotes(song.pulse1.notes, song.length), song.bpm, song.pulse1.duty, song.pulse1.gain, song.pulse1.vibrato, 0.84);
  addPulse(data, sr, parseNotes(song.pulse2.notes, song.length), song.bpm, song.pulse2.duty, song.pulse2.gain, song.pulse2.vibrato, 0.78);
  addBass(data, sr, parseNotes(song.bass.notes, song.length), song.bpm, song.bass.gain);
  addDrums(data, sr, parseDrums(song.drums, song.length), song.bpm);
  if (song.echoMs > 0 && song.echoMix > 0) {
    const delay = Math.floor((sr * song.echoMs) / 1000);
    for (let i = delay; i < data.length; i += 1) {
      data[i] = (data[i] ?? 0) + (data[i - delay] ?? 0) * song.echoMix;
    }
  }
  lowpass(data, sr, song.filterHz);
  foldTail(data, loopSamples);
  limit(data, loopSamples);
  const buffer = context.createBuffer(1, loopSamples, sr);
  buffer.getChannelData(0).set(data.subarray(0, loopSamples));
  return buffer;
}

const GRASS: Song = {
  bpm: 148,
  length: 128,
  filterHz: 9200,
  echoMs: 0,
  echoMix: 0,
  pulse1: {
    duty: 0.25,
    gain: 0.1,
    vibrato: 0.007,
    notes: `
      G5/2 E5/2 C5/2 G4/2 E5/2 C5/2 G5/4
      A5/2 F5/2 C5/2 A4/2 G5/2 D5/2 B4/2 G4/2
      C5/2 E5/2 G5/2 C6/2 B5/4 A5/2 G5/2
      A5/2 F5/2 D5/2 F5/2 G5/2 F5/2 E5/2 D5/2
      G5/2 E5/2 C5/2 E5/2 G5/4 C6/4
      A5/4 G5/2 F5/2 E5/2 D5/2 C5/2 D5/2
      E5/2 G5/2 C6/2 E6/2 D6/4 B5/4
      C6/2 G5/2 E5/2 C5/2 D5/4 G5/4
    `,
  },
  pulse2: {
    duty: 0.5,
    gain: 0.042,
    vibrato: 0,
    notes: [
      arp(['C4', 'E4', 'G4', 'E4'], 16),
      arp(['C4', 'E4', 'G4', 'C5'], 16),
      arp(['F4', 'A4', 'C5', 'A4'], 16),
      arp(['G4', 'B4', 'D5', 'B4'], 16),
      arp(['A3', 'C4', 'E4', 'C4'], 16),
      arp(['F4', 'A4', 'C5', 'F4'], 16),
      arp(['G4', 'B4', 'D5', 'G4'], 16),
      arp(['C4', 'E4', 'G4', 'C5'], 16),
    ].join(' '),
  },
  bass: {
    gain: 0.1,
    notes: `
      C3/4 C3/4 G2/4 C3/4
      F2/4 F2/4 A2/4 F2/4
      C3/4 E3/4 G2/4 C3/4
      G2/4 D3/4 G2/4 B2/4
      A2/4 A2/4 E3/4 C3/4
      F2/4 C3/4 F2/4 A2/4
      G2/4 G2/4 D3/4 G2/4
      C3/4 G2/4 E3/4 C3/4
    `,
  },
  drums: drums(
    'k-h-s-h-k-h-s-h-',
    'k-h-s-h-k-h-s-ho',
    'k-h-s-h-k-h-s-h-',
    'k-h-s-h-khc-s-h-',
    'k-h-s-h-k-h-s-h-',
    'k-h-s-h-k-h-s-ho',
    'k-h-s-h-k-h-s-h-',
    'k-h-s-hk-hc-s-h-',
  ),
};

const SNOW: Song = {
  bpm: 108,
  length: 96,
  filterHz: 11000,
  echoMs: 210,
  echoMix: 0.22,
  pulse1: {
    duty: 0.125,
    gain: 0.088,
    vibrato: 0.012,
    notes: `
      A5/4 C#6/4 E6/4
      F#6/4 E6/2 D6/2 C#6/4
      B5/4 D6/4 C#6/2 B5/2
      A5/8 r/4
      E6/4 C#6/4 A5/4
      D6/4 B5/4 G#5/4
      A5/2 B5/2 C#6/4 A5/4
      E6/8 r/4
    `,
  },
  pulse2: {
    duty: 0.125,
    gain: 0.036,
    vibrato: 0.004,
    notes: `
      E5/4 A5/4 C#6/4
      F#5/4 A5/4 D6/4
      G#5/4 B5/4 E6/4
      A5/8 E5/4
      C#5/4 E5/4 A5/4
      B4/4 D5/4 G#5/4
      A4/4 E5/4 C#6/4
      A5/8 r/4
    `,
  },
  bass: {
    gain: 0.092,
    notes: `
      A2/4 E3/4 A3/4
      D3/4 A2/4 F#3/4
      E3/4 B2/4 G#3/4
      A2/8 E3/4
      A2/4 C#3/4 E3/4
      D3/4 F#3/4 A2/4
      E3/4 G#2/4 B2/4
      A2/8 A2/4
    `,
  },
  drums: drums(
    'k---h---s---',
    'k---h---s-h-',
    'k---h---s---',
    'k-h-h---s---',
    'k---h---s---',
    'k---h---s-h-',
    'k---h---s---',
    'k---h-c-s---',
  ),
};

const DESERT: Song = {
  bpm: 124,
  length: 128,
  filterHz: 8200,
  echoMs: 90,
  echoMix: 0.12,
  pulse1: {
    duty: 0.5,
    gain: 0.096,
    vibrato: 0.005,
    notes: `
      D5/2 Eb5/2 F#5/4 G5/2 F#5/2 Eb5/2 D5/2
      A5/4 G5/2 F#5/2 Eb5/4 D5/4
      D5/2 A4/2 D5/4 F#5/2 G5/2 A5/4
      Bb5/4 A5/2 G5/2 F#5/4 r/4
      D5/2 F#5/2 A5/2 D6/2 C6/2 Bb5/2 A5/4
      G5/4 Eb5/4 F#5/4 D5/4
      A4/2 D5/2 Eb5/2 F#5/2 G5/4 F#5/4
      Eb5/2 D5/2 C5/2 A4/2 D5/8
    `,
  },
  pulse2: {
    duty: 0.25,
    gain: 0.038,
    vibrato: 0,
    notes: [
      arp(['D4', 'A4', 'D5', 'A4'], 16),
      arp(['D4', 'Eb4', 'A4', 'Eb4'], 16),
      arp(['D4', 'F#4', 'A4', 'F#4'], 16),
      arp(['C4', 'G4', 'Bb4', 'G4'], 16),
      arp(['D4', 'A4', 'D5', 'F#4'], 16),
      arp(['Eb4', 'G4', 'Bb4', 'G4'], 16),
      arp(['D4', 'F#4', 'A4', 'D5'], 16),
      arp(['D4', 'A3', 'D4', 'A4'], 16),
    ].join(' '),
  },
  bass: {
    gain: 0.11,
    notes: `
      D2/8 A2/8
      D2/4 A2/4 D2/8
      Bb1/8 C2/8
      D2/4 A2/4 D2/4 A2/4
      D2/8 F#2/8
      G2/8 Eb2/8
      D2/4 A2/4 C2/8
      D2/8 A1/8
    `,
  },
  drums: drums(
    'khchks-hkhchks-h',
    'khchks-hkhctks-h',
    'khchks-hkhchks-h',
    'k-c-k-s-k-t-s-c-',
    'khchks-hkhchks-h',
    'khchks-hkhchks-h',
    'khctks-hkhchks-h',
    'k-c-s-t-k-s-c-k-',
  ),
};

const OCEAN: Song = {
  bpm: 86,
  length: 128,
  filterHz: 2400,
  echoMs: 360,
  echoMix: 0.34,
  pulse1: {
    duty: 0.125,
    gain: 0.08,
    vibrato: 0.014,
    notes: `
      E5/8 B4/8
      G5/8 A5/8
      B5/4 A5/4 G5/8
      E5/8 D5/8
      G5/8 E5/8
      A5/4 B5/4 D6/8
      C6/8 B5/8
      A5/4 G5/4 E5/8
    `,
  },
  pulse2: {
    duty: 0.5,
    gain: 0.04,
    vibrato: 0.006,
    notes: [
      arp(['E3', 'B3', 'E4', 'G4'], 16),
      arp(['G3', 'D4', 'G4', 'B4'], 16),
      arp(['A3', 'E4', 'A4', 'C5'], 16),
      arp(['E3', 'B3', 'E4', 'G4'], 16),
      arp(['C4', 'G4', 'C5', 'E4'], 16),
      arp(['A3', 'E4', 'A4', 'C5'], 16),
      arp(['B3', 'F#4', 'B4', 'D5'], 16),
      arp(['E3', 'B3', 'E4', 'G4'], 16),
    ].join(' '),
  },
  bass: {
    gain: 0.1,
    notes: `
      E2/8 B1/8
      G2/8 D2/8
      A2/8 E2/8
      E2/8 B1/8
      C2/8 G2/8
      A2/8 E2/8
      B1/8 F#2/8
      E2/8 E2/8
    `,
  },
  drums: drums(
    'k--b----s--b-k--',
    'k-------s-b---b-',
    'k--b----s----k-b',
    'k-----b-s--b----',
    'k--b----s--b-k--',
    'k-------s-b---b-',
    'k--b--t-s----k-b',
    'k-----b-s--b--k-',
  ),
};

const CASTLE: Song = {
  bpm: 114,
  length: 128,
  filterHz: 5400,
  echoMs: 140,
  echoMix: 0.16,
  pulse1: {
    duty: 0.125,
    gain: 0.092,
    vibrato: 0.004,
    notes: `
      D4/4 A4/2 G4/2 F4/4 E4/4
      F4/4 E4/4 D4/2 C#4/2 D4/4
      A4/2 C5/2 A4/4 G4/4 F4/4
      E4/8 D4/4 A3/4
      D5/4 C5/2 Bb4/2 A4/4 G4/4
      A4/4 G4/4 F4/4 E4/4
      F4/2 D4/2 A4/2 F4/2 E4/4 D4/4
      C#4/8 D4/8
    `,
  },
  pulse2: {
    duty: 0.125,
    gain: 0.034,
    vibrato: 0,
    notes: [
      arp(['D3', 'A3', 'D4', 'F4'], 16),
      arp(['D3', 'Ab3', 'C4', 'F4'], 16),
      arp(['C3', 'G3', 'C4', 'E4'], 16),
      arp(['D3', 'A3', 'D4', 'A3'], 16),
      arp(['Bb2', 'F3', 'Bb3', 'D4'], 16),
      arp(['A2', 'E3', 'A3', 'C#4'], 16),
      arp(['D3', 'F3', 'A3', 'D4'], 16),
      arp(['D3', 'A2', 'D3', 'F3'], 16),
    ].join(' '),
  },
  bass: {
    gain: 0.12,
    notes: `
      D2/2 A2/2 D3/2 A2/2 C2/2 G2/2 C3/2 G2/2
      D2/2 F2/2 Ab2/2 F2/2 D2/2 A2/2 D3/2 A2/2
      Bb1/2 F2/2 Bb2/2 F2/2 A1/2 E2/2 A2/2 E2/2
      D2/2 A2/2 D3/2 A2/2 Ab2/4 G2/4
      D2/2 A2/2 D3/2 A2/2 Bb1/2 F2/2 Bb2/2 F2/2
      A1/2 E2/2 A2/2 C#3/2 D2/2 A2/2 D3/2 A2/2
      F2/2 C3/2 F3/2 C3/2 G2/2 D3/2 G2/2 D2/2
      D2/4 C#2/4 D2/8
    `,
  },
  drums: drums(
    'k---s---k-k-s---',
    'k---s---k---s-t-',
    'k---s---k-k-s---',
    'k---s-t-k---s---',
    'k---s---k-k-s---',
    'k---s---k---s-c-',
    'k---s---k-k-s---',
    'k-t-s-k-k---s---',
  ),
};

const RAINFOREST: Song = {
  bpm: 134,
  length: 128,
  filterHz: 7800,
  echoMs: 70,
  echoMix: 0.1,
  pulse1: {
    duty: 0.25,
    gain: 0.098,
    vibrato: 0.008,
    notes: `
      G5/2 A5/2 C6/2 A5/2 G5/2 E5/2 D5/4
      C6/2 D6/2 E6/2 D6/2 C6/2 A5/2 G5/4
      E5/2 G5/2 A5/4 C6/2 A5/2 G5/4
      F5/4 D5/4 E5/4 D5/4
      G5/2 B5/2 D6/2 B5/2 C6/4 A5/4
      F5/2 A5/2 C6/4 D6/2 C6/2 A5/4
      G5/4 E5/2 G5/2 A5/4 G5/4
      F5/4 D5/4 G5/8
    `,
  },
  pulse2: {
    duty: 0.5,
    gain: 0.04,
    vibrato: 0,
    notes: [
      arp(['G3', 'B3', 'D4', 'G4'], 16),
      arp(['C4', 'E4', 'G4', 'C5'], 16),
      arp(['A3', 'C4', 'E4', 'A4'], 16),
      arp(['F3', 'A3', 'C4', 'F4'], 16),
      arp(['G3', 'B3', 'D4', 'B3'], 16),
      arp(['F3', 'A3', 'C4', 'A3'], 16),
      arp(['E3', 'G3', 'B3', 'E4'], 16),
      arp(['D3', 'G3', 'B3', 'D4'], 16),
    ].join(' '),
  },
  bass: {
    gain: 0.1,
    notes: `
      G2/2 r/2 G2/2 Bb2/2 C3/4 G2/4
      C3/2 r/2 C3/2 E3/2 G2/4 C3/4
      A2/2 r/2 A2/2 C3/2 E3/4 A2/4
      F2/4 C3/4 D3/4 F2/4
      G2/2 r/2 B2/2 D3/2 C3/4 A2/4
      F2/2 r/2 A2/2 C3/2 D3/4 C3/4
      E2/4 G2/4 A2/4 E2/4
      D2/4 F2/4 G2/8
    `,
  },
  drums: drums(
    'k-h-s-hk-h-s-h-h',
    'k-hcs-h-k-hs-h-h',
    'k-h-s-hk-h-s-h-h',
    'k-hc-t-sk-h-s-c-',
    'k-h-s-hk-h-s-h-h',
    'k-hcs-h-k-hs-h-h',
    'k-h-s-hk-h-s-h-h',
    'k-s-k-s-k-hcs-h-',
  ),
};

const SONGS: Record<Theme, Song> = {
  grass: GRASS,
  snow: SNOW,
  desert: DESERT,
  ocean: OCEAN,
  castle: CASTLE,
  rainforest: RAINFOREST,
};

const buffers = new WeakMap<AudioContext, Map<Theme, AudioBuffer>>();

export function biomeSong(theme: Theme): Song {
  return SONGS[theme];
}

export function themeBuffer(context: AudioContext, theme: Theme): AudioBuffer {
  let cache = buffers.get(context);
  if (!cache) {
    cache = new Map();
    buffers.set(context, cache);
  }
  const hit = cache.get(theme);
  if (hit) {
    return hit;
  }
  const buffer = renderSong(context, SONGS[theme]);
  cache.set(theme, buffer);
  return buffer;
}
