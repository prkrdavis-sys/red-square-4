import { type Theme } from '../config';

export const RECORDED_THEME_URLS: Partial<Record<Theme, string>> = {
  grass: 'assets/audio/grass-overworld.mp3',
  desert: 'assets/audio/desert-overworld.mp3',
};

export const LOOP_FADE_SECONDS = 2.5;

export function recordedThemeUrl(theme: Theme): string | null {
  switch (theme) {
    case 'grass':
      return RECORDED_THEME_URLS.grass ?? null;
    case 'desert':
      return RECORDED_THEME_URLS.desert ?? null;
    case 'snow':
    case 'ocean':
    case 'castle':
    case 'rainforest':
      return null;
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

export function loopableLength(
  samples: Float32Array,
  sampleRate: number,
  rmsThreshold = 0.04,
  windowMs = 80,
): number {
  const window = Math.max(1, Math.round((sampleRate * windowMs) / 1000));
  if (samples.length === 0) {
    return 0;
  }
  for (let start = samples.length - window; start >= 0; start -= window) {
    let sum = 0;
    const end = Math.min(samples.length, start + window);
    for (let i = start; i < end; i += 1) {
      const value = samples[i] ?? 0;
      sum += value * value;
    }
    if (Math.sqrt(sum / (end - start)) > rmsThreshold) {
      return end;
    }
  }
  return samples.length;
}

export function crossfadeLoop(input: Float32Array, fadeSamples: number): Float32Array {
  if (fadeSamples <= 0 || fadeSamples * 2 >= input.length) {
    return input.slice();
  }
  const outLen = input.length - fadeSamples;
  const out = new Float32Array(outLen);
  out.set(input.subarray(0, outLen));
  for (let i = 0; i < fadeSamples; i += 1) {
    const t = i / fadeSamples;
    const fadeIn = Math.sin(t * Math.PI * 0.5);
    const fadeOut = Math.cos(t * Math.PI * 0.5);
    out[i] = (input[i] ?? 0) * fadeIn + (input[outLen + i] ?? 0) * fadeOut;
  }
  return out;
}

function mixDown(channels: Float32Array[]): Float32Array {
  const length = channels[0]?.length ?? 0;
  const mix = new Float32Array(length);
  const count = Math.max(1, channels.length);
  for (let i = 0; i < length; i += 1) {
    let sum = 0;
    for (const channel of channels) {
      sum += channel[i] ?? 0;
    }
    mix[i] = sum / count;
  }
  return mix;
}

export function makeSeamlessLoop(
  context: AudioContext,
  buffer: AudioBuffer,
  fadeSeconds = LOOP_FADE_SECONDS,
): AudioBuffer {
  const channels: Float32Array[] = [];
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    channels.push(buffer.getChannelData(channel));
  }
  const keep = loopableLength(mixDown(channels), buffer.sampleRate);
  const fadeSamples = Math.min(Math.floor(fadeSeconds * buffer.sampleRate), Math.floor(keep / 3));
  const looped = channels.map((channel) => crossfadeLoop(channel.subarray(0, keep), fadeSamples));
  const frames = looped[0]?.length ?? 0;
  const out = context.createBuffer(Math.max(1, looped.length), Math.max(1, frames), buffer.sampleRate);
  for (let channel = 0; channel < looped.length; channel += 1) {
    const data = looped[channel];
    if (data) {
      out.getChannelData(channel).set(data);
    }
  }
  return out;
}
