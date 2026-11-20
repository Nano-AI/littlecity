// Mischief, heard (design section 13b). Owner: Mischief.
//
// A crackle that swells with how much is burning, a hiss while hoses play
// on a fire, the alarm bell rung when a fire starts, the fuse's fizz, a
// deep drawn-out BOOM and a splash for a bomb in the sea. Off until the
// player turns sound on (the same switch as the rest of the town's sound).

import { hash, rand } from '@/core/rand';
import { defineSystem } from '../api';
import { noiseBuffer, pop, strike } from '../sound/synth';
import { mischiefOf, type Director } from './director';

const SOUND_KEY = 'little-city.sound';

interface Audio {
  ac: AudioContext;
  master: GainNode;
  noise: AudioBuffer;
  crackle: GainNode;
  hiss: GainNode;
}
interface State {
  d: Director;
  wanted: boolean;
  audio: Audio | null;
  off: (() => void)[];
  crackleIn: number;
  bellUntil: number;
  bellAt: number;
  n: number;
}

const hasAudio = (): boolean => typeof window !== 'undefined' && typeof (window as { AudioContext?: unknown }).AudioContext === 'function';

function start(st: State): void {
  if (st.audio) {
    void st.audio.ac.resume();
    return;
  }
  const ac = new AudioContext();
  const master = ac.createGain();
  master.gain.value = 0.5;
  master.connect(ac.destination);
  const noise = noiseBuffer(ac, 0x6d15);
  // The crackle: noise through a band in the middle, its level following the fire.
  const fireSrc = ac.createBufferSource();
  fireSrc.buffer = noise;
  fireSrc.loop = true;
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1400;
  band.Q.value = 0.6;
  const crackle = ac.createGain();
  crackle.gain.value = 0;
  fireSrc.connect(band).connect(crackle).connect(master);
  fireSrc.start();
  // The hiss of water on a fire: high noise.
  const waterSrc = ac.createBufferSource();
  waterSrc.buffer = noise;
  waterSrc.loop = true;
  waterSrc.playbackRate.value = 1.3;
  const high = ac.createBiquadFilter();
  high.type = 'highpass';
  high.frequency.value = 2600;
  const hiss = ac.createGain();
  hiss.gain.value = 0;
  waterSrc.connect(high).connect(hiss).connect(master);
  waterSrc.start(0, 0.4);
  st.audio = { ac, master, noise, crackle, hiss };
}

/** A bang: a thump that drops in pitch, under a burst of rumbling noise. */
function boom(a: Audio, big: number): void {
  const { ac, master } = a;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(110, t);
  osc.frequency.exponentialRampToValueAtTime(28, t + 0.7);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.6 * big, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 1.3);
  const src = ac.createBufferSource();
  src.buffer = a.noise;
  const low = ac.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.setValueAtTime(1800, t);
  low.frequency.exponentialRampToValueAtTime(120, t + 1.4);
  const ng = ac.createGain();
  ng.gain.setValueAtTime(0.0001, t);
  ng.gain.exponentialRampToValueAtTime(0.5 * big, t + 0.015);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  src.connect(low).connect(ng).connect(master);
  src.start(t, 0.2);
  src.stop(t + 1.7);
}

export default defineSystem<State>({
  id: 'mischief.sound',
  order: 101,
  create(ctx) {
    const st: State = { d: mischiefOf(ctx.stage), wanted: false, audio: null, off: [], crackleIn: 0, bellUntil: 0, bellAt: 0, n: 0 };
    if (!hasAudio()) return st;
    try {
      st.wanted = window.localStorage.getItem(SOUND_KEY) === 'on';
    } catch {
      st.wanted = false;
    }
    const gesture = (): void => {
      if (st.wanted && !st.audio) start(st);
    };
    const toggle = (e: Event): void => {
      st.wanted = (e as CustomEvent<boolean>).detail === true;
      if (st.wanted) start(st);
      else if (st.audio) st.audio.master.gain.setTargetAtTime(0, st.audio.ac.currentTime, 0.15);
      if (st.wanted && st.audio) st.audio.master.gain.setTargetAtTime(0.5, st.audio.ac.currentTime, 0.15);
    };
    window.addEventListener('pointerdown', gesture);
    window.addEventListener('keydown', gesture);
    window.addEventListener('lc:sound', toggle);
    st.off.push(
      () => window.removeEventListener('pointerdown', gesture),
      () => window.removeEventListener('keydown', gesture),
      () => window.removeEventListener('lc:sound', toggle),
      st.d.on((e) => {
        const a = st.audio;
        if (!a || !st.wanted) return;
        if (e.type === 'lit') st.bellUntil = Math.max(st.bellUntil, a.ac.currentTime + 4);
        else if (e.type === 'blast') {
          if (e.blast.water) pop(a.ac, a.master, a.noise, 0.25, 0.3);
          else boom(a, 1);
        } else if (e.type === 'knock') pop(a.ac, a.master, a.noise, 0.18, (st.n++ % 5) * 0.2);
        else if (e.type === 'mend') strike(a.ac, a.master, 330, 'plank', 0.06);
      }),
    );
    return st;
  },
  update(st, dt) {
    const a = st.audio;
    if (!a || !st.wanted) return;
    const t = a.ac.currentTime;
    // How much is burning, and how many hoses are at work.
    let heat = 0;
    for (const b of st.d.engine.burning()) heat += b.intensity;
    let hoses = 0;
    for (const b of st.d.brigades?.values() ?? []) hoses += b.aim.size;
    a.crackle.gain.setTargetAtTime(Math.min(0.09, 0.02 * Math.sqrt(heat)), t, 0.3);
    a.hiss.gain.setTargetAtTime(Math.min(0.05, 0.018 * hoses), t, 0.3);
    // Crackles: little pops now and then, more for a bigger fire.
    st.crackleIn -= dt;
    if (heat > 0.05 && st.crackleIn <= 0) {
      st.crackleIn = 0.05 + rand(hash(st.n++), 'crackle') * (0.5 / Math.min(4, 1 + heat));
      pop(a.ac, a.master, a.noise, Math.min(0.06, 0.02 + heat * 0.005), (st.n % 9) * 0.11);
    }
    // The alarm bell: a quick ding-ding while a fire has just started.
    if (t < st.bellUntil && t >= st.bellAt) {
      st.bellAt = t + 0.42;
      strike(a.ac, a.master, 880, 'bell', 0.05);
    }
  },
  dispose(st) {
    for (const off of st.off) off();
    if (st.audio) void st.audio.ac.close();
    st.audio = null;
  },
});
