import { describe, expect, test } from 'vitest';
import { key, SIZE_X, SIZE_Z } from '@/core/grid';
import { TIME } from '@/style/time';
import { WIND } from '@/style/wind';
import { createSignals, partPhases, sampleWind, timeAt, windFieldAt } from './signals';

describe('time', () => {
  test('one loop is 8 minutes: day 4:30, dusk 1:00, night 1:45, dawn 0:45', () => {
    expect([TIME.day, TIME.dusk, TIME.night, TIME.dawn]).toEqual([270, 60, 105, 45]);
    const p = partPhases();
    expect(p.day.start).toBe(0);
    expect(p.dusk.start).toBeCloseTo(270 / 480, 12);
    expect(p.night.start).toBeCloseTo(330 / 480, 12);
    expect(p.dawn.start).toBeCloseTo(435 / 480, 12);
    expect(p.dawn.end).toBeCloseTo(1, 12);
  });

  test('the cycle runs day, dusk, night, dawn and wraps to day', () => {
    const s = createSignals(3);
    const seen: string[] = [];
    for (let i = 0; i < 4800 + 10; i++) {
      s.advance(0.1);
      if (seen[seen.length - 1] !== s.time.part) seen.push(s.time.part);
    }
    expect(seen).toEqual(['day', 'dusk', 'night', 'dawn', 'day']);
  });

  test('light is 1 by day, 0 at night, and never jumps between them', () => {
    let last = timeAt(0, 0).light;
    for (let i = 1; i <= 4800; i++) {
      const light = timeAt(i / 4800, 0).light;
      expect(Math.abs(light - last)).toBeLessThan(0.01);
      last = light;
    }
    expect(timeAt(0.3, 0).light).toBe(1);
    expect(timeAt(partPhases().night.mid, 0).light).toBe(0);
  });

  test('signals clamp dt', () => {
    // Review Focus 4: the tab sleeps or a frame takes seconds. Life steps at most 100 ms.
    const s = createSignals(1);
    expect(s.advance(30)).toBe(TIME.maxStep);
    expect(s.advance(Number.POSITIVE_INFINITY)).toBe(0);
    expect(s.advance(Number.NaN)).toBe(0);
    expect(s.advance(-5)).toBe(0);
    expect(s.time.seconds).toBeCloseTo(0.1, 12);
    // A minute-long stall moves the dusk cycle by one clamped step, not a minute.
    const before = s.time.phase;
    s.advance(60);
    expect(s.time.phase - before).toBeCloseTo(0.1 / 480, 12);
    // Ordinary frames pass through untouched.
    expect(s.advance(1 / 60)).toBeCloseTo(1 / 60, 12);
  });

  test('hold parks the cycle at the middle of a part; life time keeps running; run resumes from there', () => {
    const s = createSignals(1);
    s.hold('dusk');
    expect(s.time.phase).toBeCloseTo(partPhases().dusk.mid, 12);
    for (let i = 0; i < 100; i++) s.advance(0.1);
    expect(s.time.phase).toBeCloseTo(partPhases().dusk.mid, 12);
    expect(s.time.seconds).toBeCloseTo(10, 6);
    s.hold('run');
    s.advance(0.1);
    expect(s.time.phase).toBeGreaterThan(partPhases().dusk.mid);
    expect(s.holding).toBe('run');
  });

  test('setPhase wraps into 0–1', () => {
    const s = createSignals(1);
    s.setPhase(1.25);
    expect(s.time.phase).toBeCloseTo(0.25, 12);
    s.setPhase(-0.25);
    expect(s.time.phase).toBeCloseTo(0.75, 12);
  });
});

describe('wind', () => {
  test('one town-wide unit direction, the same everywhere at one moment', () => {
    const s = createSignals(7);
    for (let i = 0; i < 50; i++) s.advance(0.1);
    const a = s.wind(3, 4), b = s.wind(40, 31);
    expect(Math.hypot(a.dirX, a.dirZ)).toBeCloseTo(1, 9);
    expect(b.dirX).toBe(a.dirX);
    expect(b.dirZ).toBe(a.dirZ);
    expect(a.strength).toBeGreaterThanOrEqual(0);
    expect(a.strength).toBeLessThanOrEqual(1.2);
  });

  test('the direction drifts slowly: under a degree a frame, but it does move', () => {
    const angle = (t: number): number => {
      const f = windFieldAt(11, t);
      return Math.atan2(f.dirZ, f.dirX);
    };
    for (let t = 0; t < 300; t += 7.3) expect(Math.abs(angle(t + 1 / 60) - angle(t))).toBeLessThan(0.0175);
    const spread = new Set<number>();
    for (let t = 0; t < 600; t += 20) spread.add(Math.round(angle(t) * 10));
    expect(spread.size).toBeGreaterThan(3);
  });

  test('a gust is a front that travels downwind across the map', () => {
    // Find a moment with a front on the map, then watch where the strongest wind is.
    const seed = 5;
    let t0 = -1;
    for (let t = 0; t < 120 && t0 < 0; t += 0.25) {
      const f = windFieldAt(seed, t);
      if (f.fronts.some((g) => g.position > -12 && g.position < -6)) t0 = t;
    }
    expect(t0).toBeGreaterThanOrEqual(0);
    const peakAlong = (t: number): number => {
      const f = windFieldAt(seed, t);
      let best = -Infinity, at = 0;
      for (let d = -30; d <= 30; d += 0.5) {
        const w = sampleWind(f, SIZE_X / 2 + f.dirX * d, SIZE_Z / 2 + f.dirZ * d);
        if (w.strength > best) {
          best = w.strength;
          at = d;
        }
      }
      return at;
    };
    const a = peakAlong(t0), b = peakAlong(t0 + 1);
    // One second later the peak has moved downwind by about gustSpeed columns.
    expect(b - a).toBeGreaterThan(WIND.gustSpeed * 0.6);
    expect(b - a).toBeLessThan(WIND.gustSpeed * 1.4);
    // Ahead of the front the air is still calm; at the front it is not.
    const f = windFieldAt(seed, t0);
    const front = f.fronts.find((g) => g.position > -12 && g.position < -6)!;
    const at = (d: number) => sampleWind(f, SIZE_X / 2 + f.dirX * d, SIZE_Z / 2 + f.dirZ * d).strength;
    expect(at(front.position)).toBeGreaterThan(at(front.position + 12) + 0.15);
  });

  test('the same seed and time give the same wind; another seed gives another', () => {
    expect(windFieldAt(4, 33.3)).toEqual(windFieldAt(4, 33.3));
    expect(windFieldAt(4, 33.3).dirX).not.toBe(windFieldAt(5, 33.3).dirX);
  });

  test('wind follows life time, so it keeps blowing while the time of day is held', () => {
    const s = createSignals(2);
    s.hold('night');
    const a = s.wind(10, 10);
    for (let i = 0; i < 300; i++) s.advance(0.1);
    const b = s.wind(10, 10);
    expect(b.strength !== a.strength || b.dirX !== a.dirX).toBe(true);
  });
});

describe('events', () => {
  test('emit reaches every subscriber of that event; unsubscribing during an emit is safe', () => {
    const s = createSignals(1);
    const got: string[] = [];
    const offA = s.on('blockLanded', (c) => {
      got.push(`a${c}`);
      offA();
    });
    s.on('blockLanded', (c) => got.push(`b${c}`));
    s.on('blockRemoved', (c) => got.push(`r${c}`));
    s.emit('blockLanded', key(1, 1, 1));
    s.emit('blockLanded', key(2, 1, 1));
    s.emit('personPassed', key(3, 1, 1));
    expect(got).toEqual([`a${key(1, 1, 1)}`, `b${key(1, 1, 1)}`, `b${key(2, 1, 1)}`]);
  });
});
