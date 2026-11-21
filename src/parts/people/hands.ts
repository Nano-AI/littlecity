// Hands on what they hold (People; the owner's bug: "the broom's not in her
// hands"). Pure.
//
// A held thing is placed first and the arms are posed to it, never the other
// way round:
//
//   long tools (broom, scythe, fishing rod) lie along a line in the
//   figure's own frame (origin at the feet, +Y up, +Z forward, not leaning
//   with the body): from a point on the ground or the water to a point in
//   front of the chest. Each hand goes to where that line passes at arm's
//   length from its shoulder; the tool's matrix is built along the line.
//   loads (sacks, baskets, the tray, the yoke, the handcart...) sit in the
//   body's frame (loads.ts); each hand goes to the grip point the load's way
//   of being carried names.
//   small tools (the lamplighter's pole, a hammer, the watering can) hang
//   from the hand itself: they ride on the arm piece, so they cannot drift.
//
// The arm is one rigid piece from the shoulder to the middle of the hand,
// HAND_REACH long; aimArm turns it to point at a target (the hand lands on
// the target when it is in reach, and as near as it can get when not).

import type { Vec3 } from '@/core/mat4';
import type { Hold, Load } from './loads';
import type { Rig } from './person';
import type { Pose } from './pose';

/** From the shoulder to the middle of the hand, figure units (the arm is rig.arm long, the hand its last 0.03). */
export function handReach(rig: Rig): number {
  return rig.arm - 0.015;
}

export function shoulderOf(rig: Rig, side: 1 | -1): Vec3 {
  return [side * rig.shoulderX, rig.shoulderY, 0];
}

/** The body piece's matrix pieces for a pose (as rigMatrices builds it): its three axes and translation. */
function bodyFrame(pose: Pose, rig: Rig): { x: Vec3; y: Vec3; z: Vec3; t: Vec3 } {
  const cl = Math.cos(pose.lean), sl = Math.sin(pose.lean);
  const ct = Math.cos(pose.twist), st = Math.sin(pose.twist);
  const x: Vec3 = [ct, 0, -st], y: Vec3 = [st * sl, cl, ct * sl], z: Vec3 = [st * cl, -sl, ct * cl];
  const t: Vec3 = [-rig.hipY * y[0], rig.hipY + pose.lift - rig.hipY * y[1], -rig.hipY * y[2]];
  return { x, y, z, t };
}

/** A point of the body's own frame in the figure's frame. */
export function bodyToFigure(p: Vec3, pose: Pose, rig: Rig): Vec3 {
  const { x, y, z, t } = bodyFrame(pose, rig);
  return [x[0] * p[0] + y[0] * p[1] + z[0] * p[2] + t[0], x[1] * p[0] + y[1] * p[1] + z[1] * p[2] + t[1], x[2] * p[0] + y[2] * p[1] + z[2] * p[2] + t[2]];
}

/** A point of the figure's frame in the body's own frame (the body's matrix is a rotation and a move). */
export function figureToBody(p: Vec3, pose: Pose, rig: Rig): Vec3 {
  const { x, y, z, t } = bodyFrame(pose, rig);
  const d: Vec3 = [p[0] - t[0], p[1] - t[1], p[2] - t[2]];
  return [x[0] * d[0] + x[1] * d[1] + x[2] * d[2], y[0] * d[0] + y[1] * d[1] + y[2] * d[2], z[0] * d[0] + z[1] * d[1] + z[2] * d[2]];
}

/**
 * Turns an arm to point its hand at a target in the body's frame, writing the pose's swing and spread for that side.
 * The limb is Rz(spread)·Rx(−swing)·(0, −1, 0) = (cos s·sin o, −cos s·cos o, sin s); the left arm's spread is −outL.
 */
export function aimArm(pose: Pose, rig: Rig, side: 1 | -1, target: Vec3): void {
  const sh = shoulderOf(rig, side);
  const dx = target[0] - sh[0], dy = target[1] - sh[1], dz = target[2] - sh[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  const swing = Math.asin(Math.max(-1, Math.min(1, dz / len)));
  const spread = Math.atan2(dx / len, -dy / len);
  if (side > 0) {
    pose.armR = swing;
    pose.outR = spread;
  } else {
    pose.armL = swing;
    pose.outL = -spread;
  }
}

/** Where the hand of an arm is, in the body's frame, for the pose as it stands. */
export function handOf(pose: Pose, rig: Rig, side: 1 | -1): Vec3 {
  const s = side > 0 ? pose.armR : pose.armL;
  const o = side > 0 ? pose.outR : -pose.outL;
  const h = handReach(rig), sh = shoulderOf(rig, side);
  return [sh[0] + h * Math.cos(s) * Math.sin(o), sh[1] - h * Math.cos(s) * Math.cos(o), sh[2] + h * Math.sin(s)];
}

/**
 * Where a line meets the sphere of an arm's reach: the parameter t along `a + t·(b − a)` (body frame), the
 * crossing nearest `prefer` (0 = a, 1 = b); with no crossing, the point of the line nearest the shoulder.
 */
function onLine(a: Vec3, b: Vec3, centre: Vec3, r: number, prefer: number): number {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const f: Vec3 = [a[0] - centre[0], a[1] - centre[1], a[2] - centre[2]];
  const A = d[0] * d[0] + d[1] * d[1] + d[2] * d[2], B = 2 * (f[0] * d[0] + f[1] * d[1] + f[2] * d[2]), C = f[0] * f[0] + f[1] * f[1] + f[2] * f[2] - r * r;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return -B / (2 * A);
  const t1 = (-B - Math.sqrt(disc)) / (2 * A), t2 = (-B + Math.sqrt(disc)) / (2 * A);
  return Math.abs(t1 - prefer) < Math.abs(t2 - prefer) ? t1 : t2;
}

export interface LongTool {
  /** The tool's matrix in the figure's frame: origin at its working end (`from`), +Y along it toward the hands. */
  m: number[];
  /** Where each hand should be, in the figure's frame (for tests). */
  gripR: Vec3;
  gripL: Vec3;
}

/**
 * A long tool held in both hands along the line from `from` (its working end, figure frame) toward `to`: the
 * arms are posed onto the line (the right hand the higher, the left lower) and the tool's matrix returned.
 */
export function holdLong(pose: Pose, rig: Rig, from: Vec3, to: Vec3): LongTool {
  const a = figureToBody(from, pose, rig), b = figureToBody(to, pose, rig);
  const h = handReach(rig);
  const tR = onLine(a, b, shoulderOf(rig, 1), h, 1);
  let tL = onLine(a, b, shoulderOf(rig, -1), h, 0);
  // The left hand below the right on the shaft (where both can be), a hand's width apart at least.
  if (tL > tR - 0.12) tL = onLine(a, b, shoulderOf(rig, -1), h, -1);
  const at = (t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  aimArm(pose, rig, 1, at(tR));
  aimArm(pose, rig, -1, at(tL));
  // The tool along the line, from its working end.
  const y = norm([to[0] - from[0], to[1] - from[1], to[2] - from[2]]);
  let x = norm(cross(y, [0, 0, 1]));
  if (!Number.isFinite(x[0])) x = [1, 0, 0];
  const z = cross(x, y);
  return {
    m: [x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, from[0], from[1], from[2], 1],
    gripR: bodyToFigure(at(tR), pose, rig),
    gripL: bodyToFigure(at(tL), pose, rig),
  };
}

const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
};

/**
 * The line a long tool lies along in a pose, figure frame: [working end, toward the hands]. `phase` is seconds
 * in the pose (the strokes are drawn on twos from it).
 */
export function longToolLine(tool: 'broom' | 'scythe' | 'rod', pose: Pose): [Vec3, Vec3] {
  switch (tool) {
    case 'broom': {
      // The bristles on the ground ahead, swept side to side as the body twists into each stroke.
      const sw = pose.twist;
      return [[sw * 0.2, 0.01, 0.25], [sw * 0.05, 0.3, 0.02]];
    }
    case 'scythe': {
      // The blade's heel low to the ground ahead and to the swing's side; the snath up to the chest.
      const sw = pose.twist;
      return [[sw * 0.35 - 0.04, 0.03, 0.26], [0.02, 0.29, 0.03]];
    }
    case 'rod':
      // The butt at the chest (where both hands can hold it), the rod out and up over the water.
      return [[0, 0.24, 0.02], [0, 0.49, 0.46]];
  }
}

/**
 * Where the hands go for a load carried a given way (body frame), or null for a hand that is free. `at` is the
 * load's hold anchor (holdAnchor in loads.ts). Every grip is within arm's reach of its shoulder (hands.test.ts).
 */
export function loadGrips(hold: Hold, at: Vec3): { R: Vec3 | null; L: Vec3 | null } {
  const [x, y, z] = at;
  switch (hold) {
    case 'shoulder':
      // A hand up on its front, steadying it on the shoulder.
      return { R: [0.07, 0.335, 0.03], L: null };
    case 'shoulderL':
      return { R: null, L: [-0.07, 0.335, 0.03] };
    case 'head':
      // Balanced on the head, both hands free (the arms are too short to reach a basket up there).
      return { R: null, L: null };
    case 'high':
      // On the flat of the hand, up at the shoulder.
      return { R: [x - 0.005, y - 0.008, z - 0.01], L: null };
    case 'yoke':
      // Both hands on the yoke beside the neck.
      return { R: [0.145, 0.285, 0.035], L: [-0.145, 0.285, 0.035] };
    case 'side':
      // The fish's string in the right hand at the side.
      return { R: [0.115, 0.18, 0.03], L: null };
    case 'chest':
      // Both hands at the load, either side of it.
      return { R: [x + 0.04, y + 0.02, z - 0.01], L: [x - 0.04, y + 0.02, z - 0.01] };
    case 'pole':
      // The lantern's pole in the right hand, at its foot.
      return { R: [x, y - 0.17, z], L: null };
    case 'push':
      // The handcart's two handles, ahead at hip height.
      return { R: [0.104, 0.184, 0.06], L: [-0.104, 0.184, 0.06] };
  }
}

/** What a figure has in its hands this drawing. */
export interface Holding {
  /** The tool its pose works with (people.system's toolOf), if any. */
  tool: string | null;
  /** The load in its hands, if it is held, how it is carried, and where (holdAnchor in loads.ts). */
  load: Load | null;
  hold: Hold | null;
  anchor: Vec3 | null;
}

/**
 * Tools drawn on the body piece along a shaft in the right hand (body frame, as extras.ts draws them): the
 * L36 soldier's pike and sentry's torch, the L37 rider's lance. [foot, top] of the shaft.
 */
export const SHAFTS: Readonly<Record<string, [Vec3, Vec3]>> = {
  pike: [[0.085, 0.0, 0.05], [0.085, 0.66, 0.05]],
  torch: [[0.085, 0.12, 0.07], [0.085, 0.32, 0.09]],
  lance: [[0.09, 0.06, 0.06], [0.09, 0.8, 0.07]],
};

/** Where the right hand closes on a shaft: where the shaft passes at arm's length, the lower crossing. */
export function shaftGrip(rig: Rig, [a, b]: [Vec3, Vec3]): Vec3 {
  const t = Math.max(0, Math.min(1, onLine(a, b, shoulderOf(rig, 1), handReach(rig), 0)));
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * L56: the juggler's hands under the balls (extras.ts draws the balls over them, body frame): in each drawing
 * one hand is up, throwing, and the other down, catching. [right, left].
 */
export const JUGGLE: Readonly<Record<string, [Vec3, Vec3]>> = {
  'balls-a': [[0.045, 0.29, 0.085], [-0.045, 0.25, 0.085]],
  'balls-b': [[0.045, 0.25, 0.085], [-0.045, 0.29, 0.085]],
};

/** Tools held at the chest in both arms (the L23 miller's sack, the baker's tray): where the hands go. */
export const CHEST_TOOLS: Readonly<Record<string, [Vec3, Vec3]>> = {
  sack: [[0.05, 0.2, 0.085], [-0.05, 0.2, 0.085]],
  tray: [[0.06, 0.18, 0.07], [-0.06, 0.18, 0.07]],
  // L63: a book held open, reading in a deckchair (beach.ts BOOK_GRIPS).
  book: [[0.045, 0.205, 0.072], [-0.045, 0.205, 0.072]],
};

/**
 * Poses the arms onto what is held, and returns the matrix (figure frame) of a long tool held in both hands, or
 * null when the thing rides on a piece of the figure (a small tool in a hand, a load on the body).
 */
export function applyHold(pose: Pose, rig: Rig, h: Holding): number[] | null {
  const shaft = h.tool ? SHAFTS[h.tool] : undefined;
  if (shaft) {
    aimArm(pose, rig, 1, shaftGrip(rig, shaft));
    return null;
  }
  const balls = h.tool ? JUGGLE[h.tool] : undefined;
  if (balls) {
    aimArm(pose, rig, 1, balls[0]);
    aimArm(pose, rig, -1, balls[1]);
    return null;
  }
  if (h.tool === 'broom' || h.tool === 'scythe' || h.tool === 'rod') {
    const [from, to] = longToolLine(h.tool, pose);
    const held = holdLong(pose, rig, from, to);
    // The rod is drawn in the figure's frame along its line (with its line hanging from the tip).
    return h.tool === 'rod' ? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] : held.m;
  }
  const chest = h.tool ? CHEST_TOOLS[h.tool] : undefined;
  if (chest) {
    aimArm(pose, rig, 1, chest[0]);
    aimArm(pose, rig, -1, chest[1]);
    return null;
  }
  if (h.load && h.hold && h.anchor) {
    const g = loadGrips(h.hold, h.anchor);
    if (g.R) aimArm(pose, rig, 1, g.R);
    if (g.L) aimArm(pose, rig, -1, g.L);
  }
  return null;
}
