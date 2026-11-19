// The one easing family (see ../MOTION.md). Everything that eases uses these
// and nothing else, so a bounce, a pop-in and a bird settling on a rail all
// move the same way: cubic in and out, one overshoot, one damped settle.
//
// Every function takes t in 0..1 (clamped) and is pure.

import { MOTION } from '@/style/animation';

export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Starts slowly: something gathering itself (a fall, a take-off). */
export function easeIn(t: number): number {
  const x = clamp01(t);
  return x * x * x;
}

/** Arrives gently: something coming to rest. */
export function easeOut(t: number): number {
  const x = 1 - clamp01(t);
  return 1 - x * x * x;
}

/** Slow, fast, slow: a move from one rest to another. */
export function easeInOut(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/** 0 → 1, running past 1 by about 10% on the way and coming back: a pop. */
export function pop(t: number, overshoot = MOTION.overshoot): number {
  const x = clamp01(t) - 1;
  return 1 + (overshoot + 1) * x * x * x + overshoot * x * x;
}

/** A swing that dies away: +1 … −1 … 0 over `cycles` swings, exactly 0 at both ends. For a wobble. */
export function settle(t: number, cycles = 1.5): number {
  const x = clamp01(t);
  return Math.sin(x * cycles * Math.PI * 2) * (1 - x) * (1 - x);
}

/** 0 → 1 → 0: one rise and fall (a hop, a swell). */
export function arc(t: number): number {
  const x = clamp01(t);
  return 4 * x * (1 - x);
}

/** Where `t` lies between a and b, clamped to 0..1. */
export function span(t: number, a: number, b: number): number {
  return b === a ? (t >= b ? 1 : 0) : clamp01((t - a) / (b - a));
}

/** Moves `from` toward `to` by at most `step`. */
export function approach(from: number, to: number, step: number): number {
  return from < to ? Math.min(to, from + step) : Math.max(to, from - step);
}

/** Exponential glide: the fraction of the way to cover in `dt` at `rate` per second. Frame-rate independent. */
export function glide(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

/** The signed smallest turn from angle a to angle b, in −π..π. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
