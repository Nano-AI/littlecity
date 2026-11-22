// The raiders' longship and their rowing boats (design section 13b, the
// raid). Pure: meshes only; src/life/raid draws and moves them.
//
// Drawn to the standard of the harbour's galleons and cogs, and unmistakably
// a Viking longship:
//
//   the hull      long, low and double-ended, lofted from stations as the
//                 ships' kit is (boats/hull.ts `hullShape`), but built of
//                 CLINKER strakes: each strake its own ink group, its lower
//                 edge lapped proud over the one below, so the pen draws the
//                 planking as lines sweeping up with the sheer; tarred black
//                 below the water, weathered wood in two tones above, a red
//                 top strake, a gunwale cap, a shield rail
//   the inside    ribs, floorboards, the mast step, a sea chest for each rower
//                 to sit on; barrels and a coil of rope aft, a spare oar, the
//                 anchor at the bow
//   the prow      the stem rising into a tall curving neck and a carved
//                 dragon's head (open jaw, teeth, eyes, horns), a mane of red
//                 and gilt spikes down the neck, a gilt collar; the stern post
//                 curls up into a spiral tail
//   the shields   red and white, overlapping on the shield rail, rims and bosses
//   the rig       a stout mast with forestay, backstay and three shrouds a
//                 side, a gilt wind vane and a red pennant at the masthead; the
//                 yard and the sail are their own meshes (furled and bellied by
//                 the raid system): broad red and white stripes seamed between
//                 them, reef points across, a black raven in the middle
//   the oars      out through oar ports, a loom and a shaped blade with a red
//                 tip, rowed in time (body.ts `oarStroke`) and tossed upright
//                 when beached
//   the steering  a great steering oar on the starboard quarter with its tiller
//
// The boats raid's ship (`size` above 1.2) is grander: nine oars a side, a
// taller prow, a striped awning over the after deck. The rowing boats are
// small clinker boats of the same family.
//
// Frame: afloat, +Z the bow, +Y up, y = 0 the waterline, x = 0 the
// centreline (as the ships' kit). `size` scales everything.

import type { Vec3 } from '@/core/mat4';
import { compose, rotationX, rotationY, rotationZ, scaling, translation } from '@/core/mat4';
import { MeshBuilder, PATTERN, type MeshBuilder as MB, type MeshData } from '@/gen/mesh';
import { smoothBall, soft } from '@/gen/soft';
import { tube } from '@/parts/ground/kit';
import { face, faceMirror, hullShape, stick, type Hull, type HullSpec } from '@/parts/actors/boats/hull';
import { PALETTE } from '@/style/palette';

/**
 * The shields' colours: each shield is two halves (split down the middle) and a rim. Red and white only,
 * the sail's own red (Derek, 2026-11-22: "can they not be multicolored? just red and white"): the two
 * halves either way round, so a row of them alternates without being a rainbow.
 */
export const SHIELD_RED = '#c8362f';
export const SHIELD_PAIRS: readonly (readonly [string, string])[] = [
  [SHIELD_RED, PALETTE.white],
  [PALETTE.white, SHIELD_RED],
];
/** The sail's stripes: red and white. */
const SAIL_RED = '#c8362f';
const SAIL_WHITE = '#f3ead6';
/** Weathered oak in two tones (alternate strakes), the dark of the posts and the rail, tar below the water. */
const OAK = '#956434';
const OAK_PALE = '#bb8c55';
/** A painted band under the red top strake (as the Gokstad ship's were painted). */
const OCHRE = '#d9a441';
const WOOD = '#8a5a32';
const WOOD_DARK = '#5e3a20';
const TAR = '#2f2620';
const INSIDE = '#b48a58';
const FLOOR = '#9c7346';
const GILT = '#e0b030';
const IRON = '#6c6c74';

/** The longship's hull, in its own frame at size 1. Double-ended (no transom). */
export const LONGSHIP_SPEC: HullSpec = {
  length: 5.4,
  beam: 1.2,
  freeboard: 0.3,
  bowRise: 0.46,
  sternRise: 0.4,
  draft: 0.16,
  widest: 0.5,
  transom: 0,
  bowPoint: 0.95,
  stemRake: 0.8,
  transomRake: 0.8,
  round: 0.42,
  vee: 0.85,
  skin: 0.035,
  strake: 0.1,
  boot: 0.05,
  sole: 0.07,
  stations: 14,
};

/** The rowing boat a big longship lowers: a small clinker boat of the same family, double-ended. */
export const BOAT_SPEC: HullSpec = {
  length: 2.2,
  beam: 0.8,
  freeboard: 0.2,
  bowRise: 0.18,
  sternRise: 0.15,
  draft: 0.1,
  widest: 0.48,
  transom: 0,
  bowPoint: 0.9,
  stemRake: 0.6,
  transomRake: 0.6,
  round: 0.4,
  vee: 0.8,
  skin: 0.028,
  strake: 0.07,
  boot: 0.035,
  sole: 0.05,
  stations: 10,
};

/** Where the pieces of a longship are (size 1), for the system that moves them and puts people in it. */
export const LONGSHIP = {
  /** Clearance hull for routing: along its length from its origin, and half its beam (with a little to spare). */
  stern: -2.75,
  bow: 2.8,
  halfBeam: 0.68,
  /** The mast's foot, the yard's height and the sail's frame (the middle of the yard). */
  mastZ: 0.05,
  yardY: 2.35,
  sailWidth: 2.3,
  sailDrop: 1.45,
  /** The oar ports' line each side, and the oars' reach. */
  oarX: 0.58,
  oarY: 0.29,
  oarZ0: -1.5,
  oarZ1: 1.45,
  oars: 7,
  oarLength: 1.5,
  /** The floor people stand on inside. */
  sole: 0.07,
  rail: 0.3,
} as const;

/** The oars of a ship of this size: the landing longship's seven a side, the grand one's nine. */
export interface OarKit {
  oars: number;
  oarZ0: number;
  oarZ1: number;
  oarX: number;
  oarY: number;
  oarLength: number;
}
export function shipOars(size: number): OarKit {
  return size > 1.2 ? { oars: 9, oarZ0: -1.75, oarZ1: 1.6, oarX: LONGSHIP.oarX, oarY: LONGSHIP.oarY, oarLength: LONGSHIP.oarLength } : LONGSHIP;
}

export const BOAT = {
  stern: -1.1,
  bow: 1.15,
  halfBeam: 0.42,
  oarX: 0.37,
  oarY: 0.2,
  oarZ0: -0.25,
  oarZ1: 0.35,
  oars: 2,
  oarLength: 0.95,
  sole: 0.05,
  rail: 0.2,
} as const;

/** Points along a curl in the YZ plane: from `a`, heading `start` (0 = up, π/2 = +Z), turning by `turn` over `len`. */
function curl(a: Vec3, len: number, start: number, turn: number, steps: number): Vec3[] {
  const out: Vec3[] = [a];
  let ang = start;
  let [x, y, z] = a;
  const step = len / steps;
  for (let i = 0; i < steps; i++) {
    ang += turn / steps;
    y += Math.cos(ang) * step;
    z += Math.sin(ang) * step;
    out.push([x, y, z]);
  }
  return out;
}

const unit = (v: Vec3, fallback: Vec3 = [1, 0, 0]): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return l < 1e-9 ? fallback : [v[0] / l, v[1] / l, v[2] / l];
};

/** A flat piece in the YZ plane seen from both sides: two faces a hair apart (never one face drawn twice). */
function twoSided(b: MB, pts: readonly Vec3[]): void {
  b.polygon(pts.map(([x, y, z]): Vec3 => [x + 0.003, y, z]));
  b.polygon(pts.map(([x, y, z]): Vec3 => [x - 0.003, y, z]).reverse());
}

// ─────────────────────────────────────────────────────────── the hull ──

/**
 * A clinker hull: `strakes` overlapping planks a side from the keel to the sheer, each its own ink group (the
 * planking is drawn by the pen at the seams), each lapped `lap` proud of the one below at its lower edge;
 * tarred below `tarTo`, two tones of oak above, the top strake `top`; then the gunwale cap, the inner skin,
 * the floorboards. Returns the hull's shape functions.
 */
function clinker(b: MB, spec: HullSpec, opts: { strakes: number; lap: number; top: string; tarTo: number; band?: string }): Hull {
  const hull = hullShape(spec);
  const n = Math.max(6, spec.stations ?? 12);
  const ts: number[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    // Closer at the ends, where the planks sweep up and the plan curves most.
    ts.push(0.5 - 0.5 * Math.cos(Math.PI * u));
  }
  const yOf = (t: number, f: number): number => -hull.keel(t) + (hull.sheer(t) + hull.keel(t)) * f;
  const P = (t: number, f: number, lap: number): Vec3 => {
    const y = yOf(t, f);
    return [hull.outer(t, y) + lap, y, hull.z(t, y)];
  };
  const N = (t: number, f: number): Vec3 => {
    const e = 0.004;
    const a = P(Math.min(1, t + e), f, 0), c = P(Math.max(0, t - e), f, 0);
    const u = P(t, Math.min(1, f + 0.02), 0), d = P(t, Math.max(0, f - 0.02), 0);
    const along: Vec3 = [a[0] - c[0], a[1] - c[1], a[2] - c[2]];
    const up: Vec3 = [u[0] - d[0], u[1] - d[1], u[2] - d[2]];
    const nn = unit([up[1] * along[2] - up[2] * along[1], up[2] * along[0] - up[0] * along[2], up[0] * along[1] - up[1] * along[0]]);
    return nn[0] < 0 ? [-nn[0], -nn[1], -nn[2]] : nn;
  };
  const S = opts.strakes;
  for (let j = 0; j < S; j++) {
    const f0 = j / S, f1 = (j + 1) / S;
    const mid = yOf(0.5, (f0 + f1) / 2);
    const colour = j === S - 1 ? opts.top : j === S - 2 && opts.band ? opts.band : mid < opts.tarTo ? TAR : j % 2 ? OAK : OAK_PALE;
    b.with({ ink: `strake${j}`, color: colour, pattern: PATTERN.none }, () => {
      const lap = j === 0 ? 0 : opts.lap;
      for (let i = 0; i < n; i++) {
        const t0 = ts[i]!, t1 = ts[i + 1]!;
        // The lap narrows to nothing at the stems, where the planks meet in the posts.
        const l0 = lap * Math.min(1, Math.sin(Math.PI * t0) * 3), l1 = lap * Math.min(1, Math.sin(Math.PI * t1) * 3);
        const p = [P(t0, f0, l0), P(t1, f0, l1), P(t1, f1, 0), P(t0, f1, 0)];
        const q = [N(t0, f0), N(t1, f0), N(t1, f1), N(t0, f1)];
        face(b, p, q);
        faceMirror(b, p, q);
        // The lap's lower lip: a sliver facing down and out under the plank's edge.
        if (j > 0 && (l0 > 1e-4 || l1 > 1e-4)) {
          const lip = [P(t0, f0, 0), P(t1, f0, 0), P(t1, f0, l1), P(t0, f0, l0)];
          const dn: Vec3 = unit([0.4, -0.9, 0]);
          face(b, lip, [dn, dn, dn, dn]);
          faceMirror(b, lip, [dn, dn, dn, dn]);
        }
      }
    });
  }
  // The gunwale cap: from the outer sheer in over the inner skin.
  const UP: Vec3 = [0, 1, 0];
  b.with({ ink: 'gunwale', color: WOOD_DARK }, () => {
    for (let i = 0; i < n; i++) {
      const t0 = ts[i]!, t1 = ts[i + 1]!;
      const a = P(t0, 1, 0), c = P(t1, 1, 0);
      const ai: Vec3 = [Math.max(0, a[0] - spec.skin * 1.3), a[1] + 0.008, a[2]], ci: Vec3 = [Math.max(0, c[0] - spec.skin * 1.3), c[1] + 0.008, c[2]];
      const ao: Vec3 = [a[0] + 0.012, a[1] + 0.008, a[2]], co: Vec3 = [c[0] + 0.012, c[1] + 0.008, c[2]];
      face(b, [ao, co, ci, ai], [UP, UP, UP, UP]);
      faceMirror(b, [ao, co, ci, ai], [UP, UP, UP, UP]);
    }
  });
  // The inner skin, from the floor to the sheer.
  b.with({ ink: 'inside', color: INSIDE }, () => {
    for (let i = 0; i < n; i++) {
      const t0 = ts[i]!, t1 = ts[i + 1]!;
      const lo0 = Math.min(spec.sole, hull.sheer(t0) - 0.01), lo1 = Math.min(spec.sole, hull.sheer(t1) - 0.01);
      const pts: Vec3[] = [
        [hull.inner(t0, lo0), lo0, hull.z(t0, lo0)],
        [hull.inner(t1, lo1), lo1, hull.z(t1, lo1)],
        [hull.inner(t1, hull.sheer(t1)), hull.sheer(t1), hull.z(t1, hull.sheer(t1))],
        [hull.inner(t0, hull.sheer(t0)), hull.sheer(t0), hull.z(t0, hull.sheer(t0))],
      ];
      const nin = (p: Vec3): Vec3 => unit([-1, 0.15, 0.02 * Math.sign(p[2])]);
      face(b, pts, pts.map(nin));
      faceMirror(b, pts, pts.map(nin));
    }
  });
  // The floorboards: planks fore and aft between the ribs.
  b.with({ ink: 'floor', color: FLOOR, pattern: PATTERN.planks }, () => {
    for (let i = 1; i < n - 1; i++) {
      const t0 = ts[i]!, t1 = ts[i + 1]!;
      const y = spec.sole + 0.004;
      const x0 = hull.inner(t0, y) + 0.01, x1 = hull.inner(t1, y) + 0.01;
      if (x0 < 0.02 && x1 < 0.02) continue;
      face(b, [[-x0, y, hull.z(t0, y)], [x0, y, hull.z(t0, y)], [x1, y, hull.z(t1, y)], [-x1, y, hull.z(t1, y)]], [UP, UP, UP, UP]);
    }
  });
  return hull;
}

/** The ribs inside: a frame every so often, up the inner skin from the floor to the gunwale. */
function ribs(b: MB, hull: Hull, spec: HullSpec, from: number, to: number, count: number): void {
  b.with({ ink: 'ribs', color: WOOD_DARK }, () => {
    for (let i = 0; i < count; i++) {
      const t = from + ((to - from) * i) / Math.max(1, count - 1);
      for (const side of [1, -1]) {
        const pts: Vec3[] = [];
        for (let k = 0; k <= 3; k++) {
          const y = spec.sole + ((hull.sheer(t) - spec.sole) * k) / 3;
          pts.push([side * (hull.inner(t, y) - 0.012), y, hull.z(t, y)]);
        }
        tube(b, pts, 0.014, { seg: 3 });
      }
    }
  });
}

/** A round shield facing +Z at the origin, radius r: two painted halves, a rim and an iron boss. */
export function drawShield(b: MeshBuilder, r: number, pair: readonly [string, string], ink: string): void {
  b.setPattern(PATTERN.none);
  // The face: a shallow dome, split down the middle into its two colours. Lathed about Y, turned to face +Z.
  b.at(rotationX(Math.PI / 2), () => {
    b.setInk(ink);
    for (let k = 0; k < 2; k++) {
      b.setColor(pair[k]!);
      b.lathe([[r * 0.9, 0.008], [0, 0.026]], { segments: 5, start: k * Math.PI, sweep: Math.PI });
    }
    // The rim: a rawhide edge, darker, standing a little proud.
    b.setInk(`${ink}-rim`).setColor(WOOD_DARK);
    b.lathe([[r, -0.004], [r, 0.006], [r * 0.9, 0.01]], { segments: 10 });
    // The back: plain wood, so it reads from the inboard side too.
    b.setInk(ink).setColor(WOOD);
    b.lathe([[0, -0.004], [r, -0.004]], { segments: 10 });
    b.setInk(`${ink}-boss`).setColor('#9a9ba4').setPattern(PATTERN.metal);
    b.lathe([[r * 0.22, 0.02], [0, 0.046]], { segments: 6 });
    b.setPattern(PATTERN.none);
  });
}

/** The carved dragon's head, at the origin looking +Z (its neck runs down −Z), `k` its size. */
function dragonHead(b: MB, k: number): void {
  soft(b, { ink: 'dragon-head' }, (s) => {
    s.b.setColor(WOOD_DARK);
    // Skull and brow, the long snout, the lower jaw hanging open.
    s.ball(0, 0, 0, 0.11 * k, 0.1 * k, 0.13 * k, 10, 6);
    s.ball(0, 0.035 * k, 0.03 * k, 0.1 * k, 0.05 * k, 0.09 * k, 8, 4);
    s.ball(0, -0.01 * k, 0.16 * k, 0.07 * k, 0.06 * k, 0.13 * k, 8, 5);
    s.at(compose(translation(0, -0.07 * k, 0.07 * k), rotationX(0.5)), () => s.ball(0, 0, 0.07 * k, 0.055 * k, 0.03 * k, 0.12 * k, 8, 4));
  });
  // Nostrils, gilt: two knobs on the end of the snout.
  b.setInk('dragon-nostrils').setColor(GILT).setPattern(PATTERN.metal);
  for (const side of [1, -1]) smoothBall(b, side * 0.035 * k, 0.03 * k, 0.27 * k, 0.022 * k, 0.02 * k, 0.022 * k, 6, 4);
  b.setPattern(PATTERN.none);
  // The horns swept back.
  b.setInk('dragon-horns').setColor(GILT);
  for (const side of [1, -1]) tube(b, [[side * 0.06 * k, 0.08 * k, -0.02 * k], [side * 0.1 * k, 0.17 * k, -0.12 * k], [side * 0.1 * k, 0.21 * k, -0.25 * k]], [0.028 * k, 0.018 * k, 0.005 * k], { seg: 5 });
  // White eyes with red pupils, a red tongue, white teeth along both jaws.
  b.setInk('dragon-eye').setColor(PALETTE.white);
  for (const side of [1, -1]) b.at(translation(side * 0.088 * k, 0.04 * k, 0.05 * k), () => b.lathe([[0, -0.03 * k], [0.03 * k, 0], [0, 0.03 * k]], { segments: 7 }));
  b.setInk('dragon-pupil').setColor(PALETTE.red);
  for (const side of [1, -1]) b.at(translation(side * 0.11 * k, 0.04 * k, 0.055 * k), () => b.lathe([[0, -0.014 * k], [0.014 * k, 0], [0, 0.014 * k]], { segments: 5 }));
  b.setInk('dragon-tongue').setColor(PALETTE.red);
  tube(b, [[0, -0.06 * k, 0.1 * k], [0, -0.05 * k, 0.26 * k], [0.02 * k, -0.09 * k, 0.33 * k]], [0.014 * k, 0.012 * k, 0.004 * k], { seg: 4 });
  b.setInk('dragon-teeth').setColor(PALETTE.white);
  for (const z of [0.12, 0.17, 0.22]) for (const side of [1, -1]) {
    b.at(translation(side * 0.042 * k, -0.04 * k, z * k), () => b.lathe([[0.011 * k, 0], [0, -0.03 * k]], { segments: 4, capTop: true }));
    b.at(translation(side * 0.04 * k, -0.075 * k, z * k - 0.02 * k), () => b.lathe([[0.01 * k, 0], [0, 0.026 * k]], { segments: 4, capBottom: true }));
  }
}

/** The prow: the stem rising into the neck, the mane down it, the gilt collar, the head on top. */
function prow(b: MB, hull: Hull, k: number): void {
  const stem = hull.stemHead;
  const neck = curl([0, stem[1] - 0.06, stem[2] - 0.06], 1.05 * k, 0.12, 0.95, 10);
  b.with({ color: WOOD_DARK, ink: 'prow', pattern: PATTERN.none }, () => tube(b, neck, neck.map((_, i) => (0.095 - i * 0.004) * Math.sqrt(k)), { seg: 8 }));
  // The mane: spikes down the back of the neck, red and gilt in turn.
  b.with({ ink: 'mane' }, () => {
    for (let i = 1; i < neck.length - 1; i++) {
      const p = neck[i]!, q = neck[i + 1]!;
      const dy = q[1] - p[1], dz = q[2] - p[2];
      const l = Math.hypot(dy, dz) || 1;
      // Behind the neck (away from the way it bends).
      const by = dz / l, bz = -dy / l;
      const r = 0.085 * Math.sqrt(k), h = (0.12 + 0.05 * Math.sin((i / neck.length) * Math.PI)) * k;
      b.setColor(i % 2 ? SAIL_RED : GILT);
      const tri: Vec3[] = [[0, p[1] + by * r, p[2] + bz * r], [0, p[1] + by * (r + h) - dy / l * 0.04, p[2] + bz * (r + h) - dz / l * 0.04], [0, q[1] + by * r, q[2] + bz * r]];
      twoSided(b, tri);
    }
  });
  // A gilt collar where the neck leaves the stem.
  const c0 = neck[1]!, c1 = neck[2]!;
  b.with({ ink: 'collar', color: GILT, pattern: PATTERN.metal }, () => tube(b, [c0, [(c0[0] + c1[0]) / 2, (c0[1] + c1[1]) / 2, (c0[2] + c1[2]) / 2]], 0.11 * Math.sqrt(k), { seg: 8 }));
  const top = neck[neck.length - 1]!, before = neck[neck.length - 2]!;
  const look = Math.atan2(top[2] - before[2], top[1] - before[1]);
  b.at(compose(translation(top[0], top[1] + 0.03, top[2] + 0.03), rotationX(-(look - Math.PI / 2) * 0.6)), () => dragonHead(b, 1.55 * k));
}

/** The stern: the post rising and curling over into a spiral tail. */
function sternTail(b: MB, hull: Hull, k: number): void {
  const st = hull.sternHead;
  const tail = curl([0, st[1] - 0.06, st[2] + 0.06], 1.25 * k, -0.2, -4.4, 14);
  b.with({ color: WOOD_DARK, ink: 'tail' }, () => tube(b, tail, tail.map((_, i) => Math.max(0.02, 0.09 - i * 0.005)), { seg: 6 }));
  b.with({ color: GILT, ink: 'tail-tip', pattern: PATTERN.metal }, () => smoothBall(b, 0, tail[tail.length - 1]![1], tail[tail.length - 1]![2], 0.03, 0.03, 0.03, 6, 4));
}

/** A sea chest at (x, z) on the floor, `w` across, `h` tall: a plank box with a darker lid and an iron hasp. */
function seaChest(b: MB, x: number, y: number, z: number, w: number, h: number, colour: string, ink: string): void {
  b.with({ ink, color: colour, pattern: PATTERN.planks }, () => b.box([x - w / 2, y, z - w * 0.38], [x + w / 2, y + h * 0.85, z + w * 0.38], { skip: ['bottom'] }));
  b.with({ ink: `${ink}-lid`, color: WOOD_DARK }, () => b.box([x - w / 2 - 0.006, y + h * 0.85, z - w * 0.38 - 0.006], [x + w / 2 + 0.006, y + h, z + w * 0.38 + 0.006], { skip: ['bottom'] }));
  b.with({ ink: `${ink}-hasp`, color: IRON, pattern: PATTERN.metal }, () => b.box([x - 0.012, y + h * 0.55, z + w * 0.38], [x + 0.012, y + h * 0.9, z + w * 0.38 + 0.008]));
}

function barrel(b: MB, x: number, y: number, z: number, r: number, ink: string): void {
  b.with({ ink, color: '#a8672f', pattern: PATTERN.planks }, () => b.at(translation(x, y, z), () => b.lathe([[0, 0], [r * 0.85, 0], [r, r * 1.1], [r * 0.85, r * 2.2], [0, r * 2.2]], { segments: 9 })));
  b.with({ ink: `${ink}-hoops`, color: IRON, pattern: PATTERN.none }, () => {
    for (const f of [0.35, 1.85]) b.at(translation(x, y, z), () => b.lathe([[r * 0.95 + 0.004, r * f - 0.01], [r * 0.95 + 0.004, r * f + 0.01]], { segments: 9 }));
  });
}

/** A coil of rope lying on the floor. */
function coil(b: MB, x: number, y: number, z: number, r: number): void {
  // Three turns, each a ring (a lathed circle of rope), stacked and drawing in.
  b.with({ ink: 'coil', color: '#c9b48a' }, () => {
    for (let k = 0; k < 3; k++) {
      const rr = r * (1 - k * 0.22), w = 0.013, cy = y + w + k * 0.02;
      const prof: [number, number][] = [];
      for (let i = 0; i <= 6; i++) {
        const a = Math.PI * (1 - i / 6) - Math.PI / 2;
        prof.push([rr + Math.cos(a) * w, cy + Math.sin(a) * w]);
      }
      b.at(translation(x, 0, z), () => b.lathe(prof, { segments: 10 }));
      b.at(translation(x, 0, z), () => b.lathe(prof.map(([px, py]) => [2 * rr - px, py] as [number, number]).reverse(), { segments: 10 }));
    }
  });
}

/** An iron anchor lying on the floor at the bow, along the keel. */
function anchor(b: MB, x: number, y: number, z: number, k: number): void {
  b.with({ ink: 'anchor', color: IRON, pattern: PATTERN.metal }, () => {
    stick(b, [x, y + 0.02, z - 0.18 * k], [x, y + 0.02, z + 0.12 * k], 0.022 * k);
    tube(b, [[x - 0.1 * k, y + 0.02, z + 0.06 * k], [x - 0.06 * k, y + 0.02, z + 0.13 * k], [x, y + 0.02, z + 0.14 * k], [x + 0.06 * k, y + 0.02, z + 0.13 * k], [x + 0.1 * k, y + 0.02, z + 0.06 * k]], 0.016 * k, { seg: 4 });
    tube(b, [[x, y + 0.02, z - 0.2 * k], [x, y + 0.02, z - 0.24 * k]], 0.03 * k, { seg: 6 });
  });
}

// ─────────────────────────────────────────────────────── the sail ──

/** The striped square sail hanging from its yard: frame at the middle of the yard, cloth down −Y, bellying +Z. */
export function longshipSailMesh(size = 1): MeshData {
  const b = new MeshBuilder({ ink: `longship-sail-${size}` });
  const W = LONGSHIP.sailWidth * size, D = LONGSHIP.sailDrop * size;
  const stripes = 6, per = 2, nv = 6;
  const nu = stripes * per;
  // Fuller low and in the middle; the foot spread a little wider than the head.
  const belly = (u: number, v: number): number => 0.36 * size * Math.sin(Math.PI * u) * (0.35 + 0.65 * Math.sin((Math.PI * (v + 0.15)) / 1.15));
  const at = (u: number, v: number, off = 0): Vec3 => [(u - 0.5) * W * (1 + 0.08 * v), -v * D, belly(u, v) + off];
  // Each stripe its own ink: the seams between the cloths are drawn by the pen.
  for (let s = 0; s < stripes; s++) {
    b.setInk(`cloth${s}`).setColor(s % 2 === 0 ? SAIL_RED : SAIL_WHITE).setPattern(PATTERN.cloth);
    for (const sheet of [1, -1]) {
      for (let j = 0; j < nv; j++) {
        for (let i = s * per; i < (s + 1) * per; i++) {
          const q = [at(i / nu, j / nv, sheet * 0.004), at((i + 1) / nu, j / nv, sheet * 0.004), at((i + 1) / nu, (j + 1) / nv, sheet * 0.004), at(i / nu, (j + 1) / nv, sheet * 0.004)];
          if (sheet > 0) b.quad(q[0]!, q[3]!, q[2]!, q[1]!);
          else b.quad(q[0]!, q[1]!, q[2]!, q[3]!);
        }
      }
    }
  }
  b.setPattern(PATTERN.none);
  // The raven, black, spread across the middle on both faces.
  b.setInk('raven').setColor('#26221f');
  const raven: [number, number][] = [[0.5, 0.28], [0.36, 0.22], [0.27, 0.3], [0.4, 0.36], [0.44, 0.48], [0.5, 0.6], [0.56, 0.48], [0.6, 0.36], [0.73, 0.3], [0.64, 0.22]];
  for (const sheet of [1, -1]) {
    const pts = raven.map(([u, v]) => at(u, v, sheet * 0.009));
    b.polygon(sheet > 0 ? [...pts].reverse() : pts);
  }
  // Reef points: two rows of little ties across, and the bolt-rope down each edge.
  b.setInk('reef').setColor('#d9c9a4');
  for (const v of [0.22, 0.4]) {
    for (let i = 1; i < 12; i++) {
      const p = at(i / 12, v, 0.012);
      b.box([p[0] - 0.008, p[1] - 0.03, p[2] - 0.004], [p[0] + 0.008, p[1] + 0.006, p[2] + 0.012]);
    }
  }
  b.setInk('bolt-rope').setColor(WOOD_DARK);
  for (const u of [0, 1]) {
    const pts: Vec3[] = [];
    for (let j = 0; j <= nv; j++) pts.push(at(u, j / nv));
    tube(b, pts, 0.012 * size, { seg: 4 });
  }
  return b.build();
}

/** The yard and the furled sail along it (always drawn), frame as the sail's. */
export function longshipYardMesh(size = 1): MeshData {
  const b = new MeshBuilder({ ink: `longship-yard-${size}` });
  const W = LONGSHIP.sailWidth * size;
  b.setInk('yard').setColor(WOOD).setPattern(PATTERN.none);
  tube(b, [[-W * 0.58, 0, 0], [0, 0, 0], [W * 0.58, 0, 0]], [0.035 * size, 0.055 * size, 0.035 * size], { seg: 7 });
  // The sail bundled on the yard: a roll of its stripes, bound with ties.
  for (let i = 0; i < 6; i++) {
    b.setInk(`furl${i}`).setColor(i % 2 === 0 ? SAIL_RED : SAIL_WHITE).setPattern(PATTERN.cloth);
    const x0 = (-0.5 + i / 6) * W, x1 = (-0.5 + (i + 1) / 6) * W;
    b.at(compose(translation(x0, -0.07 * size, 0), rotationZ(-Math.PI / 2)), () => b.lathe([[0.065 * size, 0], [0.075 * size, (x1 - x0) / 2], [0.065 * size, x1 - x0]], { segments: 8, capTop: i === 5, capBottom: i === 0 }));
  }
  b.setInk('ties').setColor(WOOD_DARK).setPattern(PATTERN.none);
  for (let i = 1; i < 6; i++) {
    const x = (-0.5 + i / 6) * W;
    b.at(compose(translation(x, -0.07 * size, 0), rotationZ(-Math.PI / 2)), () => b.lathe([[0.08 * size, -0.01], [0.08 * size, 0.01]], { segments: 8 }));
  }
  return b.build();
}

// ─────────────────────────────────────────────────────── the oars ──

/** One bank of oars along a side (+1 starboard, −1 port), at rest: level, square out, blades a little down. */
export function oarBankMesh(side: 1 | -1, size = 1, boat = false): MeshData {
  const o: OarKit = boat ? BOAT : shipOars(size);
  const b = new MeshBuilder({ ink: `oars-${boat ? 'boat' : 'ship'}-${side}-${size}` });
  b.setInk('oars').setPattern(PATTERN.none);
  const k = boat ? 1 : size;
  const inboard = 0.26 * k, blade = 0.34 * k;
  for (let i = 0; i < o.oars; i++) {
    const z = (o.oarZ0 + ((o.oarZ1 - o.oarZ0) * i) / Math.max(1, o.oars - 1)) * k;
    const x = side * o.oarX * k;
    const y = o.oarY * k;
    const out = o.oarLength * k - inboard;
    const drop = 0.06 * k;
    const yAt = (d: number): number => y - drop * (d / out);
    // The loom, a little thicker at the handle.
    b.setColor(WOOD);
    tube(b, [[x - side * inboard, y + 0.05 * k, z], [x, y, z], [x + side * (out - blade), yAt(out - blade), z]], [0.018 * k, 0.015 * k, 0.012 * k], { seg: 5 });
    // The blade: a flat lozenge, widening from the loom and rounded at the tip; the tip painted red.
    const b0 = out - blade, w = 0.05 * k;
    const pts = (u0: number, u1: number, w0: number, w1: number): Vec3[] => [
      [x + side * (b0 + blade * u0), yAt(b0 + blade * u0), z - w0],
      [x + side * (b0 + blade * u1), yAt(b0 + blade * u1), z - w1],
      [x + side * (b0 + blade * u1), yAt(b0 + blade * u1), z + w1],
      [x + side * (b0 + blade * u0), yAt(b0 + blade * u0), z + w0],
    ];
    for (const [u0, u1, w0, w1, colour] of [[0, 0.3, 0.01, w, OAK], [0.3, 0.75, w, w, OAK], [0.75, 1, w, w * 0.7, SAIL_RED]] as const) {
      b.setColor(colour);
      const q = pts(u0 * 1, u1 * 1, w0, w1);
      const up = q.map(([px, py, pz]): Vec3 => [px, py + 0.003, pz]), dn = q.map(([px, py, pz]): Vec3 => [px, py - 0.003, pz]);
      b.polygon(side > 0 ? up : [...up].reverse());
      b.polygon(side > 0 ? [...dn].reverse() : dn);
    }
  }
  return b.build();
}

// ────────────────────────────────────────────────────── the longship ──

/**
 * The longship's hull with everything fixed to it (see the file's header). `size` scales it; above 1.2 it is
 * the grand ship of the boats raid.
 */
export function longshipMesh(size = 1, look = 0): MeshData {
  const b = new MeshBuilder({ ink: `longship-${size}-${look}` });
  b.at(scaling(size, size, size), () => drawLongship(b, look, size > 1.2));
  return b.build();
}

function drawLongship(b: MB, look: number, grand: boolean): void {
  const spec = LONGSHIP_SPEC;
  const hull = clinker(b, spec, { strakes: 7, lap: 0.014, top: SAIL_RED, tarTo: 0.06, band: OCHRE });
  const o = grand ? shipOars(1.5) : LONGSHIP;
  ribs(b, hull, spec, 0.16, 0.84, 7);
  // The mast step: a heavy block on the keel line, the mast's foot in it.
  b.with({ ink: 'mast-step', color: WOOD_DARK, pattern: PATTERN.planks }, () => b.box([-0.08, spec.sole, LONGSHIP.mastZ - 0.35], [0.08, spec.sole + 0.07, LONGSHIP.mastZ + 0.35]));
  // Sea chests for the rowers, each side of every oar station (the raid seats them on these).
  const chests = ['#7a4b2a', '#5d6f86', '#8a6a3a', '#6e3b30'];
  for (let i = 0; i < o.oars; i++) {
    const z = o.oarZ0 + ((o.oarZ1 - o.oarZ0) * i) / Math.max(1, o.oars - 1) + 0.05;
    for (const side of [1, -1]) seaChest(b, side * 0.29, spec.sole, z - 0.02, 0.17, 0.11, chests[(i * 2 + (side > 0 ? 0 : 1) + look) % chests.length]!, `chest${i}${side > 0 ? 's' : 'p'}`);
  }
  // Gear: two barrels aft, a coil of rope and the anchor forward, a spare oar along the floor.
  barrel(b, -0.16, spec.sole, -1.95, 0.07, 'barrel-a');
  barrel(b, 0.02, spec.sole, -2.05, 0.065, 'barrel-b');
  coil(b, 0.12, spec.sole, 1.95, 0.1);
  anchor(b, -0.04, spec.sole, 2.1, 0.8);
  b.with({ ink: 'spare-oar', color: WOOD }, () => stick(b, [0.06, spec.sole + 0.02, -1.55], [0.06, spec.sole + 0.02, 1.2], 0.022));
  b.with({ ink: 'spare-blade', color: SAIL_RED }, () => b.box([0.02, spec.sole + 0.012, 1.2], [0.1, spec.sole + 0.028, 1.48]));

  // The posts: the dragon at the prow, the tail at the stern (taller on the grand ship).
  prow(b, hull, grand ? 1.25 : 1);
  sternTail(b, hull, grand ? 1.15 : 1);

  // The shield rail, and the shields along it, overlapping; oar ports in the top strake between them.
  const n = grand ? 11 : 9;
  for (const side of [1, -1] as const) {
    b.with({ ink: `shield-rail-${side}`, color: WOOD_DARK }, () => {
      const pts: Vec3[] = [];
      for (let i = 0; i <= 10; i++) {
        const t = 0.16 + (0.68 * i) / 10;
        const y = hull.sheer(t) - 0.035;
        pts.push([side * (hull.outer(t, y) + 0.012), y, hull.z(t, y)]);
      }
      tube(b, pts, 0.014, { seg: 4 });
    });
    for (let i = 0; i < n; i++) {
      const t = 0.18 + (0.64 * i) / (n - 1);
      const y = hull.sheer(t) - 0.07;
      const x = hull.outer(t, y) + 0.03;
      const z = hull.z(t, y);
      const pair = SHIELD_PAIRS[(i + look + (side > 0 ? 0 : 1)) % SHIELD_PAIRS.length]!;
      b.at(compose(translation(side * x, y, z), rotationY((side * Math.PI) / 2), rotationX(-0.12)), () => drawShield(b, 0.17, pair, `shield-${side}-${i}`));
    }
    b.with({ ink: `ports-${side}`, color: '#1e1814' }, () => {
      for (let i = 0; i < o.oars; i++) {
        const z = o.oarZ0 + ((o.oarZ1 - o.oarZ0) * i) / Math.max(1, o.oars - 1);
        const t = hull.t(z);
        const y = o.oarY;
        b.at(compose(translation(side * (hull.outer(t, y) + 0.004), y, z), rotationZ((side * Math.PI) / 2)), () => b.lathe([[0.026, 0], [0, 0.004]], { segments: 6 }));
      }
    });
  }

  // ── the mast, its stays and shrouds, the vane and the pennant ──
  const head = LONGSHIP.yardY + 0.3;
  b.with({ color: WOOD, ink: 'mast' }, () => b.at(translation(0, spec.sole + 0.06, LONGSHIP.mastZ), () => b.lathe([[0.085, 0], [0.075, 0.6], [0.06, head - spec.sole - 0.06]], { segments: 9, capTop: true })));
  b.with({ color: '#c9b48a', ink: 'stays' }, () => {
    const top: Vec3 = [0, head - 0.12, LONGSHIP.mastZ];
    stick(b, top, [0, hull.sheer(0.96), hull.z(0.96, hull.sheer(0.96))], 0.016);
    stick(b, top, [0, hull.sheer(0.05), hull.z(0.05, hull.sheer(0.05))], 0.016);
    for (const side of [1, -1]) {
      for (const t of [0.42, 0.47, 0.52]) {
        const y = hull.sheer(t);
        stick(b, top, [side * (hull.outer(t, y) - 0.01), y, hull.z(t, y)], 0.013);
      }
    }
  });
  // A gilt wind vane on the masthead, and a red pennant streaming below it.
  b.with({ ink: 'vane', color: GILT, pattern: PATTERN.metal, sway: 0 }, () => {
    stick(b, [0, head, LONGSHIP.mastZ], [0, head + 0.14, LONGSHIP.mastZ], 0.014);
    const vane: Vec3[] = [[0, head + 0.02, LONGSHIP.mastZ], [0, head + 0.13, LONGSHIP.mastZ], [0, head + 0.12, LONGSHIP.mastZ - 0.18], [0, head + 0.04, LONGSHIP.mastZ - 0.22]];
    twoSided(b, vane);
  });
  b.with({ ink: 'pennant', color: SAIL_RED, pattern: PATTERN.cloth }, () => {
    b.setSway((_x, _y, z) => Math.min(1, Math.max(0, (LONGSHIP.mastZ - z) * 2)));
    const pen: Vec3[] = [[0, head - 0.04, LONGSHIP.mastZ - 0.02], [0, head - 0.16, LONGSHIP.mastZ - 0.02], [0, head - 0.12, LONGSHIP.mastZ - 0.5]];
    twoSided(b, pen);
    b.setSway(0);
  });

  // ── the steering oar on the starboard quarter, and its tiller ──
  b.with({ ink: 'steering' }, () => {
    const at = hull.z(0.1, 0.4);
    const x = hull.outer(0.1, 0.35) + 0.06;
    b.setColor(WOOD);
    stick(b, [x, 0.8, at + 0.05], [x + 0.08, -0.05, at - 0.12], 0.055);
    b.setColor(SAIL_RED);
    stick(b, [x + 0.08, -0.05, at - 0.12], [x + 0.1, -0.32, at - 0.2], 0.03, 0.17);
    b.setColor(WOOD_DARK);
    stick(b, [x - 0.005, 0.72, at + 0.04], [x - 0.42, 0.68, at + 0.08], 0.03);
  });

  // ── the grand ship: a striped awning over the after deck ──
  if (grand) {
    const za = hull.z(0.12, 0.5), zb = hull.z(0.27, 0.5);
    const aw = hull.outer(0.2, 0.35) - 0.04, top = 1.0;
    b.with({ color: WOOD_DARK, ink: 'awning-posts' }, () => {
      for (const x of [-aw, aw]) for (const z of [za + 0.06, zb - 0.06]) stick(b, [x, hull.sheer(hull.t(z)) - 0.02, z], [x, top, z], 0.03);
    });
    b.with({ ink: 'awning' }, () => {
      const nS = 6;
      for (let i = 0; i < nS; i++) {
        b.setColor(i % 2 === 0 ? SAIL_RED : SAIL_WHITE).setPattern(PATTERN.cloth);
        const x0 = -aw - 0.08 + ((2 * aw + 0.16) * i) / nS, x1 = -aw - 0.08 + ((2 * aw + 0.16) * (i + 1)) / nS;
        const y = (x: number): number => top + 0.16 * (1 - (x / (aw + 0.08)) ** 2);
        b.quad([x0, y(x0), za - 0.05], [x0, y(x0), zb + 0.05], [x1, y(x1), zb + 0.05], [x1, y(x1), za - 0.05]);
        b.quad([x1, y(x1) - 0.012, za - 0.05], [x1, y(x1) - 0.012, zb + 0.05], [x0, y(x0) - 0.012, zb + 0.05], [x0, y(x0) - 0.012, za - 0.05]);
      }
      b.setPattern(PATTERN.none);
    });
  }
}

// ──────────────────────────────────────────────────── the rowing boat ──

/** A rowing boat for the raiders: a small clinker boat of the longship's family, a little curled stem, shields. */
export function raidBoatMesh(look = 0): MeshData {
  const b = new MeshBuilder({ ink: `raid-boat-${look}` });
  const spec = BOAT_SPEC;
  const hull = clinker(b, spec, { strakes: 4, lap: 0.01, top: SAIL_RED, tarTo: 0.04 });
  ribs(b, hull, spec, 0.2, 0.8, 4);
  // Thwarts: plank seats across.
  b.with({ color: WOOD_DARK, ink: 'thwarts', pattern: PATTERN.planks }, () => {
    for (const z of [-0.5, 0.05, 0.55]) {
      const t = hull.t(z);
      const x = hull.inner(t, 0.12) + 0.01;
      if (x > 0.05) b.box([-x, 0.1, z - 0.06], [x, 0.125, z + 0.06], { skip: ['w', 'e'] });
    }
  });
  const stem = hull.stemHead;
  const neck = curl([0, stem[1] - 0.03, stem[2] - 0.03], 0.36, 0.3, 1.8, 6);
  b.with({ color: WOOD_DARK, ink: 'stem-curl' }, () => tube(b, neck, neck.map((_, i) => Math.max(0.015, 0.05 - i * 0.006)), { seg: 5 }));
  const st = hull.sternHead;
  const tail = curl([0, st[1] - 0.03, st[2] + 0.03], 0.28, -0.3, -1.6, 5);
  b.with({ color: WOOD_DARK, ink: 'stern-curl' }, () => tube(b, tail, tail.map((_, i) => Math.max(0.015, 0.045 - i * 0.006)), { seg: 5 }));
  for (const side of [1, -1] as const) {
    for (let i = 0; i < 2; i++) {
      const t = 0.32 + 0.3 * i;
      const y = hull.sheer(t) - 0.05;
      const x = hull.outer(t, y) + 0.025;
      const z = hull.z(t, y);
      b.at(compose(translation(side * x, y, z), rotationY((side * Math.PI) / 2), rotationX(-0.1)), () => drawShield(b, 0.13, SHIELD_PAIRS[(i + look + (side > 0 ? 1 : 0)) % SHIELD_PAIRS.length]!, `shield-${side}-${i}`));
    }
  }
  // A coil of rope in the bow.
  coil(b, 0, spec.sole, 0.78, 0.07);
  return b.build();
}

/** The heap of loot amidships (sacks, a chest, a barrel), shown more and more as it grows: `n` 1–3 pieces. */
export function lootHeapMesh(n: number, size = 1): MeshData {
  const b = new MeshBuilder({ ink: `loot-heap-${n}-${size}` });
  b.at(scaling(size, size, size), () => {
    if (n >= 1) {
      // A chest: a box with a curved lid, gilt bands.
      b.setInk('chest').setColor('#e0a92e').setPattern(PATTERN.planks);
      b.box([-0.14, 0.14, -0.3], [0.14, 0.3, -0.06]);
      b.at(compose(translation(0, 0.3, -0.18), rotationZ(Math.PI / 2)), () => b.lathe([[0.14, -0.12], [0.14, 0.12]], { segments: 8, start: 0, sweep: Math.PI, capTop: true, capBottom: true }));
      b.setInk('chest-bands').setColor('#7a3d1c').setPattern(PATTERN.metal);
      for (const z of [-0.26, -0.1]) b.box([-0.145, 0.14, z - 0.012], [0.145, 0.31, z + 0.012]);
    }
    if (n >= 2) {
      b.setInk('sacks').setColor('#e3b866').setPattern(PATTERN.cloth);
      for (const [x, z] of [[-0.12, 0.12], [0.12, 0.16]] as const) b.at(translation(x, 0.14, z), () => b.lathe([[0, 0], [0.1, 0.01], [0.11, 0.1], [0.06, 0.2], [0, 0.22]], { segments: 8 }));
    }
    if (n >= 3) {
      b.setInk('barrel').setColor('#a8672f').setPattern(PATTERN.planks);
      b.at(compose(translation(0, 0.24, 0.45), rotationZ(Math.PI / 2)), () => b.lathe([[0.08, -0.13], [0.1, 0], [0.08, 0.13]], { segments: 10, capTop: true, capBottom: true }));
    }
  });
  return b.build();
}

