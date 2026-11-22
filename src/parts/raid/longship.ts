// The raiders' longship and their rowing boats (design section 13b, the
// raid). Pure: meshes only; src/life/raid draws and moves them.
//
// What makes it a longship at a glance, from the town view:
//
//   the sail      one big square sail striped red and white, on a yard
//                 across a single mast amidships (its own mesh: furled up to
//                 the yard and bellied by the raid system)
//   the prow      the stem rising high and curling into a carved dragon's
//                 head with a gaping jaw, horns and a red eye; the stern
//                 post curls up into a tail
//   the shields   a row of round painted shields along each side at the
//                 rail, overlapping, each a different pair of colours with
//                 an iron boss
//   the oars      a bank along each side (its own mesh, rowed like the
//                 galley's: body.ts `oarStroke`)
//
// Frame: afloat, +Z the bow, +Y up, y = 0 the waterline, x = 0 the
// centreline (as the ships' kit). `size` scales everything: 1 is the
// landing longship (about five and a half cells), 1.3 the big one that
// stands off and sends boats.

import type { Vec3 } from '@/core/mat4';
import { compose, rotationX, rotationY, rotationZ, scaling, translation } from '@/core/mat4';
import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { soft } from '@/gen/soft';
import { tube } from '@/parts/ground/kit';
import { drawHull, stick, type Hull, type HullSpec } from '@/parts/actors/boats/hull';
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
const WOOD = '#8a5a32';
const WOOD_DARK = '#5e3a20';
const TAR = '#3a2a20';

/** The longship's hull, in its own frame at size 1. */
export const LONGSHIP_SPEC: HullSpec = {
  length: 5.4,
  beam: 1.2,
  freeboard: 0.3,
  bowRise: 0.42,
  sternRise: 0.36,
  draft: 0.16,
  widest: 0.48,
  transom: 0.03,
  bowPoint: 0.95,
  stemRake: 0.75,
  transomRake: 0.7,
  round: 0.42,
  vee: 0.85,
  skin: 0.035,
  strake: 0.1,
  boot: 0.05,
  sole: 0.07,
  stations: 14,
};

/** The rowing boat a big longship lowers (a plain boat for six, with a red strake and shields). */
export const BOAT_SPEC: HullSpec = {
  length: 2.2,
  beam: 0.78,
  freeboard: 0.2,
  bowRise: 0.16,
  sternRise: 0.12,
  draft: 0.1,
  widest: 0.45,
  transom: 0.12,
  bowPoint: 0.9,
  stemRake: 0.5,
  transomRake: 0.45,
  round: 0.4,
  vee: 0.8,
  skin: 0.028,
  strake: 0.07,
  boot: 0.035,
  sole: 0.05,
  stations: 9,
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
  /** The thole line each side, and the oars' reach. */
  oarX: 0.58,
  oarY: 0.33,
  oarZ0: -1.5,
  oarZ1: 1.45,
  oars: 7,
  oarLength: 1.45,
  /** The floor people stand on inside, and where they sit at the oars (z), down each side. */
  sole: 0.07,
  rail: 0.3,
} as const;

export const BOAT = {
  stern: -1.1,
  bow: 1.15,
  halfBeam: 0.42,
  oarX: 0.36,
  oarY: 0.22,
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

/** A round shield facing +Z at the origin, radius r: two painted halves, a rim and an iron boss. */
export function drawShield(b: MeshBuilder, r: number, pair: readonly [string, string], ink: string): void {
  b.setPattern(PATTERN.none);
  // The face: a shallow dome, split down the middle into its two colours. Lathed about Y, turned to face +Z.
  b.at(rotationX(Math.PI / 2), () => {
    b.setInk(ink);
    for (let k = 0; k < 2; k++) {
      b.setColor(pair[k]!);
      b.lathe([[r, 0], [r * 0.72, 0.018], [0, 0.026]], { segments: 7, start: k * Math.PI, sweep: Math.PI });
    }
    // The back: plain wood, so it reads from the inboard side too.
    b.setColor(WOOD);
    b.lathe([[0, -0.004], [r, 0]], { segments: 14 });
    b.setInk(`${ink}-boss`).setColor('#9a9ba4').setPattern(PATTERN.metal);
    b.lathe([[r * 0.24, 0.02], [r * 0.2, 0.04], [0, 0.05]], { segments: 8 });
    b.setPattern(PATTERN.none);
  });
}

/** The carved dragon's head at the top of the prow, at the origin looking +Z (its neck runs down −Z). */
function dragonHead(b: MeshBuilder, k: number): void {
  soft(b, { ink: 'dragon-head' }, (s) => {
    s.b.setColor(WOOD_DARK);
    // Skull, snout, the lower jaw hanging open.
    s.ball(0, 0, 0, 0.11 * k, 0.1 * k, 0.13 * k, 10, 6);
    s.ball(0, -0.01 * k, 0.15 * k, 0.07 * k, 0.06 * k, 0.12 * k, 8, 5);
    s.at(compose(translation(0, -0.07 * k, 0.07 * k), rotationX(0.5)), () => s.ball(0, 0, 0.06 * k, 0.055 * k, 0.03 * k, 0.11 * k, 8, 4));
  });
  // The horns (ears) swept back, and the crest down the neck.
  b.setInk('dragon-horns').setColor(PALETTE.yellow).setPattern(PATTERN.none);
  for (const side of [1, -1]) tube(b, [[side * 0.06 * k, 0.07 * k, -0.02 * k], [side * 0.1 * k, 0.15 * k, -0.12 * k], [side * 0.11 * k, 0.17 * k, -0.22 * k]], [0.026 * k, 0.018 * k, 0.006 * k], { seg: 5 });
  // Red eyes and a red tongue, and white teeth along the jaw.
  b.setInk('dragon-eye').setColor(PALETTE.red);
  for (const side of [1, -1]) b.at(translation(side * 0.085 * k, 0.035 * k, 0.05 * k), () => b.lathe([[0, -0.025 * k], [0.026 * k, 0], [0, 0.025 * k]], { segments: 6 }));
  b.setInk('dragon-tongue');
  tube(b, [[0, -0.06 * k, 0.1 * k], [0, -0.05 * k, 0.24 * k], [0.02 * k, -0.08 * k, 0.3 * k]], [0.014 * k, 0.012 * k, 0.004 * k], { seg: 4 });
  b.setInk('dragon-teeth').setColor(PALETTE.white);
  for (const z of [0.14, 0.2]) for (const side of [1, -1]) b.at(translation(side * 0.04 * k, -0.045 * k, z * k), () => b.lathe([[0.012 * k, 0], [0, -0.03 * k]], { segments: 4, capTop: true }));
}

/** The striped square sail hanging from its yard: frame at the middle of the yard, cloth down −Y, bellying +Z. */
export function longshipSailMesh(size = 1): MeshData {
  const b = new MeshBuilder({ ink: `longship-sail-${size}` });
  const W = LONGSHIP.sailWidth * size, D = LONGSHIP.sailDrop * size;
  const nu = 10, nv = 5;
  const stripes = 6;
  const at = (u: number, v: number): Vec3 => [(u - 0.5) * W, -v * D, 0];
  // Fuller low and in the middle; the foot spread a little wider than the head.
  const belly = (u: number, v: number): number => 0.38 * size * Math.sin(Math.PI * u) * (0.35 + 0.65 * Math.sin((Math.PI * (v + 0.15)) / 1.15));
  const spread = (u: number, v: number): Vec3 => {
    const p = at(u, v);
    return [p[0] * (1 + 0.08 * v), p[1], belly(u, v)];
  };
  b.setInk('sail').setPattern(PATTERN.none);
  for (const sheet of [1, -1]) {
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const stripe = Math.floor((i / nu) * stripes);
        b.setColor(stripe % 2 === 0 ? SAIL_RED : SAIL_WHITE);
        const q = [spread(i / nu, j / nv), spread((i + 1) / nu, j / nv), spread((i + 1) / nu, (j + 1) / nv), spread(i / nu, (j + 1) / nv)].map((p): Vec3 => [p[0], p[1], p[2] + sheet * 0.004]);
        if (sheet > 0) b.quad(q[0]!, q[3]!, q[2]!, q[1]!);
        else b.quad(q[0]!, q[1]!, q[2]!, q[3]!);
      }
    }
  }
  return b.build();
}

/** The yard and the furled sail along it (always drawn), frame as the sail's. */
export function longshipYardMesh(size = 1): MeshData {
  const b = new MeshBuilder({ ink: `longship-yard-${size}` });
  const W = LONGSHIP.sailWidth * size;
  b.setInk('yard').setColor(WOOD).setPattern(PATTERN.none);
  stick(b, [-W * 0.56, 0, 0], [W * 0.56, 0, 0], 0.07 * size);
  // The sail bundled on the yard: a roll of its stripes.
  b.setInk('furl');
  for (let i = 0; i < 6; i++) {
    b.setColor(i % 2 === 0 ? SAIL_RED : SAIL_WHITE);
    const x0 = (-0.5 + i / 6) * W, x1 = (-0.5 + (i + 1) / 6) * W;
    b.at(compose(translation(x0, -0.06 * size, 0), rotationZ(-Math.PI / 2)), () => b.lathe([[0.07 * size, 0], [0.07 * size, x1 - x0]], { segments: 7, capTop: i === 5, capBottom: i === 0 }));
  }
  return b.build();
}

/** One bank of oars along a side (+1 starboard, −1 port), at rest: level, square out, blades a little down. */
export function oarBankMesh(side: 1 | -1, size = 1, boat = false): MeshData {
  const o = boat ? BOAT : LONGSHIP;
  const b = new MeshBuilder({ ink: `oars-${boat ? 'boat' : 'ship'}-${side}-${size}` });
  b.setInk('oars').setPattern(PATTERN.none);
  const k = size;
  const inboard = 0.28 * k, blade = 0.3 * k;
  for (let i = 0; i < o.oars; i++) {
    const z = (o.oarZ0 + ((o.oarZ1 - o.oarZ0) * i) / Math.max(1, o.oars - 1)) * k;
    const x = side * o.oarX * k;
    const y = o.oarY * k;
    const out = o.oarLength * k - inboard;
    const drop = 0.06 * k;
    b.setColor(WOOD);
    stick(b, [x - side * inboard, y + 0.06 * k, z], [x + side * (out - blade), y - drop * ((out - blade) / out), z], 0.03 * k);
    b.setColor(SAIL_RED);
    stick(b, [x + side * (out - blade), y - drop * ((out - blade) / out), z], [x + side * out, y - drop, z], 0.075 * k, 0.016 * k);
  }
  return b.build();
}

/**
 * The longship's hull with everything fixed to it: the dragon prow, the tail, the shields along each
 * side, the mast, the rowers' benches, a steering oar on the starboard quarter. `size` scales it.
 */
export function longshipMesh(size = 1, look = 0): MeshData {
  const b = new MeshBuilder({ ink: `longship-${size}-${look}` });
  b.at(scaling(size, size, size), () => drawLongship(b, look));
  return b.build();
}

function drawLongship(b: MeshBuilder, look: number): void {
  const hull: Hull = drawHull(b, LONGSHIP_SPEC, { bottom: TAR, topsides: WOOD, strake: SAIL_RED, rail: WOOD_DARK, inside: '#a87a4c', sole: '#9b6e42' });
  // Benches for the rowers.
  b.with({ color: WOOD_DARK, ink: 'benches', pattern: PATTERN.planks }, () => {
    for (let i = 0; i < LONGSHIP.oars; i++) {
      const z = LONGSHIP.oarZ0 + ((LONGSHIP.oarZ1 - LONGSHIP.oarZ0) * i) / (LONGSHIP.oars - 1) - 0.12;
      const t = hull.t(z);
      const x = hull.inner(t, 0.2) + 0.01;
      if (x > 0.05) b.box([-x, 0.16, z - 0.06], [x, 0.19, z + 0.06], { skip: ['w', 'e'] });
    }
  });
  // ── the prow: the stem rising and curling forward into the dragon's neck and head ──
  const stem = hull.stemHead;
  const neck = curl([0, stem[1] - 0.04, stem[2] - 0.05], 0.95, 0.15, 0.95, 8);
  b.with({ color: WOOD_DARK, ink: 'prow', pattern: PATTERN.none }, () => {
    tube(b, neck, neck.map((_, i) => 0.085 - i * 0.004), { seg: 7 });
  });
  // A crest of red spines down the back of the neck.
  b.with({ color: SAIL_RED, ink: 'crest' }, () => {
    for (let i = 2; i < neck.length - 1; i += 1) {
      const p = neck[i]!, q = neck[i + 1]!;
      const dy = q[1] - p[1], dz = q[2] - p[2];
      const l = Math.hypot(dy, dz) || 1;
      // Behind the neck (away from the way it bends): −Z of its direction rotated.
      const bx = 0, by = dz / l, bz = -dy / l;
      b.polygon([[bx, p[1] + by * 0.07, p[2] + bz * 0.07], [bx, p[1] + by * 0.16, p[2] + bz * 0.16 - 0.03], [bx, q[1] + by * 0.07, q[2] + bz * 0.07]]);
      b.polygon([[bx, q[1] + by * 0.07, q[2] + bz * 0.07], [bx, p[1] + by * 0.16, p[2] + bz * 0.16 - 0.03], [bx, p[1] + by * 0.07, p[2] + bz * 0.07]]);
    }
  });
  const top = neck[neck.length - 1]!, before = neck[neck.length - 2]!;
  const look0 = Math.atan2(top[2] - before[2], top[1] - before[1]);
  b.at(compose(translation(top[0], top[1] + 0.03, top[2] + 0.02), rotationX(-(look0 - Math.PI / 2) * 0.6)), () => dragonHead(b, 1.35));

  // ── the stern post curling up and over into a tail ──
  const st = hull.sternHead;
  const tail = curl([0, st[1] - 0.04, st[2] + 0.04], 1.05, -0.25, -2.6, 9);
  b.with({ color: WOOD_DARK, ink: 'tail' }, () => tube(b, tail, tail.map((_, i) => 0.08 - i * 0.0065), { seg: 6 }));

  // ── the shields along each side, overlapping a little, each its own outline ──
  const n = 9;
  for (const side of [1, -1] as const) {
    for (let i = 0; i < n; i++) {
      const t = 0.2 + (0.6 * i) / (n - 1);
      const y = hull.sheer(t) - 0.07;
      const x = hull.outer(t, y) + 0.03;
      const z = hull.z(t, y);
      const pair = SHIELD_PAIRS[(i + look + (side > 0 ? 0 : 2)) % SHIELD_PAIRS.length]!;
      b.at(compose(translation(side * x, y, z), rotationY((side * Math.PI) / 2), rotationX(-0.12)), () => drawShield(b, 0.17, pair, `shield-${side}-${i}`));
    }
  }

  // ── the mast, stays, the steering oar ──
  b.with({ color: WOOD, ink: 'mast' }, () => b.at(translation(0, 0.08, LONGSHIP.mastZ), () => b.lathe([[0.065, 0], [0.05, LONGSHIP.yardY + 0.25]], { segments: 8, capTop: true })));
  b.with({ color: '#c9b48a', ink: 'stays' }, () => {
    const head: Vec3 = [0, LONGSHIP.yardY + 0.15, LONGSHIP.mastZ];
    stick(b, head, [0, hull.sheer(0.97), hull.z(0.97, hull.sheer(0.97))], 0.018);
    stick(b, head, [0, hull.sheer(0.04), hull.z(0.04, hull.sheer(0.04))], 0.018);
    for (const side of [1, -1]) stick(b, head, [side * (hull.outer(0.45, 0.28) - 0.02), 0.3, -0.35], 0.016);
  });
  b.with({ ink: 'steering' }, () => {
    const at = hull.z(0.1, 0.4);
    const x = hull.outer(0.1, 0.35) + 0.05;
    b.setColor(WOOD);
    stick(b, [x, 0.75, at + 0.05], [x + 0.08, -0.05, at - 0.12], 0.05);
    b.setColor(SAIL_RED);
    stick(b, [x + 0.08, -0.05, at - 0.12], [x + 0.1, -0.3, at - 0.2], 0.03, 0.16);
  });
}

/** A rowing boat for the raiders: a plain boat with a red strake, a little curled stem and two shields a side. */
export function raidBoatMesh(look = 0): MeshData {
  const b = new MeshBuilder({ ink: `raid-boat-${look}` });
  const hull = drawHull(b, BOAT_SPEC, { bottom: TAR, topsides: WOOD, strake: SAIL_RED, rail: WOOD_DARK, inside: '#a87a4c', sole: '#9b6e42' });
  b.with({ color: WOOD_DARK, ink: 'benches', pattern: PATTERN.planks }, () => {
    for (const z of [-0.5, 0.05, 0.55]) {
      const x = hull.inner(hull.t(z), 0.12) + 0.01;
      if (x > 0.05) b.box([-x, 0.1, z - 0.06], [x, 0.125, z + 0.06], { skip: ['w', 'e'] });
    }
  });
  const stem = hull.stemHead;
  const neck = curl([0, stem[1] - 0.03, stem[2] - 0.03], 0.32, 0.3, 1.6, 5);
  b.with({ color: WOOD_DARK, ink: 'stem-curl' }, () => tube(b, neck, neck.map((_, i) => 0.05 - i * 0.006), { seg: 5 }));
  for (const side of [1, -1] as const) {
    for (let i = 0; i < 2; i++) {
      const t = 0.32 + 0.3 * i;
      const y = hull.sheer(t) - 0.05;
      const x = hull.outer(t, y) + 0.025;
      const z = hull.z(t, y);
      b.at(compose(translation(side * x, y, z), rotationY((side * Math.PI) / 2), rotationX(-0.1)), () => drawShield(b, 0.13, SHIELD_PAIRS[(i * 2 + look + (side > 0 ? 1 : 0)) % SHIELD_PAIRS.length]!, `shield-${side}-${i}`));
    }
  }
  return b.build();
}

/** The heap of loot amidships (sacks, a chest, a barrel), shown more and more as it grows: `n` 1–3 pieces. */
export function lootHeapMesh(n: number, size = 1): MeshData {
  const b = new MeshBuilder({ ink: `loot-heap-${n}-${size}` });
  b.at(scaling(size, size, size), () => {
    if (n >= 1) {
      // A chest: a box with a curved lid, iron bands.
      b.setInk('chest').setColor('#8b4a26').setPattern(PATTERN.planks);
      b.box([-0.14, 0.14, -0.3], [0.14, 0.3, -0.06]);
      b.at(compose(translation(0, 0.3, -0.18), rotationZ(Math.PI / 2)), () => b.lathe([[0.14, -0.12], [0.14, 0.12]], { segments: 8, start: 0, sweep: Math.PI, capTop: true, capBottom: true }));
      b.setInk('chest-bands').setColor('#c9a23a').setPattern(PATTERN.metal);
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
