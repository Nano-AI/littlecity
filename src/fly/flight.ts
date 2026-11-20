// Flying (fly mode, design section 7): a free eye moved Minecraft style. Pure.
//
// W and S move along the way the eye looks (up and down with it), A and D
// sideways, Space and Shift straight up and down; speed eases in and out
// (no head bob, no gravity). The eye is a small box: it cannot pass through
// anything the solid map says is in the way, and slides along what it meets
// (each axis is moved and checked on its own, as Minecraft does). It keeps
// over the map: a margin round it and a ceiling over the tallest thing,
// except that an eye which starts outside them (fly mode begins wherever the
// builder's camera was) may come in but not go farther out.

import { SEA_Y, SIZE_X, SIZE_Z } from '@/core/grid';
import type { SolidMap } from './solid';

export const FLIGHT = {
  /** Cruising speed at the default setting, world units (cells) a second: the island in about 8 s. */
  speed: 6,
  /** The wheel's range, as multiples of that. */
  minScale: 0.25,
  maxScale: 4,
  /** How quickly the eye gets going and comes to rest (1/s): about a third of a second either way. */
  accel: 7,
  /** Half the size of the eye's box (a person is 0.46 tall; a door about 0.3 wide). */
  radius: 0.16,
  /** How far past the map's edge one can fly, and how high over the tallest thing. */
  margin: 8,
  headroom: 10,
  /** The longest step, seconds: a frame is cut into equal steps no longer than this. */
  step: 1 / 120,
  /** A frame longer than this (a hitch, a tab coming back) moves the eye this much and no more. */
  maxFrame: 0.1,
} as const;

export interface FlightState {
  eye: [number, number, number];
  vel: [number, number, number];
  /** Degrees: yaw 0 looks north (−z), 90 west (−x); pitch above the horizon. */
  yaw: number;
  pitch: number;
  /** The wheel's speed multiple. */
  scale: number;
  /** The box the eye may move in (it widens to take in where flight began, and narrows as the eye comes in). */
  box: { lo: [number, number, number]; hi: [number, number, number] };
}

export interface FlightInput {
  /** -1 back … 1 forward; -1 left … 1 right; -1 down … 1 up. */
  forward: number;
  strafe: number;
  rise: number;
}

/** The box an eye may fly in over this map. */
export function flightBox(map: SolidMap): FlightState['box'] {
  const m = FLIGHT.margin;
  return { lo: [-m, SEA_Y + FLIGHT.radius, -m], hi: [SIZE_X + m, map.top + FLIGHT.headroom, SIZE_Z + m] };
}

/** A flight starting at `eye`, looking yaw / pitch, at rest. */
export function startFlight(map: SolidMap, eye: readonly [number, number, number], yaw: number, pitch: number, scale = 1): FlightState {
  const box = flightBox(map);
  for (let a = 0; a < 3; a++) {
    box.lo[a] = Math.min(box.lo[a]!, eye[a]!);
    box.hi[a] = Math.max(box.hi[a]!, eye[a]!);
  }
  return { eye: [eye[0], eye[1], eye[2]], vel: [0, 0, 0], yaw, pitch, scale, box };
}

/** The wheel: one notch up or down multiplies the speed by this, within FLIGHT's range. */
export function changeSpeed(f: FlightState, notches: number): void {
  f.scale = Math.min(FLIGHT.maxScale, Math.max(FLIGHT.minScale, f.scale * Math.pow(1.25, notches)));
}

/** Is the eye's box at p clear of everything? */
export function clearAt(map: SolidMap, p: readonly [number, number, number]): boolean {
  const r = FLIGHT.radius;
  for (const dx of [-r, r]) for (const dy of [-r, r]) for (const dz of [-r, r]) if (map.hidden(p[0] + dx, p[1] + dy, p[2] + dz)) return false;
  // The middles of the faces too: a thin post or sheet can stand between two corners.
  return !(map.hidden(p[0], p[1], p[2]) || map.hidden(p[0] + r, p[1], p[2]) || map.hidden(p[0] - r, p[1], p[2]) || map.hidden(p[0], p[1], p[2] + r) || map.hidden(p[0], p[1], p[2] - r) || map.hidden(p[0], p[1] + r, p[2]) || map.hidden(p[0], p[1] - r, p[2]));
}

/** The unit vectors the eye moves along: forward (with the pitch), right (level). */
export function axesOf(yaw: number, pitch: number): { forward: [number, number, number]; right: [number, number, number] } {
  const y = (yaw * Math.PI) / 180, p = (pitch * Math.PI) / 180;
  return { forward: [-Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p)], right: [Math.cos(y), 0, -Math.sin(y)] };
}

/**
 * Advances the flight by exactly dt seconds, in equal steps no longer than FLIGHT.step. Not a fixed
 * step with the remainder carried: the frame is drawn straight after, so the eye must have moved by
 * this frame's time and no other. (A fixed 1/120 s step under a 60 Hz frame took one step in one
 * frame and three in the next whenever the frame's length wobbled round 1/60 s: the eye moved in
 * uneven jerks at a perfectly steady frame rate, and worse on a 120 Hz screen.)
 */
export function stepFlight(map: SolidMap, f: FlightState, input: FlightInput, dt: number): void {
  const t = Math.min(FLIGHT.maxFrame, Math.max(0, dt));
  if (t <= 0) return;
  const n = Math.ceil(t / FLIGHT.step - 1e-9);
  for (let i = 0; i < n; i++) tick(map, f, input, t / n);
}

function tick(map: SolidMap, f: FlightState, input: FlightInput, dt: number): void {
  const { forward, right } = axesOf(f.yaw, f.pitch);
  const want = [0, 1, 2].map((a) => forward[a]! * input.forward + right[a]! * input.strafe + (a === 1 ? input.rise : 0));
  const len = Math.hypot(want[0]!, want[1]!, want[2]!);
  const top = FLIGHT.speed * f.scale;
  const k = 1 - Math.exp(-FLIGHT.accel * dt);
  for (let a = 0; a < 3; a++) {
    const goal = len > 1e-9 ? (want[a]! / Math.max(1, len)) * top : 0;
    f.vel[a] = f.vel[a]! + (goal - f.vel[a]!) * k;
    if (len <= 1e-9 && Math.abs(f.vel[a]!) < 0.01) f.vel[a] = 0;
  }
  // Somewhere it should not be already (the town changed round it): it may move freely until clear.
  const free = !clearAt(map, f.eye);
  for (const a of [1, 0, 2]) {
    const v = f.vel[a]!;
    if (v === 0) continue;
    const was = f.eye[a]!;
    let next = was + v * dt;
    // The box: never farther out than it already is.
    const lo = f.box.lo[a]!, hi = f.box.hi[a]!;
    if (next < lo && next < was) next = Math.max(next, Math.min(was, lo));
    if (next > hi && next > was) next = Math.min(next, Math.max(was, hi));
    f.eye[a] = next;
    if (!free && !clearAt(map, f.eye)) {
      // Blocked on this axis: as close as it can come, and that part of the speed is gone (it slides).
      let ok = was, bad = next;
      for (let i = 0; i < 8; i++) {
        const mid = (ok + bad) / 2;
        f.eye[a] = mid;
        if (clearAt(map, f.eye)) ok = mid;
        else bad = mid;
      }
      f.eye[a] = ok;
      f.vel[a] = 0;
    } else if (f.eye[a] !== was + v * dt) f.vel[a] = 0;
  }
  // The box narrows as the eye comes in, so once over the map it stays over it.
  const home = flightBox(map);
  for (let a = 0; a < 3; a++) {
    f.box.lo[a] = Math.min(Math.max(f.box.lo[a]!, Math.min(home.lo[a]!, f.eye[a]!)), home.lo[a]!);
    f.box.hi[a] = Math.max(Math.min(f.box.hi[a]!, Math.max(home.hi[a]!, f.eye[a]!)), home.hi[a]!);
  }
}
