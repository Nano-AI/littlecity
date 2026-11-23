// The quality levels and the governor that steps through them (src/render/quality.ts).

import { describe, expect, test } from 'vitest';
import { createGovernor, GOVERNOR, qualityLevels, startLevel } from './quality';

describe('levels', () => {
  test('sharpest first: super-sampling goes first, then the pixel ratio toward 2, the half-resolution ink last', () => {
    expect(qualityLevels(3)).toEqual([
      { pixelRatio: 3, superSample: 1, halfInk: false },
      { pixelRatio: 2.5, superSample: 1, halfInk: false },
      { pixelRatio: 2, superSample: 1, halfInk: false },
      { pixelRatio: 2, superSample: 1, halfInk: true },
      { pixelRatio: 1.5, superSample: 1, halfInk: true },
    ]);
    expect(qualityLevels(2).map((q) => [q.pixelRatio, q.halfInk])).toEqual([[2, false], [2, true], [1.5, true]]);
    expect(qualityLevels(2.625).map((q) => q.pixelRatio)).toEqual([2.625, 2, 2, 1.5]);
    expect(qualityLevels(1)).toEqual([
      { pixelRatio: 1, superSample: 2, halfInk: false },
      { pixelRatio: 1, superSample: 1.5, halfInk: false },
      { pixelRatio: 1, superSample: 1, halfInk: false },
      { pixelRatio: 1, superSample: 1, halfInk: true },
    ]);
    // A 4x screen is drawn at 3 at most.
    expect(qualityLevels(4)[0]!.pixelRatio).toBe(3);
  });
});

describe('where a view starts', () => {
  test('a big 1x screen starts a step below full super-sampling: four times its pixels is more than a frame has time for', () => {
    // 2560 x 1440 drawn at twice the size each way is 14.7 million pixels a frame.
    expect(startLevel(qualityLevels(1), 2560, 1440)).toBe(1);
    expect(startLevel(qualityLevels(1), 2560, 1300)).toBe(1);
    // A laptop's 1x window is small enough to start at the sharpest.
    expect(startLevel(qualityLevels(1), 1440, 800)).toBe(0);
    expect(startLevel(qualityLevels(1), 1920, 1080)).toBe(0);
  });

  test('a screen with no super-sampling starts at its sharpest, as before (the governor finds out)', () => {
    expect(startLevel(qualityLevels(2), 2560, 1440)).toBe(0);
    expect(startLevel(qualityLevels(3), 390, 844)).toBe(0);
    expect(startLevel([{ pixelRatio: 1, superSample: 2, halfInk: false }], 2560, 1440)).toBe(0);
  });
});

/** Runs the governor for `seconds` on a device whose frame takes `costOf(level)` ms; returns the changes. */
function run(costOf: (level: number) => number, seconds: number, opts: { levels?: number; moving?: (t: number) => boolean } = {}) {
  const g = createGovernor(opts.levels ?? 5);
  const changes: { at: number; to: number }[] = [];
  let t = 0;
  while (t < seconds * 1000) {
    // A frame takes its cost, rounded up to the 60 Hz refresh, give or take a little.
    const cost = costOf(g.level);
    const gap = Math.ceil(cost / 16.67 - 0.02) * 16.67 + ((t * 7) % 3) * 0.1;
    t += gap;
    const to = g.frame(gap, opts.moving ? opts.moving(t) : true);
    if (to !== null) changes.push({ at: t, to });
  }
  return { changes, level: g.level };
}

describe('the governor', () => {
  test('a fast device stays at the sharpest level', () => {
    expect(run(() => 9, 120).changes).toEqual([]);
  });

  test('a slow device steps down a level at a time until frames keep up, and stays there', () => {
    // Levels 0 and 1 too slow (a frame every 33 ms), level 2 keeps up.
    const r = run((l) => (l < 2 ? 30 : 12), 300);
    expect(r.level).toBe(2);
    expect(r.changes.map((c) => c.to).slice(0, 2)).toEqual([1, 2]);
    // It tries level 1 again now and then, but not often: the waits double.
    const ups = r.changes.filter((c, i) => i >= 2 && c.to === 1);
    expect(ups.length).toBeLessThanOrEqual(4);
    for (let i = 1; i < ups.length; i++) expect(ups[i]!.at - ups[i - 1]!.at).toBeGreaterThan(GOVERNOR.backoff * 2 ** (i - 1));
  });

  test('a device that slows down later (a hot phone) steps down then; once fast again it comes back up', () => {
    let hot = true;
    const g = createGovernor(5);
    const seen: number[] = [];
    let t = 0;
    while (t < 200_000) {
      if (t > 60_000) hot = false;
      const gap = hot && g.level === 0 ? 33.3 : 16.7;
      t += gap;
      const to = g.frame(gap, true);
      if (to !== null) seen.push(to);
    }
    expect(seen[0]).toBe(1);
    expect(g.level).toBe(0);
  });

  test('a change waits for the picture to move (where it does not show), at most a few seconds', () => {
    // Still for the first 20 s, then moving.
    const still = run((l) => (l === 0 ? 30 : 10), 20, { moving: (t) => t > 20_000 });
    expect(still.changes[0]!.to).toBe(1);
    const at = still.changes[0]!.at;
    const moving = run((l) => (l === 0 ? 30 : 10), 20, { moving: () => true });
    expect(moving.changes[0]!.at).toBeLessThan(at);
    expect(at - moving.changes[0]!.at).toBeLessThanOrEqual(GOVERNOR.waitForMotion + 100);
  });

  test('a frame missed now and then is slow: one in three taking two refreshes is judder, though the median frame is on time', () => {
    // Level 0 a little over what a refresh allows: two frames on time, then one late. (The median is
    // 16.7 ms and no frame is longer than 34 ms: this used to be judged fine, for ever.)
    const g = createGovernor(4);
    const seen: number[] = [];
    let n = 0;
    for (let t = 0; t < 30_000; ) {
      const gap = g.level === 0 && n++ % 3 === 2 ? 33.3 : 16.7;
      t += gap;
      const to = g.frame(gap, true);
      if (to !== null) seen.push(to);
    }
    expect(seen[0]).toBe(1);
    expect(g.level).toBe(1);
  });

  test('the same on a 120 Hz screen: half the frames taking two refreshes is slow', () => {
    const g = createGovernor(4);
    let n = 0;
    for (let t = 0; t < 12_000; ) {
      const gap = g.level === 0 && n++ % 5 >= 3 ? 16.7 : 8.3;
      t += gap;
      g.frame(gap, true);
    }
    expect(g.level).toBe(1);
  });

  test('a steady 60 on a 120 Hz screen is left alone', () => {
    const g = createGovernor(4);
    let changed = false;
    // A few frames at 120 at the start, then a steady 60.
    for (let i = 0; i < 4000; i++) if (g.frame(i < 30 ? 8.3 : 16.7, true) !== null) changed = true;
    expect(changed).toBe(false);
  });

  test('a level that keeps up for a while and then does not is not gone back to at once: no going to and fro', () => {
    // Level 0 holds for its first 20 s each time, then misses one frame in four (a level right at the edge).
    const g = createGovernor(4);
    const ups: number[] = [];
    let since = 0, n = 0;
    for (let t = 0; t < 600_000; ) {
      const gap = g.level === 0 && t - since > 20_000 && n++ % 4 === 3 ? 33.3 : 16.7;
      t += gap;
      const to = g.frame(gap, true);
      if (to === 0) {
        ups.push(t);
        since = t;
      }
    }
    // Ten minutes: a handful of tries, each further from the last.
    expect(ups.length).toBeGreaterThanOrEqual(1);
    expect(ups.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < ups.length; i++) expect(ups[i]! - ups[i - 1]!).toBeGreaterThan(GOVERNOR.backoff * 2 ** (i - 1));
  });

  test('the frames after an edit (the town rebuilt: the page was busy, not slow to draw) are not slow frames', () => {
    const g = createGovernor(4);
    let changed = false;
    // A town growing by itself: every sixth frame an edit lands, and the two frames after it are long.
    for (let i = 0; i < 6000; i++) {
      const busy = i % 6 < 2;
      if (g.frame(busy ? 50 : 16.7, true, busy) !== null) changed = true;
    }
    expect(changed).toBe(false);
  });

  test('pauses (a hidden tab, a rebuild of a few hundred ms) are not slow frames', () => {
    const g = createGovernor(5);
    let changed = false;
    for (let i = 0; i < 6000; i++) if (g.frame(i % 100 === 0 ? 900 : 16.7, true) !== null) changed = true;
    expect(changed).toBe(false);
  });
});
