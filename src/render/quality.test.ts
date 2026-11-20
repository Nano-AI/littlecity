// The quality levels and the governor that steps through them (src/render/quality.ts).

import { describe, expect, test } from 'vitest';
import { createGovernor, GOVERNOR, qualityLevels } from './quality';

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
      { pixelRatio: 1, superSample: 1, halfInk: false },
      { pixelRatio: 1, superSample: 1, halfInk: true },
    ]);
    // A 4x screen is drawn at 3 at most.
    expect(qualityLevels(4)[0]!.pixelRatio).toBe(3);
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

  test('pauses (a hidden tab, a rebuild of a few hundred ms) are not slow frames', () => {
    const g = createGovernor(5);
    let changed = false;
    for (let i = 0; i < 6000; i++) if (g.frame(i % 100 === 0 ? 900 : 16.7, true) !== null) changed = true;
    expect(changed).toBe(false);
  });
});
