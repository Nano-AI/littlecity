// "On twos" (see ../MOTION.md): poses are redrawn MOTION.poseFps times a
// second (12), like drawn animation shot two frames to a drawing. Travel
// (where a thing is along its path) stays smooth; what is stepped is the
// drawing of the thing: a wing beat, a bob, a turning sail, a puff's shape.
//
// Two ways to use it:
//
//   onTwos(seconds, phase)     for a pose that is a pure function of time:
//                              the time of the drawing now showing.
//   const tw = new Twos(phase) for a pose that is integrated (a wheel with
//   const step = tw.tick(dt)   inertia): `step` is 0 between drawings and the
//                              whole time since the last drawing on a new one.
//
// `phase` (0..1, from the item's seed) spreads things over the twelve slots,
// so a street of chimneys does not all redraw on the same frame: it reads as
// many hands drawing, and it spreads the work.

import { MOTION } from '@/style/animation';

/** The time of the drawing that is showing at `seconds`. */
export function onTwos(seconds: number, phase = 0): number {
  const fps = MOTION.poseFps;
  return (Math.floor(seconds * fps + phase) - phase) / fps;
}

export class Twos {
  private acc: number;

  constructor(phase = 0) {
    // Start part-way to the first drawing, by the item's phase.
    this.acc = (phase % 1) / MOTION.poseFps;
  }

  /** Call every frame. Returns the seconds to advance the pose by now: 0, or the time since the last drawing. */
  tick(dt: number): number {
    this.acc += dt;
    // A hair of slack, so a 60 fps frame loop lands on every fifth frame and not sometimes the sixth.
    if (this.acc < 1 / MOTION.poseFps - 1e-4) return 0;
    const step = this.acc;
    this.acc = 0;
    return step;
  }
}
