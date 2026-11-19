// F06 sound, the voices (life depth). Everything is synthesized with the
// Web Audio API: no sound files. Soft and few, like the drawing: a note
// when a piece lands (pitched by how high it sits, timbred by its kind), a
// pop when one is taken away, a quiet sea, wind that swells with the gusts,
// gulls now and then, and one bell as evening comes.
//
// The choices (which note, which timbre) are pure functions, tested without
// audio; the rest only builds and plays nodes on an AudioContext it is given.

import type { Kind } from '@/core/kinds';

/** A major pentatonic from C4, two octaves and a bit: higher pieces sing higher notes. */
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66];

export type Timbre = 'wood' | 'bell' | 'stone' | 'leaf' | 'plank' | 'soft';

/** The note a piece landing at `level` sings (Hz). */
export function noteFor(level: number): number {
  return SCALE[Math.max(0, Math.min(SCALE.length - 1, Math.round(level)))]!;
}

/** How a piece of a kind sounds when it lands. */
export function timbreFor(kind: Kind | undefined): Timbre {
  switch (kind) {
    case 'house':
    case 'stairs':
    case 'fence':
      return 'wood';
    case 'tower':
    case 'lighthouse':
    case 'windmill':
      return 'bell';
    case 'marble':
    case 'arch':
    case 'pillar':
    case 'wall':
    case 'fountain':
      return 'stone';
    case 'tree':
      return 'leaf';
    case 'dock':
    case 'stall':
      return 'plank';
    default:
      return 'soft';
  }
}

/** Partials of each timbre: [ratio to the note, gain, decay seconds]. */
const PARTIALS: Record<Timbre, readonly (readonly [number, number, number])[]> = {
  wood: [[1, 1, 0.45], [2, 0.35, 0.2], [3.01, 0.12, 0.1]],
  bell: [[1, 1, 1.4], [2.0, 0.4, 0.9], [2.76, 0.32, 0.7], [5.4, 0.12, 0.35]],
  stone: [[1, 1, 0.28], [2.32, 0.3, 0.12], [4.1, 0.15, 0.06]],
  leaf: [[1, 0.8, 0.35], [2, 0.2, 0.15]],
  plank: [[0.5, 0.9, 0.35], [1, 0.6, 0.25], [1.51, 0.2, 0.12]],
  soft: [[1, 1, 0.5], [2, 0.2, 0.2]],
};

export function partialsOf(t: Timbre): readonly (readonly [number, number, number])[] {
  return PARTIALS[t];
}

/** One struck note through `out`: sine partials with a soft attack and their own decays. */
export function strike(ac: AudioContext, out: AudioNode, freq: number, timbre: Timbre, gain: number, when = ac.currentTime): void {
  for (const [ratio, g, decay] of PARTIALS[timbre]) {
    const osc = ac.createOscillator();
    osc.type = timbre === 'leaf' ? 'triangle' : 'sine';
    osc.frequency.value = freq * ratio;
    const env = ac.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(gain * g, when + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    osc.connect(env).connect(out);
    osc.start(when);
    osc.stop(when + decay + 0.05);
  }
}

/** A soft pop: a quick downward blip and a puff of breath. */
export function pop(ac: AudioContext, out: AudioNode, noise: AudioBuffer, gain: number, offset: number): void {
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  osc.frequency.setValueAtTime(620, t);
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.09);
  const env = ac.createGain();
  env.gain.setValueAtTime(gain, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  osc.connect(env).connect(out);
  osc.start(t);
  osc.stop(t + 0.15);
  const src = ac.createBufferSource();
  src.buffer = noise;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800;
  const ng = ac.createGain();
  ng.gain.setValueAtTime(gain * 0.5, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  src.connect(bp).connect(ng).connect(out);
  src.start(t, offset, 0.1);
}

/** A gull's call: two or three falling-and-rising cries, thin and far off. */
export function gullCall(ac: AudioContext, out: AudioNode, gain: number, cries: number): void {
  let t = ac.currentTime;
  for (let i = 0; i < cries; i++) {
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1500, t);
    osc.frequency.linearRampToValueAtTime(1050, t + 0.18);
    osc.frequency.linearRampToValueAtTime(1250, t + 0.3);
    const env = ac.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    osc.connect(env).connect(out);
    osc.start(t);
    osc.stop(t + 0.35);
    t += 0.38;
  }
}

/** Two seconds of soft noise, looped by the sea and the wind. */
export function noiseBuffer(ac: AudioContext, seed: number): AudioBuffer {
  const n = ac.sampleRate * 2;
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  // A small deterministic generator, browned a little so it is gentle.
  let s = seed >>> 0 || 1, last = 0;
  for (let i = 0; i < n; i++) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    const white = ((s >>> 0) / 0xffffffff) * 2 - 1;
    last = (last + 0.06 * white) / 1.06;
    d[i] = last * 3.2;
  }
  return buf;
}
