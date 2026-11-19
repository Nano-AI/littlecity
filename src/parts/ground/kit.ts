// The Ground owner's drawing kit: the small shapes every ground generator and
// part is made of (trees, gardens, fences, docks, fountains, stalls).
//
// Two ideas carry the look (docs/swarm/ART.md):
//
//  1. FLAT TONES. The renderer steps a surface's tone from its normal, and
//     inks a crease where the normal turns. A lump given one normal for all
//     of its vertices is therefore drawn as ONE flat tone with no banding,
//     and two lumps that share a normal melt into one shape with no line
//     between them. `TONE` holds normals that land exactly on the shader's
//     light, mid and shade steps, so foliage is drawn as a light mass and a
//     shaded mass (which the shader hatches), not as shaded balls.
//  2. COLOUR DABS. A small thing whose normal matches the surface it sits on
//     (a flower head on a bed, a fruit on a crown) gets no outline of its
//     own: it is a dab of colour, which is what survives at playing zoom.
//
// Everything here is pure and seeded; nothing reads the clock.

import type { Vec3 } from '@/core/mat4';
import { rand } from '@/core/rand';
import { parseColor, type ColorInput, type MeshBuilder } from '@/gen/mesh';

export type Rgb = [number, number, number];
/** Seeded chance for one piece: `r('lean')`, `r('petal', i)`. */
export type Rng = (...parts: (number | string)[]) => number;
export const rngOf = (seed: number): Rng => (...parts) => rand(seed, ...parts);

const clamp255 = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));

/** A palette colour nudged a little lighter or darker and warmer or cooler, so no two plants match. */
export function vary(c: ColorInput, r: number, amount = 1): Rgb {
  const [cr, cg, cb] = parseColor(c);
  const light = 1 + (r - 0.5) * 0.12 * amount;
  const warm = (((r * 7.31) % 1) - 0.5) * 10 * amount;
  return [clamp255(cr * light + warm), clamp255(cg * light), clamp255(cb * light - warm)];
}

/** A colour between two palette colours. */
export function mixColor(a: ColorInput, b: ColorInput, t: number): Rgb {
  const [ar, ag, ab] = parseColor(a);
  const [br, bg, bb] = parseColor(b);
  return [clamp255(ar + (br - ar) * t), clamp255(ag + (bg - ag) * t), clamp255(ab + (bb - ab) * t)];
}

function unit(x: number, y: number, z: number): Vec3 {
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}

// The renderer's light is (0.35, 1, 0.6) normalised. Its tone steps fall at
// dot products 0.75 and 0.35 with the normal (src/render/shaders/surface.ts,
// toneOf), and it inks a crease where two normals are more than about 30°
// apart. These normals are the light direction tipped down toward the
// horizon by a chosen angle, so each lands inside one tone step:
//
//   lit ↔ mid     7° apart: a clean change of tone, no line
//   mid ↔ shade  25° apart: a change of tone, no line
//   lit ↔ shade  32° apart: a change of tone and a light pen line
//
// They all stay well below 0.8 in y, so patterns that ask "is this a top
// face" treat them as sides. They are WORLD directions: emit geometry that
// uses them under translations and uniform scales only, never a rotation.
const SUN_GROUND = Math.hypot(0.35, 0.6);
/** The direction the light comes from in the ground plane, [x, z], unit length. */
export const SUN: readonly [number, number] = [0.35 / SUN_GROUND, 0.6 / SUN_GROUND];
const SUN_ELEVATION = Math.atan2(1, SUN_GROUND);
const tipped = (degrees: number): Vec3 => {
  const e = SUN_ELEVATION - (degrees * Math.PI) / 180;
  return [Math.cos(e) * SUN[0], Math.sin(e), Math.cos(e) * SUN[1]];
};
/** Normals that draw as one flat tone each: the lit step, the half tone, the hatched shade. */
/**
 * Where shaded leaf masses sit round a crown, [x, z]: north and a little
 * east. The light comes from the south-south-east, and of the two flanks the
 * default view shows (south and east) the east is the darker, on houses too.
 */
export const SHADE_SIDE: readonly [number, number] = [0.37, -0.93];
export const TONE = {
  lit: tipped(38.5),
  mid: tipped(46),
  shade: tipped(71),
  /** Straight up: for dabs lying on a top face. */
  up: [0, 1, 0] as Vec3,
} as const;

export interface LumpOptions {
  /** Sides round the axis (default 8) and steps from pole to pole (default 5). */
  seg?: number;
  rings?: number;
  /**
   * One normal for the whole lump (a flat tone, see TONE), or a function of
   * the unit direction from the centre. Default: the true ellipsoid normal.
   */
  normal?: Vec3 | ((ux: number, uy: number, uz: number) => Vec3);
  /** Turn the rings a little so lumps do not line their facets up. */
  twist?: number;
  /**
   * Leave out the faces that look away from this direction (those whose own
   * direction from the centre has a dot product with it below `cut`, default
   * −0.25): the half of a scallop that is buried in the crown it grows from.
   */
  facing?: Vec3;
  cut?: number;
}

/** An ellipsoid centred on (cx, cy, cz): the leaf mass, the flower clump, the boulder. */
export function lump(b: MeshBuilder, cx: number, cy: number, cz: number, rx: number, ry = rx, rz = rx, opts: LumpOptions = {}): void {
  const seg = Math.max(3, opts.seg ?? 8);
  const rings = Math.max(2, opts.rings ?? 5);
  const twist = opts.twist ?? 0;
  const fixed = Array.isArray(opts.normal) ? (opts.normal as Vec3) : null;
  const fn = typeof opts.normal === 'function' ? opts.normal : null;
  const dir = (i: number, j: number): Vec3 => {
    const a = (i / rings) * Math.PI;
    const t = twist + (j / seg) * Math.PI * 2;
    const s = i === 0 || i === rings ? 0 : Math.sin(a);
    return [s * Math.cos(t), -Math.cos(a), s * Math.sin(t)];
  };
  const pos = (u: Vec3): Vec3 => [cx + u[0] * rx, cy + u[1] * ry, cz + u[2] * rz];
  const nor = (u: Vec3): Vec3 => (fixed ? fixed : fn ? fn(u[0], u[1], u[2]) : unit(u[0] / rx, u[1] / ry, u[2] / rz));
  const face = opts.facing;
  const cut = opts.cut ?? -0.25;
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < seg; j++) {
      const a = dir(i, j + 1), bb = dir(i, j), c = dir(i + 1, j), d = dir(i + 1, j + 1);
      if (face) {
        const m = unit(a[0] + bb[0] + c[0] + d[0], a[1] + bb[1] + c[1] + d[1], a[2] + bb[2] + c[2] + d[2]);
        if (m[0] * face[0] + m[1] * face[1] + m[2] * face[2] < cut) continue;
      }
      if (i === 0) b.tri(pos(a), pos(c), pos(d), { normals: [nor(a), nor(c), nor(d)] });
      else if (i === rings - 1) b.tri(pos(a), pos(bb), pos(c), { normals: [nor(a), nor(bb), nor(c)] });
      else b.quad(pos(a), pos(bb), pos(c), pos(d), { normals: [nor(a), nor(bb), nor(c), nor(d)] });
    }
  }
}

/** The upper half of a lump, open underneath: a mound, a dome, a clump sitting on the ground. */
export function mound(b: MeshBuilder, cx: number, cy: number, cz: number, rx: number, ry = rx, rz = rx, opts: LumpOptions = {}): void {
  const seg = Math.max(3, opts.seg ?? 8);
  const rings = Math.max(1, opts.rings ?? 3);
  const twist = opts.twist ?? 0;
  const fixed = Array.isArray(opts.normal) ? (opts.normal as Vec3) : null;
  const fn = typeof opts.normal === 'function' ? opts.normal : null;
  const dir = (i: number, j: number): Vec3 => {
    const a = (i / rings) * Math.PI * 0.5;
    const t = twist + (j / seg) * Math.PI * 2;
    const s = i === rings ? 0 : Math.cos(a);
    return [s * Math.cos(t), Math.sin(a), s * Math.sin(t)];
  };
  const pos = (u: Vec3): Vec3 => [cx + u[0] * rx, cy + u[1] * ry, cz + u[2] * rz];
  const nor = (u: Vec3): Vec3 => (fixed ? fixed : fn ? fn(u[0], u[1], u[2]) : unit(u[0] / rx, u[1] / ry + 0.001, u[2] / rz));
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < seg; j++) {
      const a = dir(i, j + 1), bb = dir(i, j), c = dir(i + 1, j), d = dir(i + 1, j + 1);
      if (i === rings - 1) b.tri(pos(a), pos(bb), pos(c), { normals: [nor(a), nor(bb), nor(c)] });
      else b.quad(pos(a), pos(bb), pos(c), pos(d), { normals: [nor(a), nor(bb), nor(c), nor(d)] });
    }
  }
}

/**
 * A dab of colour: a low cone whose every normal is `normal` (default up),
 * so on a surface with the same normal it has no outline, only its colour.
 */
export function dab(b: MeshBuilder, x: number, y: number, z: number, r: number, normal: Vec3 = TONE.up, sides = 5, rise = r * 0.6): void {
  const n = [normal, normal, normal] as const;
  for (let j = 0; j < sides; j++) {
    const t0 = (j / sides) * Math.PI * 2, t1 = ((j + 1) / sides) * Math.PI * 2;
    b.tri([x, y + rise, z], [x + r * Math.cos(t1), y, z + r * Math.sin(t1)], [x + r * Math.cos(t0), y, z + r * Math.sin(t0)], { normals: n });
  }
}

function basis(ax: number, ay: number, az: number): [Vec3, Vec3] {
  // Two unit vectors square to the axis (ax, ay, az).
  const ref: Vec3 = Math.abs(ay) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = unit(ay * ref[2] - az * ref[1], az * ref[0] - ax * ref[2], ax * ref[1] - ay * ref[0]);
  const v = unit(ay * u[2] - az * u[1], az * u[0] - ax * u[2], ax * u[1] - ay * u[0]);
  return [u, v];
}

export interface TubeOptions {
  seg?: number;
  /** One normal for every vertex (flat tone), instead of the round normals. */
  normal?: Vec3;
  /** Close the far end / the near end with a flat cap. */
  capEnd?: boolean;
  capStart?: boolean;
}

/**
 * A round stick through a list of points, with a radius at each: a trunk, a
 * bough, a rope, a rail, a bent stem. Rings are shared between sections, so
 * a curve has no cracks.
 */
export function tube(b: MeshBuilder, points: readonly Vec3[], radii: readonly number[] | number, opts: TubeOptions = {}): void {
  const seg = Math.max(3, opts.seg ?? 6);
  const n = points.length;
  if (n < 2) return;
  const radius = (i: number): number => (typeof radii === 'number' ? radii : radii[Math.min(i, radii.length - 1)]!);
  const rings: Vec3[][] = [];
  const normals: Vec3[][] = [];
  // One frame for the whole stick, from its overall direction, so rings line up.
  const first = points[0]!, last = points[n - 1]!;
  const [u, v] = basis(...unit(last[0] - first[0], last[1] - first[1], last[2] - first[2]));
  for (let i = 0; i < n; i++) {
    const p = points[i]!, r = radius(i);
    const ring: Vec3[] = [], nor: Vec3[] = [];
    for (let j = 0; j < seg; j++) {
      const t = (j / seg) * Math.PI * 2;
      const dx = u[0] * Math.cos(t) + v[0] * Math.sin(t), dy = u[1] * Math.cos(t) + v[1] * Math.sin(t), dz = u[2] * Math.cos(t) + v[2] * Math.sin(t);
      ring.push([p[0] + dx * r, p[1] + dy * r, p[2] + dz * r]);
      nor.push(opts.normal ?? [dx, dy, dz]);
    }
    rings.push(ring);
    normals.push(nor);
  }
  // Which way round faces out depends on the handedness of (u, v, axis).
  const ax = unit(last[0] - first[0], last[1] - first[1], last[2] - first[2]);
  const hand = (u[1] * v[2] - u[2] * v[1]) * ax[0] + (u[2] * v[0] - u[0] * v[2]) * ax[1] + (u[0] * v[1] - u[1] * v[0]) * ax[2];
  for (let i = 0; i + 1 < n; i++) {
    for (let j = 0; j < seg; j++) {
      const k = (j + 1) % seg;
      const a = rings[i]![j]!, bq = rings[i]![k]!, c = rings[i + 1]![k]!, d = rings[i + 1]![j]!;
      const na = normals[i]![j]!, nb = normals[i]![k]!, nc = normals[i + 1]![k]!, nd = normals[i + 1]![j]!;
      if (hand > 0) b.quad(a, bq, c, d, { normals: [na, nb, nc, nd] });
      else b.quad(bq, a, d, c, { normals: [nb, na, nd, nc] });
    }
  }
  const cap = (i: number, outward: number): void => {
    const p = points[i]!;
    const nn: Vec3 = opts.normal ?? [ax[0] * outward, ax[1] * outward, ax[2] * outward];
    for (let j = 0; j < seg; j++) {
      const k = (j + 1) % seg;
      const a = rings[i]![j]!, c = rings[i]![k]!;
      if (hand * outward < 0) b.tri(p, a, c, { normals: [nn, nn, nn] });
      else b.tri(p, c, a, { normals: [nn, nn, nn] });
    }
  };
  if (opts.capEnd && radius(n - 1) > 0) cap(n - 1, 1);
  if (opts.capStart && radius(0) > 0) cap(0, -1);
}

/**
 * A leaf blade: a ribbon through `points` with a half-width at each, drawn on
 * both faces (a hair apart, so neither hides the other). `up` is roughly the
 * blade's face normal. A palm frond, a reed, a flag iris.
 */
export function blade(b: MeshBuilder, points: readonly Vec3[], halfWidths: readonly number[], up: Vec3 = [0, 1, 0], normal?: Vec3, underNormal: Vec3 | undefined = normal): void {
  const n = points.length;
  if (n < 2) return;
  const left: Vec3[] = [], right: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const p = points[i]!;
    const q = points[Math.min(i + 1, n - 1)]!, o = points[Math.max(i - 1, 0)]!;
    const t = unit(q[0] - o[0], q[1] - o[1], q[2] - o[2]);
    // side = t × up
    const s = unit(t[1] * up[2] - t[2] * up[1], t[2] * up[0] - t[0] * up[2], t[0] * up[1] - t[1] * up[0]);
    const w = halfWidths[Math.min(i, halfWidths.length - 1)]!;
    left.push([p[0] - s[0] * w, p[1] - s[1] * w, p[2] - s[2] * w]);
    right.push([p[0] + s[0] * w, p[1] + s[1] * w, p[2] + s[2] * w]);
  }
  const lift = 0.008;
  const under = (p: Vec3): Vec3 => [p[0] - up[0] * lift, p[1] - up[1] * lift, p[2] - up[2] * lift];
  for (let i = 0; i + 1 < n; i++) {
    const a = left[i]!, c = right[i]!, d = right[i + 1]!, e = left[i + 1]!;
    const opts = normal ? { normals: [normal, normal, normal, normal] as const } : undefined;
    const uopts = underNormal ? { normals: [underNormal, underNormal, underNormal, underNormal] as const } : undefined;
    // The top face is counter-clockwise seen from `up`; the under face is the same quad reversed, a hair lower.
    const facing = ((c[1] - a[1]) * (e[2] - a[2]) - (c[2] - a[2]) * (e[1] - a[1])) * up[0] +
      ((c[2] - a[2]) * (e[0] - a[0]) - (c[0] - a[0]) * (e[2] - a[2])) * up[1] +
      ((c[0] - a[0]) * (e[1] - a[1]) - (c[1] - a[1]) * (e[0] - a[0])) * up[2];
    if (facing >= 0) {
      b.quad(a, c, d, e, opts);
      b.quad(under(e), under(d), under(c), under(a), uopts);
    } else {
      b.quad(e, d, c, a, opts);
      b.quad(under(a), under(c), under(d), under(e), uopts);
    }
  }
}

/** A square post with a little pyramid cap, standing on (x, y, z). */
export function post(b: MeshBuilder, x: number, y: number, z: number, w: number, h: number, cap = w * 0.7): void {
  const s = w / 2;
  b.box([x - s, y, z - s], [x + s, y + h, z + s], { skip: cap > 0 ? ['bottom', 'top'] : ['bottom'] });
  if (cap > 0) {
    const t: Vec3 = [x, y + h + cap, z];
    const c: Vec3[] = [[x - s, y + h, z + s], [x + s, y + h, z + s], [x + s, y + h, z - s], [x - s, y + h, z - s]];
    for (let i = 0; i < 4; i++) b.tri(c[i]!, c[(i + 1) % 4]!, t);
  }
}

/**
 * The outline of a rectangle with rounded corners, as [x, z] points for
 * `extrude` or a fan. `r` is one radius or four: [x0z0, x1z0, x1z1, x0z1].
 */
export function roundedRect(x0: number, z0: number, x1: number, z1: number, r: number | readonly [number, number, number, number], steps = 4): [number, number][] {
  const rr = typeof r === 'number' ? [r, r, r, r] : r;
  const out: [number, number][] = [];
  const corner = (cx: number, cz: number, rad: number, a0: number): void => {
    if (rad <= 0) {
      out.push([cx, cz]);
      return;
    }
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (i / steps) * Math.PI * 0.5;
      out.push([cx + Math.cos(a) * rad, cz + Math.sin(a) * rad]);
    }
  };
  // Clockwise seen from above in (x, z) with z down the page: x0z0 → x1z0 → x1z1 → x0z1.
  corner(x0 + rr[0]!, z0 + rr[0]!, rr[0]!, Math.PI);
  corner(x1 - rr[1]!, z0 + rr[1]!, rr[1]!, Math.PI * 1.5);
  corner(x1 - rr[2]!, z1 - rr[2]!, rr[2]!, 0);
  corner(x0 + rr[3]!, z1 - rr[3]!, rr[3]!, Math.PI * 0.5);
  // Drop the duplicate points square corners make.
  return out.filter((p, i) => {
    const q = out[(i + out.length - 1) % out.length]!;
    return Math.abs(p[0] - q[0]) > 1e-6 || Math.abs(p[1] - q[1]) > 1e-6;
  });
}

/** A flat sheet facing up from an [x, z] outline (either winding): floors, beds, pond surfaces. */
export function sheet(b: MeshBuilder, outline: readonly (readonly [number, number])[], y: number): void {
  b.extrude(outline, y, y, { cap: 'top' });
}

/** Smooth seeded noise in [0, 1] over the ground plane: for edges that wander. */
export function groundNoise(seed: number, x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = rand(seed, ix, iz), bb = rand(seed, ix + 1, iz), c = rand(seed, ix, iz + 1), d = rand(seed, ix + 1, iz + 1);
  return a + (bb - a) * sx + (c - a) * sz + (a - bb - c + d) * sx * sz;
}

/** A tuft of grass: a few thin blades fanning out of one point. Flat tone, no outline of its own on grass. */
export function tuft(b: MeshBuilder, x: number, y: number, z: number, height: number, r: Rng, blades = 3): void {
  for (let i = 0; i < blades; i++) {
    const a = r('ta', i) * Math.PI * 2;
    const out = height * (0.25 + r('to', i) * 0.35), h = height * (0.7 + r('th', i) * 0.5);
    const dx = Math.cos(a), dz = Math.sin(a);
    // A blade is one thin triangle on each face, standing nearly upright.
    const sx = -dz * height * 0.14, sz = dx * height * 0.14;
    const tip: Vec3 = [x + dx * out, y + h, z + dz * out];
    const n = [TONE.up, TONE.up, TONE.up] as const;
    b.tri([x - sx, y, z - sz], [x + sx, y, z + sz], tip, { normals: n });
    b.tri([x + sx + dx * 0.004, y, z + sz + dz * 0.004], [x - sx + dx * 0.004, y, z - sz + dz * 0.004], [tip[0] + dx * 0.004, tip[1], tip[2] + dz * 0.004], { normals: n });
  }
}
