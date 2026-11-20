// Poses for the little person (People, Stage 3). Pure.
//
// A pose is a handful of joint angles; `rigMatrices` turns it into one local
// matrix per piece (PIECES order: body, legL, legR, armL, armR) in the
// figure's own frame (origin at the feet, +Y up, facing +Z).
//
// The motion style is "on twos": poses are HELD, not blended. A walk is four
// drawings a stride (contact, passing, contact, passing), an idle changes
// drawing a few times a second. The figure's place in the world moves
// smoothly; only the drawing steps. See src/life/people/README.md.

import { PERSON } from '@/style/people';
import type { Look, Rig } from './person';
import { rigOf } from './person';

export type PoseName =
  | 'stand' //   weight on both feet, arms down; shifts now and then
  | 'walk' //    `phase` runs 0–1 over two steps
  | 'run' //     the same with a longer stride and bent arms (children)
  | 'sit' //     on a bench or a step: legs out in front
  | 'tend' //    bent over a pot or a flower bed, hands down
  | 'look' //    a hand shading the eyes (viewpoint, stargazing)
  | 'wave' //    one arm up, waving
  | 'chat' //    small gestures with the hands
  | 'fish' //    both hands out in front, holding a rod
  | 'hop' //     both feet off the ground, arms up
  | 'hat' //     a hand on the hat in a gust
  | 'carry' //   arms forward, holding something (sack, watering can)
  | 'sweep' //   both hands on a broom, swinging
  | 'kite' //    an arm up holding a line, with a tug now and then
  | 'cheer' //   L50: both fists up, pumping one then the other
  | 'cover' //   L50: an arm out across in front, low (over a child's eyes)
  | 'dust' //    L50: bent a little, patting the dust off, one hand then the other
  | 'shake' //   L50: the right hand out, pumping up and down
  | 'hammer' // L54: the right arm up and down, striking
  | 'juggle'; // L56: both hands up in front, tossing in turn

export const POSES: readonly PoseName[] = ['stand', 'walk', 'run', 'sit', 'tend', 'look', 'wave', 'chat', 'fish', 'hop', 'hat', 'carry', 'sweep', 'kite', 'cheer', 'cover', 'dust', 'shake', 'hammer', 'juggle'];

export interface Pose {
  /** Swing forward (+) or back (−) about the hip or shoulder, radians. */
  legL: number;
  legR: number;
  armL: number;
  armR: number;
  /** Arms lifted out sideways from the body, radians. */
  outL: number;
  outR: number;
  /** The body leaning forward about the hips, radians. */
  lean: number;
  /** The whole figure raised (+) or lowered (−), in the figure's units. */
  lift: number;
  /** The body turned about the vertical (a look over the shoulder), radians. */
  twist: number;
}

const REST: Pose = { legL: 0, legR: 0, armL: 0, armR: 0, outL: 0.1, outR: 0.1, lean: 0, lift: 0, twist: 0 };

/** Which of `count` held drawings shows at time `t` (seconds) at `rate` drawings a second. */
export function held(t: number, rate: number, count: number): number {
  return ((Math.floor(t * rate) % count) + count) % count;
}

/**
 * The pose at a moment.
 *   walk, run:  `phase` is the stride phase (0–1 over two steps); it is snapped to PERSON.walkPoses drawings.
 *   the rest:   `phase` is seconds spent in the pose; drawings change PERSON.idleRate times a second.
 * `seed` (0–1) varies idle timing from person to person.
 */
export function poseOf(name: PoseName, phase: number, seed = 0): Pose {
  const p = { ...REST };
  const beat = (count: number, rate = PERSON.idleRate): number => held(phase + seed * 7, rate, count);
  switch (name) {
    case 'walk':
    case 'run': {
      const n = Math.max(2, Math.round(PERSON.walkPoses));
      const q = (((Math.floor(phase * n + 0.5) % n) + n) % n) / n; // snapped phase
      const s = Math.sin(q * Math.PI * 2);
      const run = name === 'run';
      const stride = PERSON.stride * (run ? 1.35 : 1);
      p.legL = s * stride;
      p.legR = -s * stride;
      p.armL = -s * PERSON.armSwing * (run ? 1.5 : 1);
      p.armR = s * PERSON.armSwing * (run ? 1.5 : 1);
      // Highest when the legs pass, lowest at contact.
      p.lift = (1 - Math.abs(s)) * PERSON.bob - PERSON.bob * 0.5 + (run ? 0.01 : 0);
      p.lean = run ? 0.22 : 0.05;
      break;
    }
    case 'stand': {
      // Mostly still; every so often the weight shifts or the head turns.
      const k = beat(12, 1.5);
      if (k === 3 || k === 4) p.twist = 0.5;
      if (k === 8) p.twist = -0.45;
      if (k === 10) p.lift = 0.004;
      break;
    }
    case 'sit':
      p.legL = 1.5;
      p.legR = 1.5;
      p.armL = 0.5;
      p.armR = 0.5;
      p.lean = -0.06;
      if (beat(10, 1.2) === 4) p.legL = 1.3; // a foot swings
      break;
    case 'tend': {
      const k = beat(4);
      p.lean = 0.85;
      p.legL = -0.12;
      p.legR = 0.2;
      p.armL = 1.05 + (k === 1 ? 0.25 : 0);
      p.armR = 1.05 + (k === 3 ? 0.25 : 0);
      p.lift = -0.012;
      break;
    }
    case 'look':
      p.armR = 2.5;
      p.outR = 0.5;
      p.lean = -0.05;
      p.twist = [0, 0, 0.3, 0.3, 0, -0.3][beat(6, 0.8)]!;
      break;
    case 'wave': {
      const k = beat(2, 4);
      p.armR = 2.9;
      p.outR = k === 0 ? 0.25 : 0.7;
      break;
    }
    case 'chat': {
      const k = beat(6, 2.2);
      p.armR = k === 1 || k === 2 ? 1.1 : 0.15;
      p.outR = k === 2 ? 0.5 : 0.15;
      p.armL = k === 4 ? 0.9 : 0.1;
      p.lean = k === 1 ? 0.06 : 0;
      break;
    }
    case 'fish': {
      const k = beat(14, 1.6);
      p.armL = 1.2;
      p.armR = 1.2;
      p.outL = -0.25;
      p.outR = -0.25;
      p.lean = k === 9 ? -0.12 : 0.06; // a tug on the line
      if (k === 9) {
        p.armL = 1.6;
        p.armR = 1.6;
      }
      break;
    }
    case 'hop':
      p.legL = 0.5;
      p.legR = -0.35;
      p.armL = 2.6;
      p.armR = 2.6;
      p.outL = 0.5;
      p.outR = 0.5;
      break;
    case 'hat':
      p.armR = 2.95;
      p.outR = -0.2;
      p.lean = 0.12;
      break;
    case 'carry':
      p.armL = 1.25;
      p.armR = 1.25;
      p.outL = -0.2;
      p.outR = -0.2;
      p.lean = -0.04;
      break;
    case 'kite': {
      const k = beat(8, 2);
      p.armR = k === 5 ? 2.0 : 2.45;
      p.outR = 0.3;
      p.armL = k === 5 ? 1.6 : 0.3;
      p.lean = k === 5 ? -0.2 : -0.1;
      break;
    }
    case 'sweep': {
      const k = beat(4, 2.5);
      const sw = [0.25, 0, -0.25, 0][k]!;
      p.armL = 0.95 + sw;
      p.armR = 1.15 + sw;
      p.outL = -0.3;
      p.outR = -0.3;
      p.lean = 0.2;
      p.twist = sw;
      break;
    }
    case 'cheer': {
      const k = beat(2, 3.5);
      p.armL = k === 0 ? 2.9 : 2.3;
      p.armR = k === 0 ? 2.3 : 2.9;
      p.outL = 0.35;
      p.outR = 0.35;
      p.lift = k === 0 ? 0.012 : 0;
      break;
    }
    case 'cover':
      p.armR = 1.35;
      p.outR = -0.55;
      p.armL = 0.2;
      p.lean = 0.12;
      break;
    case 'dust': {
      const k = beat(4, 4);
      p.lean = 0.35;
      p.armL = k === 0 || k === 1 ? 0.75 : 0.35;
      p.armR = k === 2 || k === 3 ? 0.75 : 0.35;
      p.outL = -0.2;
      p.outR = -0.2;
      p.legR = 0.1;
      break;
    }
    case 'shake': {
      const k = beat(2, 4);
      p.armR = k === 0 ? 1.15 : 0.85;
      p.outR = -0.15;
      p.lean = 0.06;
      break;
    }
    case 'juggle': {
      const k = beat(2, 6);
      p.armL = k === 0 ? 1.9 : 1.3;
      p.armR = k === 0 ? 1.3 : 1.9;
      p.outL = -0.25;
      p.outR = -0.25;
      p.lean = -0.08;
      break;
    }
    case 'hammer': {
      const k = beat(2, 3);
      p.armR = k === 0 ? 2.6 : 1.2;
      p.armL = 1.0;
      p.outL = -0.2;
      p.lean = 0.15;
      break;
    }
  }
  return p;
}

/** How far a sitting figure's hips come down, in its own units, to sit on a seat `height` above its feet. */
export function sitDrop(rig: Rig, height: number): number {
  return rig.hipY - 0.03 - height;
}

/**
 * Local matrices for the five pieces (PIECES order), written into `out`
 * (5 × 16 numbers, column-major) and returned. `scale` is the figure's size;
 * `drop` lowers the hips (sitting).
 */
export function rigMatrices(look: Look, pose: Pose, out: Float32Array = new Float32Array(80), drop = 0, rig: Rig = rigOf(look)): Float32Array {
  const y = pose.lift - drop;
  // The body: leans about the hips, turns about the vertical.
  const cl = Math.cos(pose.lean), sl = Math.sin(pose.lean);
  const ct = Math.cos(pose.twist), st = Math.sin(pose.twist);
  // B = T(0, hipY + y, 0) · Ry(twist) · Rx(lean) · T(0, −hipY, 0)
  // Rx(lean) leans the top forward (+Z): columns (1,0,0), (0,c,s), (0,−s,c).
  // Ry(twist):                            columns (c,0,−s), (0,1,0), (s,0,c).
  const b00 = ct, b01 = 0, b02 = -st;
  const b10 = st * sl, b11 = cl, b12 = ct * sl;
  const b20 = st * cl, b21 = -sl, b22 = ct * cl;
  const bx = -rig.hipY * b10, by = rig.hipY + y - rig.hipY * b11, bz = -rig.hipY * b12;
  set(out, 0, b00, b01, b02, b10, b11, b12, b20, b21, b22, bx, by, bz);
  // Legs hang from the hips and do not lean with the body.
  limb(out, 1, -rig.hipX, rig.hipY + y, 0, pose.legL, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0);
  limb(out, 2, rig.hipX, rig.hipY + y, 0, pose.legR, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0);
  // Arms hang from the shoulders, which move with the body.
  limb(out, 3, -rig.shoulderX, rig.shoulderY, 0, pose.armL, -pose.outL, b00, b01, b02, b10, b11, b12, b20, b21, b22, bx, by, bz);
  limb(out, 4, rig.shoulderX, rig.shoulderY, 0, pose.armR, pose.outR, b00, b01, b02, b10, b11, b12, b20, b21, b22, bx, by, bz);
  return out;
}

function set(
  out: Float32Array, i: number,
  x0: number, x1: number, x2: number,
  y0: number, y1: number, y2: number,
  z0: number, z1: number, z2: number,
  tx: number, ty: number, tz: number,
): void {
  const k = i * 16;
  out[k] = x0; out[k + 1] = x1; out[k + 2] = x2; out[k + 3] = 0;
  out[k + 4] = y0; out[k + 5] = y1; out[k + 6] = y2; out[k + 7] = 0;
  out[k + 8] = z0; out[k + 9] = z1; out[k + 10] = z2; out[k + 11] = 0;
  out[k + 12] = tx; out[k + 13] = ty; out[k + 14] = tz; out[k + 15] = 1;
}

/**
 * A limb's matrix: parent · T(px, py, pz) · Rz(out) · Rx(−swing). The parent
 * is given as its three axis columns and its translation. A positive swing
 * carries the hand or foot forward (+Z).
 */
function limb(
  out: Float32Array, i: number,
  px: number, py: number, pz: number,
  swing: number, spread: number,
  x0: number, x1: number, x2: number,
  y0: number, y1: number, y2: number,
  z0: number, z1: number, z2: number,
  tx: number, ty: number, tz: number,
): void {
  const c = Math.cos(swing), s = Math.sin(swing);
  const co = Math.cos(spread), so = Math.sin(spread);
  // L = Rz(spread) · Rx(−swing):  columns
  //   X = (co, so, 0)
  //   Y = Rz · (0, c, −s) = (−so·c, co·c, −s)
  //   Z = Rz · (0, s, c)  = (−so·s, co·s, c)
  const lx0 = co, lx1 = so, lx2 = 0;
  const ly0 = -so * c, ly1 = co * c, ly2 = -s;
  const lz0 = -so * s, lz1 = co * s, lz2 = c;
  const mul = (a: number, b: number, d: number, row: 0 | 1 | 2): number =>
    row === 0 ? x0 * a + y0 * b + z0 * d : row === 1 ? x1 * a + y1 * b + z1 * d : x2 * a + y2 * b + z2 * d;
  set(
    out, i,
    mul(lx0, lx1, lx2, 0), mul(lx0, lx1, lx2, 1), mul(lx0, lx1, lx2, 2),
    mul(ly0, ly1, ly2, 0), mul(ly0, ly1, ly2, 1), mul(ly0, ly1, ly2, 2),
    mul(lz0, lz1, lz2, 0), mul(lz0, lz1, lz2, 1), mul(lz0, lz1, lz2, 2),
    tx + mul(px, py, pz, 0), ty + mul(px, py, pz, 1), tz + mul(px, py, pz, 2),
  );
}
