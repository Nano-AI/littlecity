// The courts' markings and the little things baked into them (R-G03): one
// function per court type, all drawn in the court's own (u, v) frame (see
// field.lib.ts). Not a generator file: field.gen.ts calls these.
//
// The look: flat colour, chalk lines ruled by hand (they wander a hair and
// thicken and thin), worn ground where players stand most. Every layer lies
// a hair above the last (COURT.layer) so no two faces share a plane; all of
// it is the field's one ink group, so it reads as paint, not as pieces. The
// few standing things (corner flags, croquet hoops, a boules board, a pile
// of jumpers for goalposts) are their own ink groups and get outlines.

import type { Vec3 } from '@/core/mat4';
import { hash, rand } from '@/core/rand';
import { type MeshBuilder, PATTERN } from '@/gen/mesh';
import { mixColor, type Rgb } from '@/parts/ground/kit';
import { courtPoint, goalOf, hoopOf, tennisOf, type Court } from '@/rules/roles/field.lib';
import { COURT } from '@/style/field';
import { PALETTE } from '@/style/palette';
import { upTri } from './sheet';

type UV = readonly [number, number];
type Color = string | Rgb;

export interface CourtCtx {
  b: MeshBuilder;
  c: Court;
  seed: number;
  /** Height of the slab's top (world). */
  y: number;
}

const at = (k: CourtCtx, u: number, v: number, lift: number): Vec3 => {
  const [x, z] = courtPoint(k.c, u, v);
  return [x, k.y + lift, z];
};
const layer = (n: number): number => COURT.layer * n;

/** A filled rectangle in court terms. */
export function patch(k: CourtCtx, u0: number, v0: number, u1: number, v1: number, color: Color, lift: number, pattern: number = PATTERN.none): void {
  k.b.with({ color, pattern }, () => {
    upTri(k.b, at(k, u0, v0, lift), at(k, u1, v0, lift), at(k, u1, v1, lift));
    upTri(k.b, at(k, u0, v0, lift), at(k, u1, v1, lift), at(k, u0, v1, lift));
  });
}

/** A filled disc, or a slice of one (angles about the u axis, toward +v). */
export function disc(k: CourtCtx, cu: number, cv: number, r: number, color: Color, lift: number, a0 = 0, a1 = Math.PI * 2, seg = 20, ry = r): void {
  k.b.with({ color, pattern: PATTERN.none }, () => {
    const n = Math.max(3, Math.ceil((seg * (a1 - a0)) / (Math.PI * 2)));
    for (let i = 0; i < n; i++) {
      const t0 = a0 + ((a1 - a0) * i) / n, t1 = a0 + ((a1 - a0) * (i + 1)) / n;
      upTri(k.b, at(k, cu, cv, lift), at(k, cu + Math.cos(t0) * r, cv + Math.sin(t0) * ry, lift), at(k, cu + Math.cos(t1) * r, cv + Math.sin(t1) * ry, lift));
    }
  });
}

/** A worn patch: a soft blot of `color` with a ragged edge (where players stand most). */
export function worn(k: CourtCtx, cu: number, cv: number, ru: number, rv: number, color: Color, lift: number): void {
  const n = 9;
  const s = hash(k.seed, Math.round(cu * 100), Math.round(cv * 100), 'worn');
  k.b.with({ color, pattern: PATTERN.dirt }, () => {
    for (let i = 0; i < n; i++) {
      const t0 = (i / n) * Math.PI * 2, t1 = ((i + 1) / n) * Math.PI * 2;
      const r0 = 0.8 + rand(s, i) * 0.35, r1 = 0.8 + rand(s, (i + 1) % n) * 0.35;
      upTri(k.b, at(k, cu, cv, lift), at(k, cu + Math.cos(t0) * ru * r0, cv + Math.sin(t0) * rv * r0, lift), at(k, cu + Math.cos(t1) * ru * r1, cv + Math.sin(t1) * rv * r1, lift));
    }
  });
}

/**
 * A chalk line from a to b, ruled by hand: it wanders a hair off the straight and thickens and thins
 * along its length. Points along it are shared, so it has no gaps.
 */
export function chalk(k: CourtCtx, a: UV, b: UV, lift = layer(3), width: number = COURT.line, color: Color = COURT.chalk): void {
  const du = b[0] - a[0], dv = b[1] - a[1];
  const len = Math.hypot(du, dv);
  if (len < 1e-4) return;
  const nu = -dv / len, nv = du / len;
  const n = Math.max(1, Math.ceil(len / 0.22));
  const s = hash(k.seed, Math.round(a[0] * 97), Math.round(a[1] * 89), Math.round(b[0] * 83), Math.round(b[1] * 79));
  const pts: [Vec3, Vec3][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const ends = i === 0 || i === n ? 0 : 1;
    const off = (rand(s, i, 'wob') - 0.5) * 2 * COURT.wobble * ends;
    const w = (width / 2) * (0.8 + rand(s, i, 'w') * 0.4);
    const u = a[0] + du * t + nu * off, v = a[1] + dv * t + nv * off;
    pts.push([at(k, u - nu * w, v - nv * w, lift), at(k, u + nu * w, v + nv * w, lift)]);
  }
  k.b.with({ color, pattern: PATTERN.none }, () => {
    for (let i = 0; i < n; i++) {
      const [l0, r0] = pts[i]!, [l1, r1] = pts[i + 1]!;
      upTri(k.b, l0, r0, r1);
      upTri(k.b, l0, r1, l1);
    }
  });
}

/** A chalk arc round (cu, cv) of radius r, from angle a0 to a1 (radians about +u toward +v). */
export function chalkArc(k: CourtCtx, cu: number, cv: number, r: number, a0: number, a1: number, lift = layer(3), width: number = COURT.line): void {
  const n = Math.max(3, Math.ceil(Math.abs(a1 - a0) * r * 9));
  for (let i = 0; i < n; i++) {
    const t0 = a0 + ((a1 - a0) * i) / n, t1 = a0 + ((a1 - a0) * (i + 1)) / n;
    chalk(k, [cu + Math.cos(t0) * r, cv + Math.sin(t0) * r], [cu + Math.cos(t1) * r, cv + Math.sin(t1) * r], lift, width);
  }
}

/** The outer lines of a court. */
function boundary(k: CourtCtx, hl = k.c.hl, hw = k.c.hw): void {
  const w = COURT.line / 2;
  chalk(k, [-hl - w, -hw], [hl + w, -hw]);
  chalk(k, [-hl - w, hw], [hl + w, hw]);
  chalk(k, [-hl, -hw], [-hl, hw]);
  chalk(k, [hl, -hw], [hl, hw]);
}

/** Mown stripes across the court: bands of `stripe` on `base`, `band` long. */
function stripes(k: CourtCtx, base: Color, stripe: Color, band: number, hl = k.c.rl - 0.04, hw = k.c.rw - 0.04): void {
  patch(k, -hl, -hw, hl, hw, base, layer(1), PATTERN.grass);
  const n = Math.max(2, Math.round((hl * 2) / band));
  const step = (hl * 2) / n;
  for (let i = 0; i < n; i += 2) patch(k, -hl + i * step, -hw, -hl + (i + 1) * step, hw, stripe, layer(2), PATTERN.grass);
}

// ───────────────────────────────────────────────────────────── courts ──

export function basketball(k: CourtCtx): void {
  const { hl, hw } = k.c;
  patch(k, -hl - 0.06, -hw - 0.06, hl + 0.06, hw + 0.06, COURT.hard, layer(1));
  const hoop = hoopOf(k.c);
  const keyLen = Math.min(0.72, hl * 0.42), kw = Math.min(0.27, hw * 0.33);
  const r3 = Math.min(hw * 0.86, hl * 0.62, 1.0);
  for (const s of [-1, 1]) {
    // The painted key, worn pale under the hoop where everybody jumps.
    patch(k, s * hl, -kw, s * (hl - keyLen), kw, COURT.hardKey, layer(2));
    worn(k, s * (hl - 0.32), 0, 0.22, 0.17, mixColor(COURT.hardKey, PALETTE.white, 0.3), layer(2) + 0.001);
    chalk(k, [s * hl, -kw], [s * (hl - keyLen), -kw]);
    chalk(k, [s * hl, kw], [s * (hl - keyLen), kw]);
    chalk(k, [s * (hl - keyLen), -kw], [s * (hl - keyLen), kw]);
    // The free-throw circle, toward the middle.
    chalkArc(k, s * (hl - keyLen), 0, kw, s > 0 ? Math.PI / 2 : -Math.PI / 2, s > 0 ? Math.PI * 1.5 : Math.PI / 2);
    // The three-point line: straight from the baseline, then round the hoop.
    const ru = s * hoop.u;
    if (r3 < hw - 0.04) {
      chalk(k, [s * hl, -r3], [ru, -r3]);
      chalk(k, [s * hl, r3], [ru, r3]);
      chalkArc(k, ru, 0, r3, s > 0 ? Math.PI / 2 : -Math.PI / 2, s > 0 ? Math.PI * 1.5 : Math.PI / 2);
    } else chalkArc(k, ru, 0, r3 * 0.9, s > 0 ? Math.PI * 0.62 : -Math.PI * 0.38, s > 0 ? Math.PI * 1.38 : Math.PI * 0.38);
  }
  // The middle: the line across and the circle, painted in.
  const rc = Math.min(0.3, hw * 0.3);
  disc(k, 0, 0, rc, COURT.hardKey, layer(2));
  chalkArc(k, 0, 0, rc, 0, Math.PI * 2);
  chalk(k, [0, -hw], [0, hw]);
  boundary(k);
}

export function tennis(k: CourtCtx): void {
  const { hl, hw } = k.c;
  const grass = k.c.surface === 'grass';
  const t = tennisOf(k.c);
  if (grass) stripes(k, COURT.grass, COURT.grassStripe, 0.5, hl + 0.08, hw + 0.08);
  else patch(k, -hl - 0.08, -hw - 0.08, hl + 0.08, hw + 0.08, COURT.clay, layer(1), PATTERN.sand);
  // Worn where the server stands and behind the service boxes.
  const wear = grass ? COURT.worn : mixColor(COURT.clay, COURT.clayRunoff, 0.9);
  for (const s of [-1, 1]) {
    worn(k, s * (hl - 0.06), 0.05, 0.16, 0.24, wear, layer(2) + 0.001);
    worn(k, s * (hl - 0.06), -t.singles * 0.55, 0.12, 0.16, wear, layer(2) + 0.001);
  }
  boundary(k);
  if (t.singles < hw - 0.02) {
    chalk(k, [-hl, -t.singles], [hl, -t.singles]);
    chalk(k, [-hl, t.singles], [hl, t.singles]);
  }
  for (const s of [-1, 1]) {
    chalk(k, [s * t.service, -t.singles], [s * t.service, t.singles]);
    // The centre mark on the baseline.
    chalk(k, [s * hl, 0], [s * (hl - 0.07), 0]);
  }
  chalk(k, [-t.service, 0], [t.service, 0]);
}

export function football(k: CourtCtx): void {
  const { hl, hw } = k.c;
  stripes(k, COURT.grass, COURT.grassStripe, 0.55);
  const goal = goalOf(k.c);
  const boxD = Math.min(0.75, hl * 0.28), boxW = Math.min(hw * 0.62, goal.half + 0.55);
  const sixD = boxD * 0.4, sixW = goal.half + 0.14;
  for (const s of [-1, 1]) {
    worn(k, s * (hl - 0.12), 0, 0.2, goal.half * 0.9, COURT.worn, layer(2) + 0.001);
    chalk(k, [s * hl, -boxW], [s * (hl - boxD), -boxW]);
    chalk(k, [s * hl, boxW], [s * (hl - boxD), boxW]);
    chalk(k, [s * (hl - boxD), -boxW], [s * (hl - boxD), boxW]);
    chalk(k, [s * hl, -sixW], [s * (hl - sixD), -sixW]);
    chalk(k, [s * hl, sixW], [s * (hl - sixD), sixW]);
    chalk(k, [s * (hl - sixD), -sixW], [s * (hl - sixD), sixW]);
    // The penalty spot and the arc outside the box.
    disc(k, s * (hl - boxD * 0.7), 0, 0.03, COURT.chalk, layer(3), 0, Math.PI * 2, 8);
    const ra = boxD * 0.45;
    const lim = Math.acos(Math.min(1, (boxD * 0.3) / ra));
    chalkArc(k, s * (hl - boxD * 0.7), 0, ra, s > 0 ? Math.PI - lim : -lim, s > 0 ? Math.PI + lim : lim);
    // Corner arcs.
    for (const t of [-1, 1]) chalkArc(k, s * hl, t * hw, 0.1, s > 0 ? (t > 0 ? Math.PI : Math.PI / 2) : t > 0 ? -Math.PI / 2 : 0, s > 0 ? (t > 0 ? Math.PI * 1.5 : Math.PI) : t > 0 ? 0 : Math.PI / 2);
  }
  const rc = Math.min(0.45, hw * 0.34);
  chalkArc(k, 0, 0, rc, 0, Math.PI * 2);
  disc(k, 0, 0, 0.03, COURT.chalk, layer(3), 0, Math.PI * 2, 8);
  chalk(k, [0, -hw], [0, hw]);
  boundary(k);
  // Corner flags: a white pole and a red pennant that stirs in the wind.
  for (const s of [-1, 1]) for (const t of [-1, 1]) cornerFlag(k, s * hl, t * hw, s, rand(k.seed, s, t, 'flag') < 0.5 ? PALETTE.red : PALETTE.yellow);
}

function cornerFlag(k: CourtCtx, u: number, v: number, s: number, color: string): void {
  const [x, z] = courtPoint(k.c, u, v);
  const b = k.b;
  const h = 0.3;
  b.with({ color: PALETTE.white, pattern: PATTERN.none, ink: 'flag-pole' }, () => b.boxAt([x, k.y, z], [0.018, h, 0.018]));
  // The pennant: a triangle off the top, toward the middle of the pitch.
  const [fx, fz] = courtPoint(k.c, u - s * 0.12, v);
  b.with({ color, pattern: PATTERN.cloth, ink: 'flag', sway: (_x, y) => Math.max(0, Math.min(1, (y - (k.y + h - 0.1)) * 8)) }, () => {
    const p0: Vec3 = [x, k.y + h, z], p1: Vec3 = [x, k.y + h - 0.09, z], p2: Vec3 = [fx, k.y + h - 0.04, fz];
    b.tri(p0, p1, p2);
    b.tri(p0, p2, p1);
  });
}

export function bowls(k: CourtCtx): void {
  const { rl, rw } = k.c;
  // The ditch round the green, then the green itself, close-cut in faint squares.
  patch(k, -rl + 0.03, -rw + 0.03, rl - 0.03, rw - 0.03, COURT.ditch, layer(1), PATTERN.dirt);
  const e = 0.13;
  patch(k, -rl + e, -rw + e, rl - e, rw - e, COURT.green, layer(2), PATTERN.grass);
  const n = Math.max(2, Math.round(rl * 2));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < Math.max(2, Math.round(rw * 2)); j++) {
      if ((i + j) % 2) continue;
      const u0 = -rl + e + ((rl - e) * 2 * i) / n, u1 = -rl + e + ((rl - e) * 2 * (i + 1)) / n;
      const m = Math.max(2, Math.round(rw * 2));
      const v0 = -rw + e + ((rw - e) * 2 * j) / m, v1 = -rw + e + ((rw - e) * 2 * (j + 1)) / m;
      patch(k, u0, v0, u1, v1, mixColor(COURT.green, PALETTE.white, 0.1), layer(3), PATTERN.grass);
    }
  }
  // Rink markers on the bank at each end, and the mat a bowler stands on.
  for (const s of [-1, 1]) {
    for (const t of [-0.5, 0.5]) {
      const [x, z] = courtPoint(k.c, s * (rl - 0.07), t * rw);
      k.b.with({ color: PALETTE.white, pattern: PATTERN.none, ink: 'markers' }, () => k.b.boxAt([x, k.y, z], [0.03, 0.05, 0.03]));
    }
    patch(k, s * (rl - e - 0.3), -0.06, s * (rl - e - 0.18), 0.06, '#5c5a52', layer(4));
  }
}

export function croquet(k: CourtCtx): void {
  const { hl, hw } = k.c;
  stripes(k, COURT.grass, COURT.grassStripe, 0.45);
  boundary(k);
  // Six white hoops and the striped peg in the middle.
  const hoops: UV[] = [[-hl * 0.55, -hw * 0.55], [-hl * 0.55, hw * 0.55], [hl * 0.55, -hw * 0.55], [hl * 0.55, hw * 0.55], [-hl * 0.2, 0], [hl * 0.2, 0]];
  for (const [u, v] of hoops) {
    const [x0, z0] = courtPoint(k.c, u, v - 0.05), [x1, z1] = courtPoint(k.c, u, v + 0.05);
    k.b.with({ color: PALETTE.white, pattern: PATTERN.metal, ink: 'hoops' }, () => {
      k.b.boxAt([x0, k.y, z0], [0.012, 0.08, 0.012]);
      k.b.boxAt([x1, k.y, z1], [0.012, 0.08, 0.012]);
      const xm = (x0 + x1) / 2, zm = (z0 + z1) / 2;
      const ax = Math.abs(x1 - x0) + 0.012, az = Math.abs(z1 - z0) + 0.012;
      k.b.box([xm - ax / 2, k.y + 0.08, zm - az / 2], [xm + ax / 2, k.y + 0.094, zm + az / 2]);
    });
  }
  const [px, pz] = courtPoint(k.c, 0, 0);
  const colours = [PALETTE.glass, PALETTE.red, '#3a3a40', PALETTE.yellow];
  k.b.push().translate(px, 0, pz);
  colours.forEach((col, i) => k.b.with({ color: col, pattern: PATTERN.none, ink: 'peg' }, () => k.b.lathe([[0.016, k.y + i * 0.03], [0.016, k.y + (i + 1) * 0.03]], { segments: 8, capTop: i === colours.length - 1 })));
  k.b.pop();
}

export function boules(k: CourtCtx): void {
  const { rl, rw } = k.c;
  patch(k, -rl + 0.05, -rw + 0.05, rl - 0.05, rw - 0.05, COURT.gravel, layer(1), PATTERN.sand);
  // Raked lines along it.
  for (const t of [-0.5, 0, 0.5]) patch(k, -rl + 0.12, t * rw * 0.7 - 0.006, rl - 0.12, t * rw * 0.7 + 0.006, mixColor(COURT.gravel, PALETTE.dirtDark, 0.35), layer(2));
  // Timber boards round the edge (low, so it reads from above).
  const h = 0.05, t = 0.04;
  k.b.with({ color: COURT.timber, pattern: PATTERN.planks, ink: 'boards' }, () => {
    for (const s of [-1, 1]) {
      const a = courtPoint(k.c, -rl + 0.02, s * (rw - 0.02 - t / 2)), b = courtPoint(k.c, rl - 0.02, s * (rw - 0.02 - t / 2));
      box2(k, a, b, t, h);
      const c = courtPoint(k.c, s * (rl - 0.02 - t / 2), -rw + 0.02 + t), d = courtPoint(k.c, s * (rl - 0.02 - t / 2), rw - 0.02 - t);
      box2(k, c, d, t, h);
    }
  });
}

/** A low box from a to b (world x, z), t thick, h high, on the slab. */
function box2(k: CourtCtx, a: readonly [number, number], b: readonly [number, number], t: number, h: number): void {
  const x0 = Math.min(a[0], b[0]) - (a[0] === b[0] ? t / 2 : 0), x1 = Math.max(a[0], b[0]) + (a[0] === b[0] ? t / 2 : 0);
  const z0 = Math.min(a[1], b[1]) - (a[1] === b[1] ? t / 2 : 0), z1 = Math.max(a[1], b[1]) + (a[1] === b[1] ? t / 2 : 0);
  k.b.box([x0, k.y, z0], [x1, k.y + h, z1], { skip: ['bottom'] });
}

export function track(k: CourtCtx): void {
  const { hl, hw } = k.c;
  patch(k, -k.c.rl + 0.04, -hw - 0.06, k.c.rl - 0.04, hw + 0.06, COURT.track, layer(1), PATTERN.sand);
  const lanes = Math.max(1, Math.round((hw * 2) / 0.42));
  for (let i = 0; i <= lanes; i++) {
    const v = -hw + (hw * 2 * i) / lanes;
    chalk(k, [-hl, v], [hl, v]);
  }
  // Start and finish: the start a plain line, the finish chequered.
  chalk(k, [-hl + 0.15, -hw], [-hl + 0.15, hw]);
  const sq = 0.05;
  for (let i = 0; i * sq < hw * 2 - 1e-6; i++) {
    for (let j = 0; j < 2; j++) {
      const v0 = -hw + i * sq, u0 = hl - 0.2 + j * sq;
      patch(k, u0, v0, u0 + sq, Math.min(hw, v0 + sq), (i + j) % 2 ? '#3a3a40' : COURT.chalk, layer(3));
    }
  }
}

export function green(k: CourtCtx): void {
  const { hl, hw } = k.c;
  // Bald where the goals are, a pile of jumpers either side of each.
  for (const s of [-1, 1]) {
    worn(k, s * (hl - 0.05), 0, Math.min(0.3, hl * 0.3), Math.min(0.32, hw * 0.6), COURT.worn, layer(1));
    if (hl < 0.3) continue;
    for (const t of [-1, 1]) jumper(k, s * (hl - 0.02), t * Math.min(0.3, hw * 0.55), hash(k.seed, s, t));
  }
  worn(k, 0, 0, Math.min(0.25, hl * 0.4), Math.min(0.2, hw * 0.4), mixColor(COURT.grass, COURT.worn, 0.5), layer(1) + 0.001);
}

const JUMPERS = ['#e56b58', '#6d8ccf', '#f6d77c', '#7cbf9b', '#9a92b8', '#f4a3bf'];
/** A jumper dropped in a heap for a goalpost. */
function jumper(k: CourtCtx, u: number, v: number, seed: number): void {
  const [x, z] = courtPoint(k.c, u, v);
  const col = JUMPERS[Math.floor(rand(seed, 'col') * JUMPERS.length)]!;
  k.b.with({ color: col, pattern: PATTERN.cloth, ink: `jumper-${seed % 97}` }, () => {
    const r = 0.06;
    const pts = 7;
    const y = k.y;
    for (let i = 0; i < pts; i++) {
      const a0 = (i / pts) * Math.PI * 2, a1 = ((i + 1) / pts) * Math.PI * 2;
      const r0 = r * (0.75 + rand(seed, i) * 0.4), r1 = r * (0.75 + rand(seed, (i + 1) % pts) * 0.4);
      k.b.tri([x, y + 0.035, z], [x + Math.cos(a1) * r1, y + 0.002, z + Math.sin(a1) * r1 * 0.8], [x + Math.cos(a0) * r0, y + 0.002, z + Math.sin(a0) * r0 * 0.8]);
    }
    // A sleeve flung out.
    const a = rand(seed, 'sleeve') * Math.PI * 2;
    k.b.tri([x, y + 0.02, z], [x + Math.cos(a + 0.2) * r * 1.7, y + 0.004, z + Math.sin(a + 0.2) * r * 1.7], [x + Math.cos(a - 0.2) * r * 1.7, y + 0.004, z + Math.sin(a - 0.2) * r * 1.7]);
  });
}

export const MARKINGS: Record<Court['role'], (k: CourtCtx) => void> = {
  'basketball-court': basketball,
  'tennis-court': tennis,
  'football-pitch': football,
  'bowling-green': bowls,
  'croquet-lawn': croquet,
  'boules-court': boules,
  'running-track': track,
  'kickabout-green': green,
};
