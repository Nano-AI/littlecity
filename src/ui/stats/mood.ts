// The town's mood and its silly tallies: plain numbers, no drawing, no game.

import {
  MOOD,
  MOOD_WEIGHTS,
  SILLY,
  type MoodCause,
  type SillyKey,
} from "@/style/stats";

export type { MoodCause, SillyKey };

/** Mood from 0 to 100: things happen to it, and it drifts back to `rest`. */
export function createMood(rest: number = MOOD.rest) {
  let value = rest;
  return {
    get value() {
      return value;
    },
    hit(cause: MoodCause, n = 1) {
      value = Math.min(100, Math.max(0, value + MOOD_WEIGHTS[cause] * n));
    },
    step(dt: number) {
      if (dt > 0)
        value = rest + (value - rest) * Math.exp(-dt / MOOD.recoverySeconds);
    },
  };
}

const KEYS = Object.keys(SILLY) as SillyKey[];

/** Counts of silly things; `next` walks the non-zero ones in `SILLY` order, round and round. */
export function createTally() {
  const counts = new Map<SillyKey, number>();
  let last = -1;
  const get = (key: SillyKey) => counts.get(key) ?? 0;
  return {
    add(key: SillyKey, n = 1) {
      counts.set(key, get(key) + n);
    },
    set(key: SillyKey, n: number) {
      counts.set(key, n);
    },
    get,
    next(): { key: SillyKey; n: number } | null {
      for (let i = 1; i <= KEYS.length; i++) {
        const at = (last + i) % KEYS.length;
        const n = get(KEYS[at]);
        if (n > 0) {
          last = at;
          return { key: KEYS[at], n };
        }
      }
      return null;
    },
  };
}
