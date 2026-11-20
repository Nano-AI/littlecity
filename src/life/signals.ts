// Signals (Look, Stage 1): the dusk cycle, the wind and events. The one
// place that turns frame time into "what time is it" and "how does the air
// move". Everything that animates reads these; nothing else reads a clock.
//
//   const signals = createSignals(world.seed);
//   const dt = signals.advance(elapsedSeconds);   // clamped to TIME.maxStep
//   signals.time.part                              // 'day' | 'dusk' | 'night' | 'dawn'
//   signals.wind(x, z)                             // { dirX, dirZ, strength }
//
// Time: one loop is TIME.day + dusk + night + dawn seconds (8 minutes).
// `hold(part)` parks the cycle at the middle of a part; life time
// (`time.seconds`) keeps running either way, so held scenes still move.
//
// Wind: one town-wide direction that drifts slowly around a prevailing
// bearing, a base strength that breathes, and gusts. A gust is a front: a
// line across the map, at right angles to the wind, that sweeps downwind at
// WIND.gustSpeed. Its leading edge is sharp and its tail long, so a flag
// snaps and then settles. Everything samples the same field, so a gust is
// seen crossing the town: first the far trees, then the laundry, then the
// sails.

import { SIZE_X, SIZE_Z } from '@/core/grid';
import { rand } from '@/core/rand';
import { TIME } from '@/style/time';
import { WIND } from '@/style/wind';
import type { DayPart, SignalEvent, SignalEvents, SignalsDriver, TimeHold, TimeSignal, Wind } from './api';
import { createCalendar, wrapDelta, type SeasonControls, type SeasonSignal, type WeatherSignal } from './season';

/** The interface's eased time of day (Seasons): nothing it sets switches at once. */
export interface TimeGlide {
  /**
   * Holds a part of the day (or lets the cycle run) and eases there over a second or two. A long way
   * is swept forward through the hours in between, quickly, rather than cross-faded.
   */
  glideTime(mode: TimeHold): void;
  /** Follows a slider's thumb: eases quickly to this phase and holds the part it falls in. */
  scrubTime(phase: number): void;
}

/** The signals driver with the season and weather (src/life/season.ts), their controls, and the eased time. */
export type TownSignals = SignalsDriver & SeasonControls & TimeGlide & { readonly season: SeasonSignal; readonly weather: WeatherSignal };

const PARTS: readonly DayPart[] = ['day', 'dusk', 'night', 'dawn'];
/** Half the map's diagonal plus a margin: a front starts and ends this far from the centre. */
const REACH = Math.hypot(SIZE_X, SIZE_Z) / 2 + 6;

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

/** The time signal at a phase of the loop. Pure. */
export function timeAt(phase: number, seconds: number): TimeSignal {
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

/** One gust front, for the renderer's debug views and for tests. */
export interface GustFront {
  /** Signed distance of the front from the map centre along the wind, in columns. */
  position: number;
  /** Peak strength this gust adds. */
  peak: number;
}

/** The whole wind field at one moment. `wind(x, z)` is a function of this. */
export interface WindField {
  dirX: number;
  dirZ: number;
  base: number;
  fronts: GustFront[];
}

/** The wind field for a seed at a life time. Pure: the same seed and time give the same wind. */
export function windFieldAt(seed: number, seconds: number): WindField {
  const bearing = rand(seed, 'wind', 'bearing') * Math.PI * 2;
  const p1 = rand(seed, 'wind', 'p1') * Math.PI * 2;
  const p2 = rand(seed, 'wind', 'p2') * Math.PI * 2;
  const p3 = rand(seed, 'wind', 'p3') * Math.PI * 2;
  // Two slow sines of unrelated periods: the direction wanders and never visibly repeats.
  const angle =
    bearing + WIND.wander * (0.62 * Math.sin((seconds * Math.PI * 2) / 97 + p1) + 0.38 * Math.sin((seconds * Math.PI * 2) / 41 + p2));
  const base = Math.max(
    0,
    WIND.base + WIND.breath * (0.65 * Math.sin((seconds * Math.PI * 2) / 23 + p3) + 0.35 * Math.sin((seconds * Math.PI * 2) / 7.3 + p1)),
  );
  // Gust k starts at k × gustEvery (jittered) and takes `crossing` seconds to sweep the map.
  const every = Math.max(1, WIND.gustEvery);
  const crossing = (2 * REACH + WIND.gustTail * 2) / Math.max(0.5, WIND.gustSpeed);
  const fronts: GustFront[] = [];
  const newest = Math.floor(seconds / every);
  for (let k = newest; k >= 0 && k >= newest - Math.ceil(crossing / every) - 1; k--) {
    const start = k * every + (rand(seed, 'gust', k, 't') - 0.5) * every * 0.66;
    const age = seconds - start;
    if (age < 0 || age > crossing) continue;
    fronts.push({
      position: -REACH + age * WIND.gustSpeed,
      peak: WIND.gustPeak * (0.45 + 0.55 * rand(seed, 'gust', k, 'peak')),
    });
  }
  return { dirX: Math.cos(angle), dirZ: Math.sin(angle), base, fronts };
}

/** Wind at a column of a field. */
export function sampleWind(field: WindField, x: number, z: number): Wind {
  const along = (x - SIZE_X / 2) * field.dirX + (z - SIZE_Z / 2) * field.dirZ;
  let strength = field.base;
  for (const f of field.fronts) {
    const d = along - f.position; // > 0: the front has not arrived here yet
    const shape = d > 0 ? Math.exp(-((d / WIND.gustLead) ** 2)) : Math.exp(-((d / WIND.gustTail) ** 2));
    strength += f.peak * shape;
  }
  return { dirX: field.dirX, dirZ: field.dirZ, strength: Math.min(1.2, strength) };
}

export function createSignals(seed: number): TownSignals {
  let phase = 0;
  let seconds = 0;
  let holding: TimeHold = 'run';
  let time = timeAt(phase, seconds);
  let field: WindField | null = null;
  const listeners = new Map<SignalEvent, Set<(payload: never) => void>>();
  const calendar = createCalendar(seed);
  const controls = calendar.controls(() => seconds, () => time);
  /** Where a glide or a scrub is taking the time of day, how quickly, and whether it may go back. */
  let goal: number | null = null;
  let ease = 0.45;
  let back = false;

  return {
    get time() {
      return time;
    },
    get season() {
      return calendar.season;
    },
    get weather() {
      return calendar.weather;
    },
    wind(x, z) {
      field ??= windFieldAt(seed, seconds);
      const w = sampleWind(field, x, z);
      // A windy spell or a storm: the same field, blowing harder (src/life/season.ts).
      const gust = calendar.weather.gust;
      if (gust > 0) w.strength = Math.min(1.2, w.strength * (1 + 1.1 * gust) + 0.12 * gust);
      return w;
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
      // Review Focus 4: a sleeping tab or a frame that takes seconds never jumps time.
      const step = Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), TIME.maxStep);
      seconds += step;
      if (goal !== null) {
        let d = wrapDelta(phase, goal);
        // A glide runs the clock forward through the hours between (it never runs the sun backwards a
        // long way); a scrub follows the thumb either way.
        if (!back && d < -0.04) d += 1;
        const move = d * (1 - Math.exp(-step / ease)) + Math.sign(d) * Math.min(Math.abs(d), step * 0.03);
        phase = (((phase + move) % 1) + 1) % 1;
        if (Math.abs(wrapDelta(phase, goal)) < 1e-4) {
          phase = goal;
          goal = null;
        }
      } else if (holding === 'run') phase = (phase + step / loopSeconds()) % 1;
      time = timeAt(phase, seconds);
      field = null;
      calendar.advance(step, seconds, time, holding === 'run');
      return step;
    },
    hold(mode) {
      goal = null;
      holding = mode;
      if (mode !== 'run') phase = partPhases()[mode].mid;
      time = timeAt(phase, seconds);
    },
    get holding() {
      return holding;
    },
    setPhase(p) {
      goal = null;
      phase = ((p % 1) + 1) % 1;
      time = timeAt(phase, seconds);
    },
    glideTime(mode) {
      holding = mode;
      goal = mode === 'run' ? null : partPhases()[mode].mid;
      ease = 0.45;
      back = false;
    },
    scrubTime(p) {
      goal = ((p % 1) + 1) % 1;
      ease = 0.12;
      back = true;
      holding = timeAt(goal, seconds).part;
    },
    holdSeason: (mode) => controls.holdSeason(mode),
    glideSeason: (mode) => controls.glideSeason(mode),
    scrubYear: (y) => controls.scrubYear(y),
    get seasonHolding() {
      return controls.seasonHolding;
    },
    setYear: (year) => controls.setYear(year),
    holdWeather: (mode) => controls.holdWeather(mode),
    get weatherHolding() {
      return controls.weatherHolding;
    },
    settleWeather: () => controls.settleWeather(),
    emit<E extends SignalEvent>(event: E, payload: SignalEvents[E]) {
      // Copy first: a listener may unsubscribe (or subscribe) while it runs.
      for (const fn of [...(listeners.get(event) ?? [])]) (fn as (p: SignalEvents[E]) => void)(payload);
    },
  };
}
