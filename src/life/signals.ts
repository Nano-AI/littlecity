// STUB (Stage 0). Owner: Look (Stage 1). Final signature: createSignals.
//
// The stub runs the dusk cycle and clamps the time step; wind is a constant
// light breeze. The Look owner adds the drifting direction and travelling
// gusts (design section 13) and the test `signals clamp dt` (Review Focus 4).

import { TIME } from '@/style/time';
import type { DayPart, SignalEvent, SignalEvents, SignalsDriver, TimeHold, TimeSignal } from './api';

const PARTS: readonly DayPart[] = ['day', 'dusk', 'night', 'dawn'];

function loopSeconds(): number {
  return TIME.day + TIME.dusk + TIME.night + TIME.dawn;
}

/** Start phase of each part of the day, and the phase at its middle. */
export function partPhases(): Record<DayPart, { start: number; mid: number; end: number }> {
  const total = loopSeconds();
  const out = {} as Record<DayPart, { start: number; mid: number; end: number }>;
  let t = 0;
  for (const p of PARTS) {
    const len = TIME[p];
    out[p] = { start: t / total, mid: (t + len / 2) / total, end: (t + len) / total };
    t += len;
  }
  return out;
}

function timeAt(phase: number, seconds: number): TimeSignal {
  const phases = partPhases();
  const part = PARTS.find((p) => phase < phases[p].end) ?? 'dawn';
  const within = (phase - phases[part].start) / (phases[part].end - phases[part].start);
  const ease = within * within * (3 - 2 * within);
  const light = part === 'day' ? 1 : part === 'night' ? 0 : part === 'dusk' ? 1 - ease : ease;
  return {
    phase,
    part,
    isDay: part === 'day',
    isDusk: part === 'dusk',
    isNight: part === 'night',
    isDawn: part === 'dawn',
    light,
    seconds,
  };
}

export function createSignals(_seed: number): SignalsDriver {
  let phase = 0;
  let seconds = 0;
  let holding: TimeHold = 'run';
  let time = timeAt(phase, seconds);
  const listeners = new Map<SignalEvent, Set<(payload: never) => void>>();

  return {
    get time() {
      return time;
    },
    wind() {
      return { dirX: 1, dirZ: 0, strength: 0.3 };
    },
    on(event, fn) {
      let set = listeners.get(event);
      if (!set) listeners.set(event, (set = new Set()));
      set.add(fn as (payload: never) => void);
      return () => {
        set.delete(fn as (payload: never) => void);
      };
    },
    advance(dt) {
      const step = Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), TIME.maxStep);
      seconds += step;
      if (holding === 'run') phase = (phase + step / loopSeconds()) % 1;
      time = timeAt(phase, seconds);
      return step;
    },
    hold(mode) {
      holding = mode;
      if (mode !== 'run') phase = partPhases()[mode].mid;
      time = timeAt(phase, seconds);
    },
    get holding() {
      return holding;
    },
    setPhase(p) {
      phase = ((p % 1) + 1) % 1;
      time = timeAt(phase, seconds);
    },
    emit<E extends SignalEvent>(event: E, payload: SignalEvents[E]) {
      for (const fn of listeners.get(event) ?? []) (fn as (p: SignalEvents[E]) => void)(payload);
    },
  };
}
