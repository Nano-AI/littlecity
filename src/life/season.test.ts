import { describe, expect, test } from 'vitest';
import { SEASON, WEATHER } from '@/style/season';
import { TIME } from '@/style/time';
import { createSignals, partPhases } from './signals';
import { CLEAR, flashAt, holdYear, parseSeason, parseWeather, rollWeather, seasonAt, seasonOf, SEASONS, SUMMER, weatherOf, yearSeconds } from './season';

const loop = TIME.day + TIME.dusk + TIME.night + TIME.dawn;

describe('easing (the sliders): nothing switches at once', () => {
  test('a time glide runs the clock forward through the hours between, quickly, and lands', () => {
    const s = createSignals(3);
    s.hold('day');
    const from = s.time.phase;
    s.glideTime('night');
    const goal = partPhases().night.mid;
    let last = from, steps = 0;
    while (s.time.phase !== goal && steps < 600) {
      s.advance(1 / 60);
      const d = (((s.time.phase - last) % 1) + 1) % 1;
      expect(d).toBeLessThan(0.05); // never a jump
      last = s.time.phase;
      steps++;
    }
    expect(s.time.phase).toBe(goal);
    expect(steps / 60).toBeLessThan(4);
    expect(steps / 60).toBeGreaterThan(0.5);
    // From night back to day it goes on through dawn, not backwards through dusk.
    s.glideTime('day');
    const seen = new Set<string>();
    for (let i = 0; i < 600; i++) {
      s.advance(1 / 60);
      seen.add(s.time.part);
    }
    expect(seen.has('dawn')).toBe(true);
    expect(seen.has('dusk')).toBe(false);
    expect(s.holding).toBe('day');
  });

  test('scrubbing follows the thumb back and forth smoothly and holds where it stops', () => {
    const s = createSignals(3);
    s.scrubTime(0.3);
    for (let i = 0; i < 120; i++) s.advance(1 / 60);
    let last = s.time.phase;
    for (let i = 0; i < 240; i++) {
      s.scrubTime(0.3 + 0.25 * Math.sin(i / 20));
      s.advance(1 / 60);
      const d = Math.abs((((s.time.phase - last) % 1) + 1.5) % 1 - 0.5);
      expect(d).toBeLessThan(0.03);
      last = s.time.phase;
    }
    s.scrubTime(0.4);
    for (let i = 0; i < 120; i++) s.advance(1 / 60);
    expect(s.time.phase).toBeCloseTo(0.4, 6);
  });

  test('a season glide takes a few seconds, the short way round; winter snows in as it arrives', () => {
    const s = createSignals(4);
    s.glideSeason('winter');
    let last = s.season.year, t = 0;
    while (Math.abs(s.season.year - holdYear('winter')) > 1e-9 && t < 20) {
      s.advance(1 / 30);
      t += 1 / 30;
      const d = Math.abs((((s.season.year - last) % 1) + 1.5) % 1 - 0.5);
      expect(d).toBeLessThan(0.03);
      last = s.season.year;
    }
    expect(t).toBeGreaterThan(1);
    expect(t).toBeLessThan(10);
    expect(s.seasonHolding).toBe('winter');
    for (let i = 0; i < 300; i++) s.advance(1 / 30);
    expect(s.weather.cover).toBeGreaterThan(0.5);
    // And back to summer: the snow melts in seconds, not minutes.
    s.glideSeason('summer');
    for (let i = 0; i < 600; i++) s.advance(1 / 30);
    expect(s.weather.cover).toBe(0);
  });
});

describe('the year', () => {
  test('a season is SEASON.days loops of the dusk cycle', () => {
    expect(yearSeconds()).toBe(loop * SEASON.days * 4);
  });

  test('weights always sum to 1 and never jump', () => {
    let last = seasonAt(0);
    for (let i = 1; i <= 4000; i++) {
      const s = seasonAt(i / 4000);
      const sum = SEASONS.reduce((a, k) => a + s.weights[k], 0);
      expect(sum).toBeCloseTo(1, 9);
      for (const k of SEASONS) expect(Math.abs(s.weights[k] - last.weights[k])).toBeLessThan(0.02);
      expect(Math.abs(s.cold - last.cold)).toBeLessThan(0.02);
      expect(Math.abs(s.festival - last.festival)).toBeLessThan(0.05);
      // Trees: turn may only jump back to green while every tree is bare.
      if (Math.abs(s.turn - last.turn) > 0.02) expect(s.bare).toBeGreaterThan(0.99);
      expect(Math.abs(s.bare - last.bare)).toBeLessThan(0.02);
      last = s;
    }
  });

  test('the four seasons come round in order, and summer in the middle of summer is all summer', () => {
    expect(seasonAt(0.125).season).toBe('spring');
    expect(seasonAt(0.375).season).toBe('summer');
    expect(seasonAt(0.625).season).toBe('autumn');
    expect(seasonAt(0.875).season).toBe('winter');
    expect(SUMMER.weights.summer).toBe(1);
    expect(SUMMER).toMatchObject({ turn: 0, bare: 0, blossom: 0, festival: 0, cold: 0 });
  });

  test('the festival is in the last third of winter and is fully up where it is held; winter itself is before it', () => {
    expect(seasonAt(0.75 + 0.25 * 0.5).festival).toBe(0);
    expect(seasonAt(holdYear('festival')).festival).toBe(1);
    expect(seasonAt(holdYear('winter')).festival).toBe(0);
    expect(seasonAt(0.75 + 0.25 * 0.7).festival).toBeGreaterThan(0);
    expect(seasonAt(0.1).festival).toBe(0);
  });

  test('autumn turns the trees, winter is bare, spring brings leaves and blossom back', () => {
    expect(seasonAt(holdYear('autumn')).turn).toBeGreaterThan(0.6);
    expect(seasonAt(holdYear('autumn')).bare).toBeLessThan(0.3);
    expect(seasonAt(holdYear('winter')).bare).toBe(1);
    expect(seasonAt(holdYear('spring')).bare).toBe(0);
    expect(seasonAt(holdYear('spring')).blossom).toBeGreaterThan(0.8);
  });

  test('a town opens in summer with a clear sky, and the year turns only while time passes', () => {
    const s = createSignals(5);
    expect(s.season.season).toBe('summer');
    expect(s.season.weights.summer).toBe(1);
    expect(s.weather.kind).toBe('clear');
    const y0 = s.season.year;
    s.hold('day');
    for (let i = 0; i < 600; i++) s.advance(0.1);
    expect(s.season.year).toBe(y0);
    s.hold('run');
    for (let i = 0; i < 600; i++) s.advance(0.1);
    expect(s.season.year).toBeCloseTo(y0 + 60 / yearSeconds(), 9);
  });

  test('holding a season parks the year; winter starts with a snowfall that settles', () => {
    const s = createSignals(5);
    s.holdSeason('winter');
    expect(s.seasonHolding).toBe('winter');
    expect(s.season.year).toBeCloseTo(holdYear('winter'), 9);
    for (let i = 0; i < 3000; i++) s.advance(0.1);
    expect(s.season.year).toBeCloseTo(holdYear('winter'), 9);
    expect(s.weather.cover).toBeGreaterThan(0.5);
    // And when spring comes the snow melts away.
    s.holdSeason('spring');
    s.holdWeather('clear');
    for (let i = 0; i < 3000; i++) s.advance(0.1);
    expect(s.weather.cover).toBe(0);
  });

  test('snow builds up gradually and nothing jumps', () => {
    const s = createSignals(9);
    s.holdWeather('snow');
    let last = s.weather.cover;
    for (let i = 0; i < 1200; i++) {
      s.advance(0.1);
      expect(s.weather.cover - last).toBeLessThan(0.01);
      expect(s.weather.cover).toBeGreaterThanOrEqual(last);
      last = s.weather.cover;
    }
    expect(last).toBeGreaterThan(0.6);
  });

  test('settleWeather brings a held kind in at once', () => {
    const s = createSignals(9);
    s.holdSeason('winter');
    s.holdWeather('snow');
    s.settleWeather();
    expect(s.weather.snow).toBeGreaterThan(0.5);
    expect(s.weather.cover).toBe(1);
    s.holdSeason('summer');
    s.holdWeather('rain');
    s.settleWeather();
    expect(s.weather.rain).toBeGreaterThan(0.5);
    expect(s.weather.wet).toBe(1);
    expect(s.weather.cover).toBe(0);
  });

  test('the same seed and steps give the same weather', () => {
    const a = createSignals(11), b = createSignals(11);
    for (let i = 0; i < 20000; i++) {
      a.advance(0.1);
      b.advance(0.1);
    }
    expect(a.weather).toEqual(b.weather);
    expect(a.season).toEqual(b.season);
  });

  test('weather follows the season: no snow in summer, mostly snow and cloud in winter', () => {
    const count = (year: number, kind: string): number => {
      let n = 0;
      for (let k = 0; k < 400; k++) if (rollWeather(3, k, seasonAt(year)) === kind) n++;
      return n;
    };
    expect(count(0.375, 'snow')).toBe(0);
    expect(count(0.875, 'snow')).toBeGreaterThan(100);
    expect(count(0.875, 'storm')).toBe(0);
    expect(count(0.375, 'storm')).toBeGreaterThan(5);
  });

  test('a storm flashes now and then; nothing else does', () => {
    let flashes = 0;
    for (let t = 0; t < 120; t += 0.05) if (flashAt(4, t, 1) > 0.5) flashes++;
    expect(flashes).toBeGreaterThan(5);
    expect(flashAt(4, 30, 0)).toBe(0);
  });

  test('signals without seasons read as summer and clear', () => {
    const fake = { time: createSignals(1).time, wind: () => ({ dirX: 1, dirZ: 0, strength: 0 }), on: () => () => {} };
    expect(seasonOf(fake)).toBe(SUMMER);
    expect(weatherOf(fake)).toBe(CLEAR);
  });

  test('the URL and scenario words', () => {
    expect(parseSeason('winter')).toEqual({ hold: 'winter' });
    expect(parseSeason('festival')).toEqual({ hold: 'festival' });
    expect(parseSeason('0.6')).toEqual({ hold: 'autumn', year: 0.6 });
    expect(parseSeason('nonsense')).toBeNull();
    expect(parseWeather('thunderstorm')).toBe('storm');
    expect(parseWeather('snow')).toBe('snow');
    expect(parseWeather('hail')).toBeNull();
    expect(WEATHER.spell).toBeGreaterThan(30);
  });
});
