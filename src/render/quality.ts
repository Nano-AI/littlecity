// How sharp the page is drawn, and the governor that chooses (design section 14). Pure: no Three.js,
// no DOM, no clock (it is fed the gaps between frames).
//
// A view starts at its sharpest and only gives ground when frames are really slow, a level at a time,
// in this order: the super-sampling (only a low-density screen has it), then the pixel ratio from 3
// toward 2, and the half-resolution ink pass last (it is the change that shows most: lines a third of
// a phone's resolution, thick and soft). Once frames are comfortably fast again it tries one level
// back up; a level that proves slow a second time is not tried again for a while, longer each time,
// so it never flickers between two.

export interface Quality {
  /** Device pixels per CSS pixel the page is drawn at. */
  pixelRatio: number;
  /** The scene drawn at this many times the pixel ratio and averaged down (1 or 2). */
  superSample: 1 | 2;
  /** The ink computed at half resolution (cheaper, softer, blockier lines). */
  halfInk: boolean;
}

/** The levels for a screen of this device pixel ratio, sharpest first. */
export function qualityLevels(devicePixelRatio: number): Quality[] {
  const start = Math.max(1, Math.min(3, devicePixelRatio || 1));
  if (start < 1.5) {
    return [
      { pixelRatio: start, superSample: 2, halfInk: false },
      { pixelRatio: start, superSample: 1, halfInk: false },
      { pixelRatio: start, superSample: 1, halfInk: true },
    ];
  }
  const out: Quality[] = [{ pixelRatio: start, superSample: 1, halfInk: false }];
  for (const r of [2.5, 2]) if (r < start - 0.25) out.push({ pixelRatio: r, superSample: 1, halfInk: false });
  const low = Math.min(start, 2);
  out.push({ pixelRatio: low, superSample: 1, halfInk: true });
  if (low > 1.5) out.push({ pixelRatio: 1.5, superSample: 1, halfInk: true });
  return out;
}

export const GOVERNOR = {
  /** Milliseconds of frames judged together. */
  window: 2000,
  /** Milliseconds ignored after starting and after every change (shaders compile, buffers are made). */
  settle: 1500,
  /** A gap longer than this is a pause (a hidden tab, a rebuild), not a slow frame: left out. */
  pause: 250,
  /** Slow: the median frame longer than this (below about 48 a second) ... */
  slowMedian: 21,
  /** ... or this share of frames longer than two refreshes at 60 Hz. */
  slowShare: 0.15,
  longFrame: 34,
  /** Very slow (the median longer than this): one window is enough to step down. */
  verySlow: 30,
  /** Fast: the median and the 90th percentile under these (a steady 60, or better). */
  fastMedian: 17.5,
  fastP90: 20,
  /** Windows in a row: slow to step down, fast to try a level up. */
  slowWindows: 2,
  fastWindows: 5,
  /** After a level up proved slow: no new try for this long, doubling each time. */
  backoff: 30_000,
  /** A change waits for the picture to be moving (it then does not show as a pop), at most this long. */
  waitForMotion: 3000,
} as const;

export interface Governor {
  /** The level now (an index into the levels, 0 the sharpest). */
  readonly level: number;
  /**
   * One frame: the gap since the last (milliseconds) and whether the picture is moving now. Returns
   * the level to change to, when it changes, or null.
   */
  frame(gapMs: number, moving: boolean): number | null;
}

export function createGovernor(levels: number, start = 0): Governor {
  let level = Math.max(0, Math.min(levels - 1, start));
  let clock = 0;
  let quietUntil = GOVERNOR.settle;
  let gaps: number[] = [];
  let windowStart = 0;
  let slowRun = 0, fastRun = 0;
  /** A level up being tried: where it came from, and until when a slow window sends it straight back. */
  let trial: { from: number; until: number } | null = null;
  /** No trying a level up before this time; and how long the next wait is. */
  let noUpUntil = 0;
  let nextBackoff: number = GOVERNOR.backoff;
  /** A change waiting for the picture to move; `up` when it is a try of the level above. */
  let pending: { to: number; since: number; up: boolean } | null = null;

  const judge = (): 'slow' | 'fast' | 'ok' => {
    if (gaps.length < 10) return 'ok';
    const s = [...gaps].sort((a, b) => a - b);
    const median = s[s.length >> 1]!;
    const p90 = s[Math.floor(s.length * 0.9)]!;
    const long = s.filter((g) => g > GOVERNOR.longFrame).length / s.length;
    if (median > GOVERNOR.slowMedian || long >= GOVERNOR.slowShare) return 'slow';
    return median <= GOVERNOR.fastMedian && p90 <= GOVERNOR.fastP90 ? 'fast' : 'ok';
  };
  const medianOf = (): number => [...gaps].sort((a, b) => a - b)[gaps.length >> 1] ?? 0;

  return {
    get level() {
      return level;
    },
    frame(gapMs, moving) {
      clock += Math.min(gapMs, GOVERNOR.pause);
      if (pending) {
        if (moving || clock - pending.since >= GOVERNOR.waitForMotion) {
          const { to, up } = pending;
          if (up) trial = { from: level, until: clock + GOVERNOR.settle + GOVERNOR.window * 2 + 1 };
          pending = null;
          level = to;
          quietUntil = clock + GOVERNOR.settle;
          gaps = [];
          windowStart = clock;
          return to;
        }
        return null;
      }
      if (clock < quietUntil) {
        windowStart = clock;
        return null;
      }
      if (gapMs <= GOVERNOR.pause) gaps.push(gapMs);
      if (clock - windowStart < GOVERNOR.window) return null;
      const verdict = judge();
      const verySlow = verdict === 'slow' && medianOf() > GOVERNOR.verySlow;
      gaps = [];
      windowStart = clock;
      if (verdict === 'slow') {
        fastRun = 0;
        slowRun++;
        if (trial && clock <= trial.until) {
          // The level up was too much: back, and wait longer before the next try.
          pending = { to: trial.from, since: clock, up: false };
          trial = null;
          noUpUntil = clock + nextBackoff;
          nextBackoff *= 2;
          slowRun = 0;
          return null;
        }
        if ((slowRun >= GOVERNOR.slowWindows || verySlow) && level < levels - 1) {
          pending = { to: level + 1, since: clock, up: false };
          slowRun = 0;
        }
        return null;
      }
      slowRun = 0;
      if (trial && clock > trial.until) trial = null;
      if (verdict === 'fast') {
        fastRun++;
        if (fastRun >= GOVERNOR.fastWindows && level > 0 && clock >= noUpUntil) {
          pending = { to: level - 1, since: clock, up: true };
          fastRun = 0;
        }
      } else fastRun = 0;
      return null;
    },
  };
}
