// How sharp the page is drawn, and the governor that chooses (design section 14). Pure: no Three.js,
// no DOM, no clock (it is fed the gaps between frames).
//
// A view starts at its sharpest and only gives ground when frames are really slow, a level at a time,
// in this order: the super-sampling (only a low-density screen has it; from 2 to 1.5 to none), then
// the pixel ratio from 3 toward 2, and the half-resolution ink pass last (it is the change that shows
// most: lines a third of a phone's resolution, thick and soft). Once frames are comfortably fast again
// it tries one level back up; a level that proves slow again is not tried for a while, longer each
// time, so it never flickers between two.
//
// Slow is not only "every frame late". A level a little over what one refresh allows gives two frames
// on time and then one a refresh late: the median frame is on time, no frame is very long, and the
// picture judders, most of all while the camera turns. So a frame is long when it is well over the
// usual frame (the median), whatever the screen's refresh rate, and one long frame in ten is slow.
// (Derek, 2026-11-22, a 2560 x 1440 screen at 1x: "pretty strong jitter" turning the camera. Twice
// the size each way is 14.7 million pixels a frame there, about 17 ms of drawing on an M5: see
// startLevel.)

export interface Quality {
  /** Device pixels per CSS pixel the page is drawn at. */
  pixelRatio: number;
  /** The scene drawn at this many times the pixel ratio each way and averaged down (1, 1.5 or 2). */
  superSample: number;
  /** The ink computed at half resolution (cheaper, softer, blockier lines). */
  halfInk: boolean;
}

/** The levels for a screen of this device pixel ratio, sharpest first. */
export function qualityLevels(devicePixelRatio: number): Quality[] {
  const start = Math.max(1, Math.min(3, devicePixelRatio || 1));
  if (start < 1.5) {
    return [
      { pixelRatio: start, superSample: 2, halfInk: false },
      // Most of the smoothness for 56% of the pixels: the step a big screen can afford.
      { pixelRatio: start, superSample: 1.5, halfInk: false },
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

/**
 * Pixels of the scene a frame, above which a super-sampled view starts a step down (measured on an
 * Apple M5, tools/perf.mjs --passes: 14.7 million take 15 ms at rest and 17.5 ms while the camera
 * turns, 9.2 million under 10 ms).
 */
export const START_PIXELS = 10_000_000;

/**
 * The level a view of this size (CSS pixels) starts at. The sharpest, unless that is super-sampled
 * and more pixels than a frame has time for: then the next one, and the governor tries the sharpest
 * once frames have been fast for a while (a faster machine gets it within seconds). A screen with
 * no super-sampling starts at its sharpest as before: its next level is a change that shows.
 */
export function startLevel(levels: readonly Quality[], width: number, height: number): number {
  const first = levels[0], next = levels[1];
  if (!first || !next || first.superSample <= 1 || next.superSample >= first.superSample) return 0;
  const side = first.pixelRatio * first.superSample;
  return width * side * height * side > START_PIXELS ? 1 : 0;
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
  /**
   * ... or this share of frames long: over `longFrame` (two refreshes at 60 Hz), or well over the
   * usual frame (`longRatio` times the median: a frame that took two refreshes where most take one,
   * at 60 Hz or 120).
   */
  slowShare: 0.1,
  longFrame: 34,
  longRatio: 1.6,
  /** Very slow (the median longer than this): one window is enough to step down. */
  verySlow: 30,
  /** Fast: the median and the 90th percentile under these (a steady 60, or better), and hardly a long frame. */
  fastMedian: 17.5,
  fastP90: 20,
  fastShare: 0.03,
  /** A level just tried: for this long after it settles, one slow window sends it straight back. */
  trial: 12_000,
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
   * One frame: the gap since the last (milliseconds) and whether the picture is moving now. `busy`:
   * the page was working in that gap (an edit resolved, the town rebuilt), so a long gap says nothing
   * of how fast the page is drawn and is left out. Returns the level to change to, when it changes,
   * or null.
   */
  frame(gapMs: number, moving: boolean, busy?: boolean): number | null;
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
  /** The level now was come up to (not stepped down to, and not the one it started at). */
  let rose = false;
  /** A change waiting for the picture to move; `up` when it is a try of the level above. */
  let pending: { to: number; since: number; up: boolean } | null = null;

  const judge = (): 'slow' | 'fast' | 'ok' => {
    if (gaps.length < 10) return 'ok';
    const s = [...gaps].sort((a, b) => a - b);
    const median = s[s.length >> 1]!;
    const p90 = s[Math.floor(s.length * 0.9)]!;
    const longAt = Math.min(GOVERNOR.longFrame, median * GOVERNOR.longRatio);
    const long = s.filter((g) => g > longAt).length / s.length;
    if (median > GOVERNOR.slowMedian || long >= GOVERNOR.slowShare) return 'slow';
    return median <= GOVERNOR.fastMedian && p90 <= GOVERNOR.fastP90 && long <= GOVERNOR.fastShare ? 'fast' : 'ok';
  };
  const medianOf = (): number => [...gaps].sort((a, b) => a - b)[gaps.length >> 1] ?? 0;

  return {
    get level() {
      return level;
    },
    frame(gapMs, moving, busy = false) {
      clock += Math.min(gapMs, GOVERNOR.pause);
      if (pending) {
        if (moving || clock - pending.since >= GOVERNOR.waitForMotion) {
          const { to, up } = pending;
          if (up) trial = { from: level, until: clock + GOVERNOR.settle + GOVERNOR.trial };
          rose = up;
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
      if (gapMs <= GOVERNOR.pause && !busy) gaps.push(gapMs);
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
          // A level it had come back up to, that kept up for a while and no longer does (a level at
          // the edge): not straight back to it, and a longer wait each time.
          if (rose) {
            noUpUntil = clock + nextBackoff;
            nextBackoff *= 2;
          }
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
