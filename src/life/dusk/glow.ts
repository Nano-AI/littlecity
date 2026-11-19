// How lit the page lets things be, and how to switch one thing on.
//
// The renderer draws anything self-lit (PATTERN.glow: lamp glass, lanterns,
// a lit pane) at brightness  page glow × the instance's param a,  where the
// page glow rises from 0 to 1 through dusk (src/render/grade.ts). So with
// a = 1 every lamp in town would fade up together. To switch ONE lamp on at
// its own moment, a behaviour sets  a = litParam(on, glow):  0 while it is
// off, and whatever makes the product equal `on` once it is lit.
//
// Before the page glow leaves 0 (the first third of dusk) nothing can be
// lit at all; `canGlow` says when it can.

import { gradeAt } from '@/render/grade';
import type { TimeSignal } from '../api';

let lastPhase = NaN;
let lastGlow = 0;

/** The page's glow at this time of day: 0 by day, 1 at night. The same number the shaders use. */
export function glowOf(time: TimeSignal): number {
  if (time.phase !== lastPhase) {
    lastPhase = time.phase;
    lastGlow = gradeAt(time).glow;
  }
  return lastGlow;
}

/** The least page glow at which something can be switched fully on. */
export const GLOW_MIN = 0.02;

export function canGlow(glow: number): boolean {
  return glow >= GLOW_MIN;
}

/** The instance param `a` that shows a self-lit surface at `on` (0 dark to 1 lit), given the page glow now. */
export function litParam(on: number, glow: number): number {
  if (on <= 0 || glow < GLOW_MIN) return 0;
  return Math.min(on / glow, 1 / GLOW_MIN);
}
