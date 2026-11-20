// A boat that simply lies afloat where its rule put it: the fishing boat
// until L18 sends it to sea, and any boat anchored to a cell (the gallery).
// It bobs, rolls and pitches on the swell and leaves a ring now and then.

import { boatPose } from '../mischief/boatwreck';
import { SEA_Y } from '@/core/grid';
import { positionOf, type Mat4, type Mat4Like } from '@/core/mat4';
import type { DressingPlan } from '@/resolve/plan';
import { BOATS } from '@/style/boats';
import type { InstanceHandle, LifeStage, Signals } from '../api';
import { fly, yawOf } from '../motion/pose';
import { onTwos } from '../motion/twos';
import { hullRing, swellAt, type Swell } from './afloat';

export interface Floating {
  x: number;
  z: number;
  yaw: number;
  length: number;
  beam: number;
  phase: number;
  /** The drawing last posed. */
  drawn: number;
  /** The ring last left. */
  ring: number;
  dressing: DressingPlan | null;
  swell: Swell;
  m: Mat4;
}

export function floatingAt(base: Mat4Like, phase: number, length: number, beam: number): Floating {
  const [x, , z] = positionOf(base);
  return { x, z, yaw: yawOf(base), length, beam, phase, drawn: NaN, ring: NaN, dressing: null, swell: { heave: 0, roll: 0, pitch: 0 }, m: new Array<number>(16).fill(0) };
}

/** Moves a floating boat's anchor (its rule placed it somewhere else). */
export function refloat(f: Floating, base: Mat4Like): void {
  const [x, , z] = positionOf(base);
  f.x = x;
  f.z = z;
  f.yaw = yawOf(base);
  f.drawn = NaN;
}

/**
 * Poses a floating boat on twos. Returns true when a new drawing was made (f.m holds its matrix), so
 * a caller with things fixed to the hull can pose them too. `heel` is added to the roll.
 */
export function poseFloating(f: Floating, signals: Signals, instance: InstanceHandle, stage: LifeStage, dressing: DressingPlan, heel = 0, boat?: { id: string; type: string }): boolean {
  const now = onTwos(signals.time.seconds, f.phase);
  if (now === f.drawn && dressing === f.dressing) return false;
  f.drawn = now;
  f.dressing = dressing;
  const wind = signals.wind(f.x, f.z).strength;
  const sw = swellAt(now, f.phase, f.length, wind, f.swell);
  fly(f.x, SEA_Y + sw.heave, f.z, f.yaw, sw.pitch, sw.roll + heel, 1, f.m);
  // Mischief: a blast may have swamped or capsized it (src/life/mischief/boatwreck.ts).
  if (boat) boatPose(stage, boat.id, boat.type, f.m, signals.time.seconds);
  instance.setMatrix(f.m);
  const beat = Math.floor(now / BOATS.wakeEvery + f.phase);
  if (beat !== f.ring) {
    if (!Number.isNaN(f.ring)) hullRing(stage, f.x, f.z, f.yaw, f.beam, f.length);
    f.ring = beat;
  }
  return true;
}
