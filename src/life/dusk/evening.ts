// "How long has it been evening?" One clock for everything dusk switches
// on, so windows and lamps keep step. It starts when the page first lets
// anything glow (a third of the way into dusk) and runs through the night;
// it is 0 by day. Pure: a function of the time signal alone, so a town held
// at dusk or opened at night is lit exactly as if it had lived through the
// evening.

import { TIME } from '@/style/time';
import type { TimeSignal } from '../api';
import { partPhases } from '../signals';
import { GLOW_MIN, glowOf } from './glow';

let duskStartFor = '';
let duskStart = 0;

/** Seconds into dusk at which the page glow first reaches GLOW_MIN. */
function glowStartInDusk(): number {
  const key = `${TIME.day}:${TIME.dusk}:${TIME.night}:${TIME.dawn}`;
  if (key === duskStartFor) return duskStart;
  const p = partPhases().dusk;
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const phase = p.start + (p.end - p.start) * mid;
    const within = mid * mid * (3 - 2 * mid);
    const glow = glowOf({ phase, part: 'dusk', isDay: false, isDusk: true, isNight: false, isDawn: false, light: 1 - within, seconds: 0 });
    if (glow >= GLOW_MIN) hi = mid;
    else lo = mid;
  }
  duskStartFor = key;
  duskStart = hi * TIME.dusk;
  return duskStart;
}

/** Seconds since lights could first be lit this evening; 0 by day and at dawn. */
export function eveningSeconds(time: TimeSignal): number {
  const phases = partPhases();
  const loop = TIME.day + TIME.dusk + TIME.night + TIME.dawn;
  if (time.isDusk) return Math.max(0, (time.phase - phases.dusk.start) * loop - glowStartInDusk());
  if (time.isNight) return TIME.dusk - glowStartInDusk() + (time.phase - phases.night.start) * loop;
  return 0;
}

/** How far through the night it is, 0–1; 0 before it, 1 after it (at dawn). */
export function nightProgress(time: TimeSignal): number {
  if (time.isDawn) return 1;
  if (!time.isNight) return 0;
  const p = partPhases().night;
  return (time.phase - p.start) / (p.end - p.start);
}

/** How far through dawn it is, 0–1; 0 at any other time. */
export function dawnProgress(time: TimeSignal): number {
  if (!time.isDawn) return 0;
  const p = partPhases().dawn;
  return (time.phase - p.start) / (p.end - p.start);
}
