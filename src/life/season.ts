// Seasons and weather (design section 13a): two more signals beside time and wind.
//
//   signals.season    where the year is: the four seasons with smooth blends between them,
//                     the midwinter festival, how cold it is, and where the trees are
//   signals.weather   what is falling and how much (rain, snow), cloud, fog, extra wind, and
//                     what it has left behind (settled snow, wet ground)
//
// The year turns with the dusk cycle (SEASON.days loops a season), so a held time of day holds the
// year too. Weather comes in spells of a few minutes, each of one kind, rolled from the seed and
// weighted by the season; amounts ease in and out and settled snow builds and melts at its own
// rate. Both have hold modes like the time of day. Nothing reads the real calendar: the same seed,
// clock and holds give the same season and weather.
//
// The two signals are optional on `Signals` (an older driver or a test's fake has neither): read
// them through `seasonOf(signals)` and `weatherOf(signals)`, which fall back to a summer's day with
// clear sky, the game as it always looked.

import { rand } from '@/core/rand';
import { SEASON, WEATHER } from '@/style/season';
import { TIME } from '@/style/time';
import type { Signals, TimeSignal } from './api';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];
export type SeasonHold = 'run' | Season;

export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog' | 'wind' | 'snow';
export const WEATHER_KINDS: readonly WeatherKind[] = ['clear', 'cloudy', 'rain', 'storm', 'fog', 'wind', 'snow'];
export type WeatherHold = 'auto' | WeatherKind;

export interface SeasonSignal {
  /** Position in the year, 0 ≤ year < 1, from the start of spring. */
  year: number;
  /** The season that has most weight now. */
  season: Season;
  /** 0 to 1 through that season. */
  progress: number;
  /** How much of each season is in the picture; they sum to 1 and blend over SEASON.blend loops at a change. */
  weights: Readonly<Record<Season, number>>;
  /** 0 warm to 1 freezing: snow can settle above about 0.5. */
  cold: number;
  /** Trees: how far autumn colour has come (0 green to 1 turned), before each tree's own delay. */
  turn: number;
  /** Trees: how far the leaves have fallen (0 in leaf to 1 bare). */
  bare: number;
  /** Fruit trees in blossom, 0 to 1. */
  blossom: number;
  /** The midwinter festival: 0 no lights, rising 0 to 1 as they go up house by house, falling as they come down. */
  festival: number;
}

export interface WeatherSignal {
  /** The kind of the spell now (amounts below ease between spells). */
  kind: WeatherKind;
  /** Falling now, 0 to 1. */
  rain: number;
  snow: number;
  /** Sky cover, 0 clear to 1 overcast. */
  cloud: number;
  /** Mist, 0 to 1 (thickest in the morning, low down, by the water). */
  fog: number;
  /** Extra wind on top of the usual breeze, 0 to 1. */
  gust: number;
  /** Settled snow, 0 none to 1 everything covered. */
  cover: number;
  /** 1 while settled snow is melting, 0 while it holds or builds. */
  thaw: number;
  /** Wet surfaces, 0 dry to 1 soaked. */
  wet: number;
  /** A flash of lightning, 0 to 1, now. */
  flash: number;
}

declare module './api' {
  interface Signals {
    /** Added by Seasons (src/life/season.ts). Read through seasonOf(signals). */
    readonly season?: SeasonSignal;
    /** Added by Seasons. Read through weatherOf(signals). */
    readonly weather?: WeatherSignal;
  }
}

/** The controls the season and weather buttons (and the URL, scenarios and screenshots) use. */
export interface SeasonControls {
  holdSeason(mode: SeasonHold): void;
  readonly seasonHolding: SeasonHold;
  /** Jumps the year to a position (0 to 1 from the start of spring). Holds it there unless running. */
  setYear(year: number): void;
  holdWeather(mode: WeatherHold): void;
  readonly weatherHolding: WeatherHold;
  /** Brings every amount to where the weather is heading at once, settled snow and wetness included (screenshots). */
  settleWeather(): void;
}

const smooth = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/** Seconds in one turn of the year. */
export function yearSeconds(): number {
  return (TIME.day + TIME.dusk + TIME.night + TIME.dawn) * Math.max(0.01, SEASON.days) * 4;
}

/** The year position at which a hold parks each season. */
export function holdYear(season: Season): number {
  const at = { spring: SEASON.holdSpring, summer: SEASON.holdSummer, autumn: SEASON.holdAutumn, winter: SEASON.holdWinter }[season];
  return (SEASONS.indexOf(season) + at) / 4;
}

/** Festival lights by how far through winter (1 and beyond run on into spring). */
function festivalAt(x: number): number {
  const up = clamp01((x - SEASON.festivalStart) / Math.max(1e-3, SEASON.festivalUp));
  const down = 1 - clamp01((x - SEASON.festivalEnd) / Math.max(1e-3, SEASON.festivalDown));
  return Math.min(up, down);
}

/** The season signal at a position in the year. Pure. */
export function seasonAt(year: number): SeasonSignal {
  const y = ((year % 1) + 1) % 1;
  const q = y * 4;
  const i = Math.min(3, Math.floor(q));
  const p = q - i;
  // The change between two seasons takes SEASON.blend loops, centred on the boundary.
  const w = Math.min(0.49, Math.max(1e-3, SEASON.blend / Math.max(0.01, SEASON.days) / 2));
  const weights: Record<Season, number> = { spring: 0, summer: 0, autumn: 0, winter: 0 };
  const cur = SEASONS[i]!, prev = SEASONS[(i + 3) % 4]!, next = SEASONS[(i + 1) % 4]!;
  if (p < w) {
    const u = smooth((p + w) / (2 * w));
    weights[cur] = u;
    weights[prev] = 1 - u;
  } else if (p > 1 - w) {
    const u = smooth((p - (1 - w)) / (2 * w));
    weights[next] = u;
    weights[cur] = 1 - u;
  } else weights[cur] = 1;
  const season = (Object.keys(weights) as Season[]).reduce((a, b) => (weights[b] > weights[a] ? b : a), cur);

  // Through each season, 0 to 1: the trees and the cold follow the calendar, not the blend weights.
  const spring = i === 0 ? p : -1;
  const turn = i === 2 ? smooth(p / 0.8) : i === 3 ? 1 : 0;
  const bare = i === 2 ? smooth((p - 0.5) / 0.48) : i === 3 ? 1 : i === 0 ? 1 - smooth(p / 0.38) : 0;
  const blossom = spring >= 0 ? smooth((spring - 0.15) / 0.2) * (1 - smooth((spring - 0.7) / 0.25)) : 0;
  // Cold: winter, the tail of autumn and the first days of spring, blended like the seasons (a
  // season on the way out counts as at its end, one on the way in as at its start).
  const coldOf = (k: Season, at: number): number =>
    k === 'winter' ? 1 : k === 'autumn' ? 0.55 * smooth((at - 0.6) / 0.4) : k === 'spring' ? 0.6 * (1 - smooth(at / 0.3)) : 0;
  const cold = weights[cur] * coldOf(cur, p) + weights[prev] * coldOf(prev, 1) + weights[next] * coldOf(next, 0);
  const festival = i === 3 ? festivalAt(p) : i === 0 ? festivalAt(1 + p) : 0;
  return { year: y, season, progress: season === cur ? p : season === next ? 0 : 1, weights, cold, turn, bare, blossom, festival };
}

/** A summer's day with a clear sky: the game as it looked before seasons. */
export const SUMMER: SeasonSignal = Object.freeze(seasonAt(0.375));
export const CLEAR: WeatherSignal = Object.freeze({ kind: 'clear', rain: 0, snow: 0, cloud: 0, fog: 0, gust: 0, cover: 0, thaw: 0, wet: 0, flash: 0 });

export function seasonOf(signals: Signals): SeasonSignal {
  return signals.season ?? SUMMER;
}
export function weatherOf(signals: Signals): WeatherSignal {
  return signals.weather ?? CLEAR;
}

/** How likely each kind of weather is in each season (a spell is rolled from the blend). */
const ODDS: Record<WeatherKind, Record<Season, number>> = {
  clear: { spring: 0.32, summer: 0.5, autumn: 0.24, winter: 0.2 },
  cloudy: { spring: 0.18, summer: 0.18, autumn: 0.22, winter: 0.22 },
  rain: { spring: 0.3, summer: 0.1, autumn: 0.26, winter: 0.04 },
  storm: { spring: 0.02, summer: 0.07, autumn: 0.02, winter: 0 },
  fog: { spring: 0.1, summer: 0.03, autumn: 0.14, winter: 0.08 },
  wind: { spring: 0.08, summer: 0.12, autumn: 0.1, winter: 0.04 },
  snow: { spring: 0, summer: 0, autumn: 0.02, winter: 0.42 },
};

/** The kind of spell `k`, rolled from the seed and the season's odds. Pure. */
export function rollWeather(seed: number, k: number, season: SeasonSignal): WeatherKind {
  let total = 0;
  const odds = WEATHER_KINDS.map((kind) => {
    let o = 0;
    for (const s of SEASONS) o += ODDS[kind][s] * season.weights[s];
    // Snow late in autumn only once it is cold.
    if (kind === 'snow') o *= season.weights.winter > 0.5 ? 1 : smooth((season.cold - 0.3) / 0.2);
    total += o;
    return o;
  });
  let r = rand(seed, 'weather', k) * total;
  for (let i = 0; i < odds.length; i++) {
    r -= odds[i]!;
    if (r < 0) return WEATHER_KINDS[i]!;
  }
  return 'clear';
}

interface Target {
  precip: number;
  cloud: number;
  fog: number;
  gust: number;
}
/** What a kind of weather brings at full strength; `r` (0 to 1) makes a shower or a steady fall. */
function targetOf(kind: WeatherKind, r: number): Target {
  switch (kind) {
    case 'cloudy':
      return { precip: 0, cloud: 0.62, fog: 0, gust: 0.1 };
    case 'rain':
      return { precip: 0.45 + 0.4 * r, cloud: 0.8, fog: 0, gust: 0.2 };
    case 'storm':
      return { precip: 1, cloud: 1, fog: 0, gust: 0.85 };
    case 'fog':
      return { precip: 0, cloud: 0.3, fog: 0.85, gust: 0 };
    case 'wind':
      return { precip: 0, cloud: 0.25, fog: 0, gust: 0.9 };
    case 'snow':
      return { precip: 0.55 + 0.4 * r, cloud: 0.7, fog: 0.1, gust: 0.05 };
    default:
      return { precip: 0, cloud: 0, fog: 0, gust: 0 };
  }
}

/** Mist lies in the morning: full at dawn and into the morning, thin by the afternoon. */
function morning(time: TimeSignal): number {
  if (time.isDawn || time.isNight) return 1;
  if (time.isDusk) return 0.55;
  return 1 - 0.7 * smooth((time.phase - 0.08) / 0.25);
}

/** A flash of lightning at life time `seconds` for a storm this strong. Pure. */
export function flashAt(seed: number, seconds: number, storm: number): number {
  if (storm <= 0.3) return 0;
  const every = 7;
  const b = Math.floor(seconds / every);
  let f = 0;
  for (const k of [b - 1, b]) {
    if (rand(seed, 'flash', k) > storm * 0.75) continue;
    const t = seconds - (k * every + rand(seed, 'flash', k, 'at') * (every - 1));
    if (t < 0 || t > 0.6) continue;
    // A bright flick, a dip, a second flick, and gone.
    f = Math.max(f, t < 0.07 ? 1 : t < 0.14 ? 0.35 : t < 0.22 ? 0.8 : Math.max(0, 1 - (t - 0.22) / 0.38) * 0.5);
  }
  return f;
}

export interface WeatherState {
  readonly signal: WeatherSignal;
  /** Advances by `dt` seconds of life time. */
  step(dt: number, seconds: number, season: SeasonSignal, time: TimeSignal): void;
  hold(mode: WeatherHold, seconds: number, season: SeasonSignal): void;
  readonly holding: WeatherHold;
  /** A new spell starts now (the season was changed by hand), forced to a kind if given. */
  restart(seconds: number, season: SeasonSignal, kind?: WeatherKind): void;
  settle(season: SeasonSignal, time: TimeSignal): void;
}

/** The weather for one town. Deterministic: the same seed and the same steps give the same weather. */
export function createWeather(seed: number): WeatherState {
  let holding: WeatherHold = 'auto';
  let k = 0;
  let kind: WeatherKind = 'clear';
  // The first spell is clear, so a town opens on the day it always did.
  let end = WEATHER.spell * (1 + WEATHER.jitter * (rand(seed, 'spell', 0) * 2 - 1));
  let wasWinter = false;
  const s: WeatherSignal = { ...CLEAR };
  let precip = 0;

  const strength = (): number => (holding === 'auto' ? rand(seed, 'weather', k, 'strength') : 0.75);
  const current = (): WeatherKind => (holding === 'auto' ? kind : holding);
  /** The share of what falls that falls as snow. */
  const snowShare = (season: SeasonSignal): number => {
    const h = holding;
    if (h === 'snow') return 1;
    if (h === 'rain' || h === 'storm') return 0;
    return smooth((season.cold - 0.45) / 0.2);
  };
  const next = (seconds: number, season: SeasonSignal, forced?: WeatherKind): void => {
    k++;
    const winter = season.weights.winter > 0.5;
    kind = forced ?? (winter && !wasWinter ? 'snow' : rollWeather(seed, k, season));
    wasWinter = winter;
    end = seconds + WEATHER.spell * (1 + WEATHER.jitter * (rand(seed, 'spell', k) * 2 - 1));
  };
  const approach = (from: number, to: number, rate: number): number => (from < to ? Math.min(to, from + rate) : Math.max(to, from - rate));

  return {
    get signal() {
      return s;
    },
    get holding() {
      return holding;
    },
    step(dt, seconds, season, time) {
      if (holding === 'auto') {
        // Spells follow one another on the life clock (a held time of day still has weather).
        let guard = 0;
        while (seconds >= end && guard++ < 64) next(end, season);
      }
      const t = targetOf(current(), strength());
      const rate = dt / Math.max(0.1, WEATHER.ease);
      precip = approach(precip, t.precip, rate);
      const share = snowShare(season);
      s.rain = precip * (1 - share);
      s.snow = precip * share;
      s.cloud = approach(s.cloud, t.cloud, rate);
      s.fog = approach(s.fog, t.fog * morning(time), rate * 0.5);
      s.gust = approach(s.gust, t.gust, rate);
      s.kind = current();
      // What falls stays: snow builds where it is cold enough; rain soaks.
      const warm = holding === 'snow' ? 0 : 1 - smooth((season.cold - 0.4) / 0.2);
      const before = s.cover;
      if (s.snow > 0.02) s.cover = Math.min(1, s.cover + (s.snow * dt) / Math.max(1, WEATHER.settle));
      else if (warm > 0) s.cover = Math.max(0, s.cover - ((warm + s.rain * 2) * dt) / Math.max(1, WEATHER.melt));
      const melting = s.cover < before ? 1 : 0;
      s.thaw = approach(s.thaw, melting, dt / 6);
      const soaking = s.rain + (melting ? 0.3 : 0);
      if (soaking > 0.02) s.wet = Math.min(1, s.wet + (soaking * dt) / Math.max(1, WEATHER.soak));
      else s.wet = Math.max(0, s.wet - ((1 - 0.6 * s.cloud) * dt) / Math.max(1, WEATHER.dry));
      s.flash = current() === 'storm' ? flashAt(seed, seconds, precip) : 0;
    },
    hold(mode, seconds, season) {
      holding = mode;
      if (mode === 'auto') next(seconds, season);
    },
    restart(seconds, season, forced) {
      if (holding === 'auto') next(seconds, season, forced);
    },
    settle(season, time) {
      const t = targetOf(current(), strength());
      precip = t.precip;
      const share = snowShare(season);
      s.rain = precip * (1 - share);
      s.snow = precip * share;
      s.cloud = t.cloud;
      s.fog = t.fog * morning(time);
      s.gust = t.gust;
      s.kind = current();
      // Snow lies all winter once it has fallen; a snowfall anywhere settles.
      s.cover = s.snow > 0.02 || season.cold > 0.6 ? 1 : 0;
      s.thaw = 0;
      s.wet = s.rain > 0.02 ? 1 : 0;
      s.flash = 0;
    },
  };
}

/** The year and the weather for one town, as one piece the signals driver owns. */
export interface Calendar {
  readonly season: SeasonSignal;
  readonly weather: WeatherSignal;
  /** Advances by `step` seconds of life time (the year turns only while the dusk cycle runs). */
  advance(step: number, seconds: number, time: TimeSignal, cycling?: boolean): void;
  controls(seconds: () => number, time: () => TimeSignal): SeasonControls;
}

export function createCalendar(seed: number): Calendar {
  let year = ((SEASON.start % 1) + 1) % 1;
  let holding: SeasonHold = 'run';
  let season = seasonAt(year);
  const weather = createWeather(seed);
  return {
    get season() {
      return season;
    },
    get weather() {
      return weather.signal;
    },
    advance(step, seconds, time, cycling = true) {
      if (holding === 'run' && cycling) year = (year + step / yearSeconds()) % 1;
      season = seasonAt(year);
      weather.step(step, seconds, season, time);
    },
    controls(seconds, time) {
      return {
        holdSeason(mode) {
          const was = season.season;
          holding = mode;
          if (mode !== 'run') year = holdYear(mode);
          season = seasonAt(year);
          // Choosing a season by hand starts its weather now: winter opens with a snowfall.
          if (mode !== 'run' && mode !== was) weather.restart(seconds(), season, mode === 'winter' ? 'snow' : undefined);
        },
        get seasonHolding() {
          return holding;
        },
        setYear(y) {
          year = ((y % 1) + 1) % 1;
          season = seasonAt(year);
        },
        holdWeather(mode) {
          weather.hold(mode, seconds(), season);
        },
        get weatherHolding() {
          return weather.holding;
        },
        settleWeather() {
          weather.settle(season, time());
        },
      };
    },
  };
}

/** Parses a season from a URL or scenario: a name, 'festival', or a year position 0 to 1. */
export function parseSeason(v: string | number | null | undefined): { hold: SeasonHold; year?: number } | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' || /^[0-9.]+$/.test(v)) {
    // A position in the year is held there (by holding the season it falls in, then moving to it).
    const y = Number(v);
    return Number.isFinite(y) ? { hold: seasonAt(y).season, year: y } : null;
  }
  if (v === 'run' || v === 'auto') return { hold: 'run' };
  if (v === 'festival' || v === 'midwinter') return { hold: 'winter' };
  return (SEASONS as readonly string[]).includes(v) ? { hold: v as Season } : null;
}
export function parseWeather(v: string | null | undefined): WeatherHold | null {
  if (!v) return null;
  if (v === 'auto' || v === 'run') return 'auto';
  if (v === 'thunder' || v === 'thunderstorm') return 'storm';
  if (v === 'mist') return 'fog';
  return (WEATHER_KINDS as readonly string[]).includes(v) ? (v as WeatherKind) : null;
}

/**
 * Holds the season and weather a URL, a scenario or a tool asks for (either may be absent), and with
 * `settle` brings the weather in at once.
 */
export function applyCalendar(signals: SeasonControls, season?: string | number | null, weather?: string | null, settle = false): void {
  const s = parseSeason(season);
  if (s) {
    signals.holdSeason(s.hold);
    if (s.year !== undefined) signals.setYear(s.year);
  }
  const w = parseWeather(weather);
  if (w) signals.holdWeather(w);
  if (settle) signals.settleWeather();
}
