// F06 · Sound. Off until the menu's sound toggle is on (the interface keeps
// the choice in localStorage under 'little-city.sound' and fires 'lc:sound'
// when it changes), and never started before a user gesture: the audio
// context is made on the first pointer or key press with sound on (or on
// the click that turns it on).
//
//   a piece lands      a soft note, higher the higher it sits, its timbre
//                      by kind (synth.ts); a big edit sings only the first
//   a piece goes       a pop
//   always             a quiet sea; a breath of wind that swells as a gust
//                      passes the middle of the town
//   now and then       a gull, by day, if the town has gulls
//   evening            one bell, as the lamps can first be lit
//
// Everything is quiet: the master level is low and every voice is softer
// still. Pure choices (when the bell rings, when a gull calls) are here as
// small functions, tested without audio.

import { keyY } from '@/core/grid';
import { rand } from '@/core/rand';
import type { ShapePlan } from '@/resolve/plan';
import { defineSystem, type TimeSignal } from '../api';
import { eveningSeconds } from '../dusk/evening';
import { gullCall, noiseBuffer, noteFor, pop, strike, timbreFor } from './synth';

const SOUND_KEY = 'little-city.sound';
/** Master level: everything is a background to building. */
const MASTER = 0.5;

/** True on the step where the evening begins (the moment lamps can first be lit). */
export function bellNow(prev: TimeSignal | null, now: TimeSignal): boolean {
  return prev !== null && eveningSeconds(prev) === 0 && eveningSeconds(now) > 0;
}

/** Seconds from one gull call to the next (seeded per call). */
export function gullGap(seed: number, n: number): number {
  return 9 + 16 * rand(seed, 'gull-call', n);
}

interface Audio {
  ac: AudioContext;
  master: GainNode;
  noise: AudioBuffer;
  wind: GainNode;
  sea: GainNode;
}

interface State {
  wanted: boolean;
  audio: Audio | null;
  shape: ShapePlan | null;
  prev: TimeSignal | null;
  gullIn: number;
  gulls: number;
  pops: number;
  lastNote: number;
  windAt: number;
  off: (() => void)[];
}

const hasAudio = (): boolean => typeof window !== 'undefined' && typeof window.AudioContext === 'function';

function readWanted(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

function start(state: State, seed: number): void {
  if (state.audio) {
    void state.audio.ac.resume();
    state.audio.master.gain.setTargetAtTime(MASTER, state.audio.ac.currentTime, 0.2);
    return;
  }
  const ac = new AudioContext();
  const master = ac.createGain();
  master.gain.value = 0;
  master.gain.setTargetAtTime(MASTER, ac.currentTime, 0.4);
  master.connect(ac.destination);
  const noise = noiseBuffer(ac, seed);
  // The sea: low, slow noise whose level breathes like waves on a beach.
  const seaSrc = ac.createBufferSource();
  seaSrc.buffer = noise;
  seaSrc.loop = true;
  const seaLow = ac.createBiquadFilter();
  seaLow.type = 'lowpass';
  seaLow.frequency.value = 420;
  const sea = ac.createGain();
  sea.gain.value = 0.05;
  const swell = ac.createOscillator();
  swell.frequency.value = 0.11;
  const swellDepth = ac.createGain();
  swellDepth.gain.value = 0.025;
  swell.connect(swellDepth).connect(sea.gain);
  seaSrc.connect(seaLow).connect(sea).connect(master);
  seaSrc.start();
  swell.start();
  // The wind: a band of the same noise, higher, its level set by the wind every few frames.
  const windSrc = ac.createBufferSource();
  windSrc.buffer = noise;
  windSrc.loop = true;
  windSrc.playbackRate.value = 1.7;
  const windBand = ac.createBiquadFilter();
  windBand.type = 'bandpass';
  windBand.frequency.value = 700;
  windBand.Q.value = 0.7;
  const wind = ac.createGain();
  wind.gain.value = 0;
  windSrc.connect(windBand).connect(wind).connect(master);
  windSrc.start(0, 0.9);
  state.audio = { ac, master, noise, wind, sea };
}

function stop(state: State): void {
  if (!state.audio) return;
  const { ac, master } = state.audio;
  master.gain.setTargetAtTime(0, ac.currentTime, 0.15);
  setTimeout(() => {
    if (!state.wanted && state.audio) void state.audio.ac.suspend();
  }, 600);
}

export default defineSystem<State>({
  id: 'sound',
  order: 100,
  create(ctx) {
    const state: State = { wanted: false, audio: null, shape: null, prev: null, gullIn: gullGap(ctx.seed, 0), gulls: 0, pops: 0, lastNote: -1, windAt: 0, off: [] };
    if (!hasAudio()) return state;
    state.wanted = readWanted();
    // The first gesture with sound on starts it (browsers allow audio only from a gesture).
    const gesture = (): void => {
      if (state.wanted && !state.audio) start(state, ctx.seed);
    };
    const toggle = (e: Event): void => {
      state.wanted = (e as CustomEvent<boolean>).detail === true;
      if (state.wanted) start(state, ctx.seed);
      else stop(state);
    };
    window.addEventListener('pointerdown', gesture);
    window.addEventListener('keydown', gesture);
    window.addEventListener('lc:sound', toggle);
    state.off.push(
      () => window.removeEventListener('pointerdown', gesture),
      () => window.removeEventListener('keydown', gesture),
      () => window.removeEventListener('lc:sound', toggle),
      ctx.signals.on('blockLanded', (cell) => {
        const a = state.audio;
        if (!a || !state.wanted) return;
        // A paste of many pieces at once sings once, not a chord of forty.
        if (a.ac.currentTime - state.lastNote < 0.06) return;
        state.lastNote = a.ac.currentTime;
        strike(a.ac, a.master, noteFor(keyY(cell)), timbreFor(state.shape?.kinds.get(cell)), 0.11);
      }),
      ctx.signals.on('blockRemoved', () => {
        const a = state.audio;
        if (!a || !state.wanted) return;
        pop(a.ac, a.master, a.noise, 0.09, (state.pops++ % 7) * 0.21);
      }),
    );
    return state;
  },
  sync(state, next) {
    state.shape = next.shape;
    // How many gulls the town keeps (they are only heard where there are gulls).
    state.gulls = next.dressing ? next.dressing.actors.filter((x) => x.type === 'gull').length : state.gulls;
  },
  update(state, dt, signals, ctx) {
    const a = state.audio;
    const time = signals.time;
    const bell = bellNow(state.prev, time);
    state.prev = time;
    if (!a || !state.wanted) return;
    if (bell) strike(a.ac, a.master, 392, 'bell', 0.09);
    // Wind: a few times a second, the level follows the wind in the middle of the town.
    state.windAt -= dt;
    if (state.windAt <= 0) {
      state.windAt = 0.15;
      const w = signals.wind(24, 24).strength;
      a.wind.gain.setTargetAtTime(0.012 + 0.05 * w * w, a.ac.currentTime, 0.25);
    }
    // Gulls, now and then, by day.
    state.gullIn -= dt;
    if (state.gullIn <= 0) {
      const n = Math.floor(time.seconds);
      state.gullIn = gullGap(ctx.seed, n);
      if (state.gulls > 0 && (time.isDay || time.isDawn)) gullCall(a.ac, a.master, 0.018, 2 + Math.floor(rand(ctx.seed, 'cries', n) * 2));
    }
  },
  dispose(state) {
    for (const off of state.off) off();
    if (state.audio) void state.audio.ac.close();
    state.audio = null;
  },
});
