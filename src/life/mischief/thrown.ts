// A thrown body (design section 13b, "blown about"; the Hand). Owner:
// Mischief. Pure: time comes from `step`, chance from the body's seed.
//
// Physics-flavoured animation, not a physics engine: one small integrator
// per body (a point with a velocity, a turn with a spin, gravity), checked
// against the solid map of the town (ground.ts) a few times a frame:
//
//   fly     a ballistic arc, tumbling. Into a wall: it stops dead against
//           it and slides down. Onto the ground: a bounce or two, then
//   roll    along the ground, slowing, turning over onto its back; off an
//           edge (a cliff, a roof's eaves) it is flying again.
//   lie     flat on its back where it stopped, dizzy for a few seconds.
//   roof    the same on a roof, then it
//   slide   slides down the slope and drops off the edge (fly again).
//   swim    in the water (the sea, off the map's edge): it swims to the
//           goal its owner gives it (a quay, a beach), then
//   climb   hops up out of the water onto it.
//   up      getting up (its owner draws the steps: sit up, shake the head,
//           stand, dust off, look about).
//   walk    to the goal its owner gives it (a walkable spot), then
//   done    its owner puts it back where it lives.
//   held    the Hand has it: it is where the Hand says, wriggling.
//
// While flying, (x, y, z) is the body's middle (its pivot) and `q` its turn;
// once it is on the ground, (x, y, z) is where its feet are and it lies or
// stands upright (`upright`). Nothing here knows what the body is: a person,
// a dog, a sheep, a boat. Its owner (thrower.ts) draws it and decides.

import { SEA_Y } from '@/core/grid';
import { rand } from '@/core/rand';
import type { Ground, Surface } from './ground';

export const THROWN = {
  /** Gravity, world units a second squared (a cartoon's: a little heavier than the town's scale would say). */
  gravity: 13,
  /** A landing faster than this (downward, units a second) bounces; at most this many times. */
  bounceAt: 2.2,
  bounces: 2,
  /** What a bounce keeps of the speed: up, along. */
  bounceUp: 0.36,
  bounceAlong: 0.55,
  /** Rolling: how fast it slows (per second), and when it has stopped. */
  rollDrag: 5,
  rollStop: 0.25,
  /** Sliding off a roof: how fast. */
  slide: 1.4,
  /** Swimming and walking speeds (units a second). */
  swim: 0.55,
  walk: 0.65,
  /** Where a swimmer's feet are below the water's surface. */
  wade: 0.24,
  /** Seconds to hop up out of the water. */
  climb: 0.45,
  /** Off the map: how far out a body may fly before the sea stops it. */
  margin: 1.2,
  /** The longest step of the integrator (seconds). */
  substep: 1 / 90,
} as const;

export type Phase = 'held' | 'fly' | 'roll' | 'lie' | 'roof' | 'slide' | 'swim' | 'climb' | 'up' | 'walk' | 'done';

/** What happened in a step that the owner may want to show or answer. */
export type BodyEvent = 'bounce' | 'land' | 'splash' | 'wall' | 'roof' | 'offRoof' | 'ashore' | 'arrived' | null;

export interface Body {
  readonly seed: number;
  /** Where it is (see the top of the file), and how fast it goes. */
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Its turn (a unit quaternion x, y, z, w) and its spin (radians a second about world axes). */
  q: Float64Array;
  wx: number;
  wy: number;
  wz: number;
  /** Height of its middle above its feet (world units) and how far its outline reaches from the middle when it lands. */
  pivot: number;
  radius: number;
  phase: Phase;
  /** Seconds in this phase, and since it was thrown. */
  t: number;
  age: number;
  /** On the ground (lying, getting up, walking, swimming): (x, y, z) is its feet, drawn upright, facing `heading`. */
  upright: boolean;
  heading: number;
  /** Seconds it lies dizzy once it stops; seconds its getting up takes. */
  dizzy: number;
  rise: number;
  bounces: number;
  /** Where it walks or swims to next, set by its owner. */
  goal: { x: number; y: number; z: number } | null;
  /** It has been in the water (it swims, then climbs out). */
  wet: boolean;
  /** Seconds left of a splat against a wall (drawn flat to it). */
  splat: number;
  /** For the hop out of the water: where from. */
  from: { x: number; y: number; z: number } | null;
}

export function makeBody(seed: number, x: number, y: number, z: number, heading: number, pivot: number, radius: number): Body {
  const q = new Float64Array(4);
  q[1] = Math.sin(heading / 2);
  q[3] = Math.cos(heading / 2);
  return {
    seed, x, y, z, vx: 0, vy: 0, vz: 0, q, wx: 0, wy: 0, wz: 0, pivot, radius,
    phase: 'held', t: 0, age: 0, upright: true, heading, dizzy: 3, rise: 3, bounces: 0, goal: null, wet: false, splat: 0, from: null,
  };
}

/**
 * Sends a body flying with this velocity, tumbling: head over heels backward (the way a push off the feet
 * turns a figure), `spin` radians a second, with a little twist. From standing, it leaves from its middle.
 */
export function launch(b: Body, vx: number, vy: number, vz: number, spin: number): void {
  if (b.upright) {
    b.y += b.pivot;
    b.upright = false;
    setQuatYaw(b.q, b.heading);
  }
  b.vx = vx;
  b.vy = vy;
  b.vz = vz;
  const h = Math.hypot(vx, vz);
  // About the horizontal axis across the way it goes: the feet go forward, the head back.
  const ax = h > 1e-3 ? vz / h : 1, az = h > 1e-3 ? -vx / h : 0;
  const twist = (rand(b.seed, 'twist', b.age) - 0.5) * 4;
  b.wx = ax * -spin + (h > 1e-3 ? (vx / h) * twist * 0.5 : 0);
  b.wy = (rand(b.seed, 'yaw-spin', b.age) - 0.5) * 3;
  b.wz = az * -spin + (h > 1e-3 ? (vz / h) * twist * 0.5 : 0);
  b.phase = 'fly';
  b.t = 0;
  b.bounces = 0;
  b.splat = 0;
  b.goal = null;
}

/** The Hand has it (or lets it go: `launch`). It is held by its middle, upright, hanging. */
export function hold(b: Body): void {
  if (b.upright) {
    b.y += b.pivot;
    b.upright = false;
  }
  setQuatYaw(b.q, b.heading);
  b.vx = b.vy = b.vz = 0;
  b.wx = b.wy = b.wz = 0;
  b.phase = 'held';
  b.t = 0;
  b.goal = null;
  b.wet = false;
}

const surf: Surface = { h: 0, water: false, roof: false };

/** One step of a body's life. Returns what happened that its owner may want to answer (one thing a step). */
export function stepBody(b: Body, dt: number, ground: Ground): BodyEvent {
  b.t += dt;
  b.age += dt;
  switch (b.phase) {
    case 'held':
      return null;
    case 'fly': {
      let ev: BodyEvent = null;
      const n = Math.max(1, Math.ceil(dt / THROWN.substep));
      const h = dt / n;
      for (let i = 0; i < n && b.phase === 'fly'; i++) ev = flyStep(b, h, ground) ?? ev;
      return ev;
    }
    case 'roll':
      return roll(b, dt, ground);
    case 'lie':
      if (popOut(b, ground)) return null;
      if (b.t >= b.dizzy) next(b, 'up');
      return null;
    case 'roof':
      if (b.t >= b.dizzy) next(b, 'slide');
      return null;
    case 'slide':
      return slide(b, dt, ground);
    case 'swim':
      return swim(b, dt, ground);
    case 'climb': {
      const f = b.from!, g = b.goal!;
      const u = Math.min(1, b.t / THROWN.climb);
      b.x = f.x + (g.x - f.x) * u;
      b.z = f.z + (g.z - f.z) * u;
      b.y = f.y + (g.y - f.y) * u + Math.sin(u * Math.PI) * 0.25;
      if (u < 1) return null;
      b.wet = false;
      b.goal = null;
      b.from = null;
      next(b, 'up');
      return 'ashore';
    }
    case 'up':
      if (popOut(b, ground)) return null;
      if (b.t >= b.rise) next(b, 'walk');
      return null;
    case 'walk':
      popOut(b, ground);
      return walk(b, dt, ground);
    case 'done':
      return null;
  }
}

function next(b: Body, phase: Phase): void {
  b.phase = phase;
  b.t = 0;
}

/** One substep in the air. */
function flyStep(b: Body, h: number, ground: Ground): BodyEvent {
  let ev: BodyEvent = null;
  b.vy -= THROWN.gravity * h;
  integrateSpin(b, h);
  if (b.splat > 0) b.splat -= h;
  const foot = b.y - b.radius;
  // Sideways: into a wall it stops dead and slides down it.
  let nx = b.x + b.vx * h, nz = b.z + b.vz * h;
  const probe = foot + 0.04;
  if (ground.blocked(nx, probe, b.z) && !ground.blocked(b.x, probe, b.z)) {
    b.vx *= -0.15;
    nx = b.x;
    b.splat = 0.35;
    b.wx *= 0.3;
    b.wy *= 0.3;
    b.wz *= 0.3;
    ev = 'wall';
  }
  if (ground.blocked(nx, probe, nz) && !ground.blocked(nx, probe, b.z)) {
    b.vz *= -0.15;
    nz = b.z;
    b.splat = 0.35;
    b.wx *= 0.3;
    b.wy *= 0.3;
    b.wz *= 0.3;
    ev = 'wall';
  }
  // The sea stops anything flying off the map, a little way out.
  const lo = -THROWN.margin, hi = 48 + THROWN.margin;
  if (nx < lo || nx > hi) {
    nx = Math.max(lo, Math.min(hi, nx));
    b.vx = 0;
  }
  if (nz < lo || nz > hi) {
    nz = Math.max(lo, Math.min(hi, nz));
    b.vz = 0;
  }
  b.x = nx;
  b.z = nz;
  // Down: onto whatever is under it now.
  ground.surface(b.x, b.z, foot + 0.06, surf);
  // In something (the ground came up under it, a step it stood on): out on top, if that is a step up.
  if (ground.blocked(b.x, foot + 0.02, b.z)) {
    const up = ground.freeAbove(b.x, foot + 0.02, b.z);
    if (up - foot < 0.9) b.y = up + b.radius;
  }
  b.y += b.vy * h;
  if (b.y - b.radius > surf.h || b.vy > 0) return ev;
  // It has come down.
  if (surf.water) {
    b.y = SEA_Y - THROWN.wade;
    b.upright = true;
    b.heading = Math.atan2(b.vx, b.vz);
    b.vx = b.vy = b.vz = 0;
    b.wet = true;
    next(b, 'swim');
    return 'splash';
  }
  b.y = surf.h + b.radius;
  if (-b.vy > THROWN.bounceAt && b.bounces < THROWN.bounces) {
    b.bounces++;
    b.vy = -b.vy * THROWN.bounceUp;
    b.vx *= THROWN.bounceAlong;
    b.vz *= THROWN.bounceAlong;
    b.wx *= 0.6;
    b.wy *= 0.6;
    b.wz *= 0.6;
    return 'bounce';
  }
  b.vy = 0;
  b.vx *= 0.8;
  b.vz *= 0.8;
  const sp = Math.hypot(b.vx, b.vz);
  // It lands on its back, its head toward where it came from.
  b.heading = sp > 0.05 ? Math.atan2(b.vx, b.vz) : yawOfQuat(b.q);
  next(b, 'roll');
  return surf.roof ? 'roof' : 'land';
}

/** Rolling to a stop along the ground, turning over onto the back. */
function roll(b: Body, dt: number, ground: Ground): BodyEvent {
  const k = Math.exp(-THROWN.rollDrag * dt);
  b.vx *= k;
  b.vz *= k;
  const nx = b.x + b.vx * dt, nz = b.z + b.vz * dt;
  const foot = b.y - b.radius;
  if (!ground.blocked(nx, foot + 0.04, b.z)) b.x = nx;
  else b.vx = 0;
  if (!ground.blocked(b.x, foot + 0.04, nz)) b.z = nz;
  else b.vz = 0;
  ground.surface(b.x, b.z, foot + 0.3, surf);
  if (surf.h < foot - 0.25 || (surf.water && surf.h < foot - 0.05)) {
    // Over the edge: falling again.
    b.vy = 0;
    b.phase = 'fly';
    b.t = 0;
    b.bounces = THROWN.bounces - 1;
    return 'offRoof';
  }
  b.y = surf.h + b.radius;
  // Over onto the back: the turn eases to lying flat, head back toward where it came from.
  const target = lyingQuat(b.heading);
  slerpTo(b.q, target, Math.min(1, dt * 7));
  b.wx = b.wy = b.wz = 0;
  if (Math.hypot(b.vx, b.vz) > THROWN.rollStop || b.t < 0.3) return null;
  // Flat: on its feet's frame from now (lying is drawn upright with a lying pose).
  copyQuat(b.q, target);
  b.y = surf.h;
  b.upright = true;
  b.vx = b.vz = 0;
  next(b, surf.roof ? 'roof' : 'lie');
  return null;
}

/** Off a roof: down the slope to the eaves, and over. */
function slide(b: Body, dt: number, ground: Ground): BodyEvent {
  if (!b.goal) {
    // Which way is down: the nearest side where the roof ends (a lower column), else away from the cell's middle.
    let best = -1, bestD = Infinity;
    const here = b.y;
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      const dx = Math.sin(ang), dz = Math.cos(ang);
      for (let d = 0.3; d <= 3; d += 0.3) {
        ground.surface(b.x + dx * d, b.z + dz * d, here + 0.1, surf);
        if (surf.h < here - 0.45 || surf.water) {
          if (d < bestD) {
            bestD = d;
            best = ang;
          }
          break;
        }
      }
    }
    const ang = best >= 0 ? best : Math.atan2(b.x - Math.floor(b.x) - 0.5, b.z - Math.floor(b.z) - 0.5);
    b.goal = { x: Math.sin(ang), y: 0, z: Math.cos(ang) };
    b.heading = ang + Math.PI; // feet first
  }
  const g = b.goal;
  const v = Math.min(THROWN.slide, b.t * 3);
  const nx = b.x + g.x * v * dt, nz = b.z + g.z * v * dt;
  ground.surface(nx, nz, b.y + 0.3, surf);
  if (surf.h < b.y - 0.15 || ground.blocked(nx, b.y + 0.05, nz)) {
    // Over the eaves.
    b.goal = null;
    b.x = nx;
    b.z = nz;
    b.y += b.pivot;
    b.upright = false;
    setQuatYaw(b.q, b.heading);
    const lie = lyingQuat(b.heading);
    copyQuat(b.q, lie);
    b.vx = g.x * Math.max(0.8, v);
    b.vz = g.z * Math.max(0.8, v);
    b.vy = 0.4;
    b.wx = g.z * 3;
    b.wz = -g.x * 3;
    b.wy = 0;
    b.dizzy = 0.6;
    b.bounces = THROWN.bounces - 1;
    next(b, 'fly');
    return 'offRoof';
  }
  b.x = nx;
  b.z = nz;
  b.y = surf.h;
  return null;
}

function swim(b: Body, dt: number, ground: Ground): BodyEvent {
  b.y = SEA_Y - THROWN.wade;
  const g = b.goal;
  if (!g || b.t < 0.6) return null;
  const dx = g.x - b.x, dz = g.z - b.z, d = Math.hypot(dx, dz);
  b.heading = Math.atan2(dx, dz);
  const step = Math.min(d, THROWN.swim * dt);
  const nx = b.x + (dx / (d || 1)) * step, nz = b.z + (dz / (d || 1)) * step;
  // Out at the first dry footing on the way (a beach, a quay's side), or at the goal.
  const dry = !ground.wet(nx, nz);
  if (dry || d < 0.05) {
    b.from = { x: b.x, y: b.y, z: b.z };
    ground.surface(g.x, g.z, g.y + 0.3, surf);
    b.goal = { x: g.x, y: surf.water ? g.y : surf.h, z: g.z };
    next(b, 'climb');
    return null;
  }
  b.x = nx;
  b.z = nz;
  return null;
}

function walk(b: Body, dt: number, ground: Ground): BodyEvent {
  const g = b.goal;
  if (!g) return null;
  const dx = g.x - b.x, dz = g.z - b.z, d = Math.hypot(dx, dz);
  // There (or as near as the ground lets them come; or far too long on the way: put there).
  if ((d < 0.02 && (Math.abs(g.y - b.y) < 0.05 || b.t > 6)) || b.t > 15) {
    b.x = g.x;
    b.z = g.z;
    b.y = g.y;
    next(b, 'done');
    return 'arrived';
  }
  if (d >= 0.02) {
    b.heading = Math.atan2(dx, dz);
    const step = Math.min(d, THROWN.walk * dt);
    const nx = b.x + (dx / d) * step, nz = b.z + (dz / d) * step;
    // Never into a wall: along it if it can, else they wait there (and are put on their way in the end).
    const y = b.y + 0.08;
    if (!ground.blocked(nx, y, nz)) {
      b.x = nx;
      b.z = nz;
    } else if (!ground.blocked(nx, y, b.z)) b.x = nx;
    else if (!ground.blocked(b.x, y, nz)) b.z = nz;
  }
  // On the ground under them: up a step at a time, never into it; off a ledge (a stall, a wall), a drop.
  ground.surface(b.x, b.z, b.y + 0.4, surf);
  const left = Math.hypot(g.x - b.x, g.z - b.z);
  let to = surf.water ? g.y : surf.h;
  if (left < 0.3) to = Math.max(to, g.y);
  if (to < b.y - 0.3 && left >= 0.3) {
    drop(b, dx / (d || 1), dz / (d || 1));
    return null;
  }
  const most = 2.5 * dt;
  b.y += Math.max(-most, Math.min(most, to - b.y));
  return null;
}

/** Walked off a ledge: falling (a short fall: they are only a little dizzy after). */
function drop(b: Body, dx: number, dz: number): void {
  b.y += b.pivot;
  b.upright = false;
  setQuatYaw(b.q, b.heading);
  b.vx = dx * THROWN.walk;
  b.vz = dz * THROWN.walk;
  b.vy = 0.6;
  b.wx = dz * 2;
  b.wz = -dx * 2;
  b.wy = 0;
  b.dizzy = 0.4;
  b.rise = Math.min(b.rise, 1.2);
  b.bounces = THROWN.bounces;
  b.goal = null;
  next(b, 'fly');
}

/**
 * Something came up round a body on the ground (a building mended over where it lies): it is put on top
 * (and from a roof it slides off). True if it was.
 */
function popOut(b: Body, ground: Ground): boolean {
  if (!ground.blocked(b.x, b.y + 0.06, b.z)) return false;
  ground.surface(b.x, b.z, Infinity, surf);
  b.y = surf.h;
  if (surf.roof) next(b, 'slide');
  return true;
}

// ── turns ─────────────────────────────────────────────────────────────────

function integrateSpin(b: Body, h: number): void {
  const q = b.q;
  const wx = b.wx, wy = b.wy, wz = b.wz;
  if (wx === 0 && wy === 0 && wz === 0) return;
  // q' = q + h/2 · (w, 0) ⊗ q
  const x = q[0]!, y = q[1]!, z = q[2]!, w = q[3]!;
  const k = h * 0.5;
  q[0] = x + k * (wx * w + wy * z - wz * y);
  q[1] = y + k * (wy * w + wz * x - wx * z);
  q[2] = z + k * (wz * w + wx * y - wy * x);
  q[3] = w + k * (-wx * x - wy * y - wz * z);
  normalize(q);
}

function normalize(q: Float64Array): void {
  const l = Math.hypot(q[0]!, q[1]!, q[2]!, q[3]!) || 1;
  q[0]! /= l;
  q[1]! /= l;
  q[2]! /= l;
  q[3]! /= l;
}

export function setQuatYaw(q: Float64Array, yaw: number): void {
  q[0] = 0;
  q[1] = Math.sin(yaw / 2);
  q[2] = 0;
  q[3] = Math.cos(yaw / 2);
}

function copyQuat(q: Float64Array, from: Float64Array): void {
  q[0] = from[0]!;
  q[1] = from[1]!;
  q[2] = from[2]!;
  q[3] = from[3]!;
}

const lieQ = new Float64Array(4);
/** Lying on the back, the feet toward `heading`: Ry(heading) · Rx(−π/2). */
export function lyingQuat(heading: number): Float64Array {
  const cy = Math.cos(heading / 2), sy = Math.sin(heading / 2);
  const cx = Math.cos(-Math.PI / 4), sx = Math.sin(-Math.PI / 4);
  // (0, sy, 0, cy) ⊗ (sx, 0, 0, cx)
  lieQ[0] = cy * sx;
  lieQ[1] = sy * cx;
  lieQ[2] = -sy * sx;
  lieQ[3] = cy * cx;
  return lieQ;
}

function slerpTo(q: Float64Array, to: Float64Array, u: number): void {
  const dot = q[0]! * to[0]! + q[1]! * to[1]! + q[2]! * to[2]! + q[3]! * to[3]!;
  const s = dot < 0 ? -1 : 1;
  // Near enough for a straight blend, normalised (the steps are small).
  for (let i = 0; i < 4; i++) q[i] = q[i]! + (to[i]! * s - q[i]!) * u;
  normalize(q);
}

/** The yaw of a turn's forward axis (+Z) on the ground. */
export function yawOfQuat(q: Float64Array): number {
  const x = q[0]!, y = q[1]!, z = q[2]!, w = q[3]!;
  // R · (0, 0, 1)
  const fx = 2 * (x * z + w * y), fz = 1 - 2 * (x * x + y * y);
  return Math.atan2(fx, fz);
}

/** The turn as a 3×3 matrix, column-major, into `out`. */
export function quatToMat3(q: Float64Array, out: Float32Array): Float32Array {
  const x = q[0]!, y = q[1]!, z = q[2]!, w = q[3]!;
  out[0] = 1 - 2 * (y * y + z * z);
  out[1] = 2 * (x * y + w * z);
  out[2] = 2 * (x * z - w * y);
  out[3] = 2 * (x * y - w * z);
  out[4] = 1 - 2 * (x * x + z * z);
  out[5] = 2 * (y * z + w * x);
  out[6] = 2 * (x * z + w * y);
  out[7] = 2 * (y * z - w * x);
  out[8] = 1 - 2 * (x * x + y * y);
  return out;
}
