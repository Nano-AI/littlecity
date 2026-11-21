// Soft bodies: round things drawn as one smooth mass (the owner: "for rounder objects the rigid lines
// look off; merge them", as the nuke's and the storm's clouds are merged). Pure: MeshBuilder in,
// triangles out.
//
// The pen draws a line where the ink id changes, where the depth jumps, and where the normal turns
// more than about 30 degrees between neighbouring pixels (shaders/composite.ts). A round thing drawn
// the ordinary way trips the last one, and its stepped shading shows every facet:
//
//   - `lathe` blends normals round the axis only: along the profile each ring keeps its own slope, so
//     a ball of six rings is six flat bands (30 degrees apart: a pale crease at each, and a hard step
//     of tone between them);
//   - two lumps that overlap (a cloud's puffs, a dog's head and snout, hair over a head) meet along a
//     curve where one's normal ends and the other's begins: a crease all along it, and a ring of ink
//     too where they have ink ids of their own.
//
// The tool for both: a soft body is a group of pieces with ONE ink id whose normals are not their own
// facets' but those of a smooth field over the whole group: round each lump, handed over gradually
// where lumps meet. Normals then change smoothly everywhere on it, so no crease line can fire inside it
// and the stepped tones fall in round bands across the whole mass; the pen draws its outline (the
// depth jump at its edge) and nothing else. Lines meant to be there (a mouth, a collar, a nose, the
// seam between a head and a body) are drawn as pieces of their own with their own ink id, outside it.
//
//   soft(b, { ink: 'head' }, (s) => {
//     s.b.setColor(skin);
//     s.ball(0, cy, 0, r);                 // a lump, drawn and registered
//     s.at(tilt, () => s.b.lathe(hair));   // anything else drawn takes its normals from the lumps
//   });
//
// Nothing changes in the renderer and nothing is added per frame: it is a different normal on the
// same vertices. `smoothBall` and `smoothLathe` are the one-piece cases.

import { compose, invertAffine, multiply, scaling, translation, type Mat4, type Mat4Like, type Vec3 } from '@/core/mat4';
import { MeshBuilder, type MeshData } from './mesh';

/** Emits a ball of radius 1 about the origin with exact (smooth) normals: `rings` from pole to pole. */
function unitBall(b: MeshBuilder, segments: number, rings: number): void {
  const at = (i: number, j: number): Vec3 => {
    const th = Math.PI * (1 - i / rings);
    const r = i === 0 || i === rings ? 0 : Math.sin(th);
    const t = (Math.PI * 2 * j) / segments;
    return [r * Math.cos(t), -Math.cos(Math.PI * (i / rings)), r * Math.sin(t)];
  };
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segments; j++) {
      // As MeshBuilder.lathe orders them (counter-clockwise from outside).
      const a = at(i, j + 1), bb = at(i, j), c = at(i + 1, j), d = at(i + 1, j + 1);
      if (i === 0) b.tri(a, c, d, { normals: [a, c, d] });
      else if (i === rings - 1) b.tri(a, bb, c, { normals: [a, bb, c] });
      else b.quad(a, bb, c, d, { normals: [a, bb, c, d] });
    }
  }
}

/**
 * A ball squashed to (rx, ry, rz) about (x, y, z), smooth in both directions (a lathe ball is smooth
 * only round its axis). Drawn with the builder's colour, pattern and ink.
 */
export function smoothBall(b: MeshBuilder, x: number, y: number, z: number, rx: number, ry = rx, rz = rx, segments = 10, rings = 6): void {
  b.at(compose(translation(x, y, z), scaling(rx, ry, rz)), () => unitBall(b, segments, Math.max(2, rings)));
}

/**
 * A lathe whose normals are smooth along the profile as well as round the axis: where two segments of
 * the profile meet at less than `crease` radians their normals are blended, so a bean, a pear, a sack
 * or a pumpkin shades in smooth bands; a sharper corner (a rim, a lid's edge) keeps its edge.
 */
export function smoothLathe(b: MeshBuilder, profile: readonly (readonly [number, number])[], opts: { segments?: number; crease?: number; start?: number; sweep?: number } = {}): void {
  const segs = Math.max(3, Math.floor(opts.segments ?? 12));
  const crease = opts.crease ?? 1.0;
  const start = opts.start ?? 0, sweep = opts.sweep ?? Math.PI * 2;
  // Each segment's (radial, up) normal in the profile's plane.
  const segN: [number, number][] = [];
  for (let i = 0; i + 1 < profile.length; i++) {
    const [r0, y0] = profile[i]!, [r1, y1] = profile[i + 1]!;
    const len = Math.hypot(r1 - r0, y1 - y0) || 1;
    segN.push([(y1 - y0) / len, -(r1 - r0) / len]);
  }
  const ends = (i: number): [[number, number], [number, number]] => {
    // The normal at the bottom and the top of segment i, blended with its neighbours' where the turn is gentle.
    const n = segN[i]!;
    const blend = (m: [number, number] | undefined): [number, number] => {
      if (!m || Math.acos(Math.max(-1, Math.min(1, n[0] * m[0] + n[1] * m[1]))) > crease) return n;
      const x = n[0] + m[0], y = n[1] + m[1], l = Math.hypot(x, y) || 1;
      return [x / l, y / l];
    };
    let lo = blend(segN[i - 1]), hi = blend(segN[i + 1]);
    // On the axis a ball's normal points along it.
    if (profile[i]![0] === 0) lo = [0, -1];
    if (profile[i + 1]![0] === 0) hi = [0, 1];
    return [lo, hi];
  };
  const ring = (r: number, y: number, t: number): Vec3 => [r * Math.cos(t), y, r * Math.sin(t)];
  const nrm = (n: [number, number], t: number): Vec3 => [n[0] * Math.cos(t), n[1], n[0] * Math.sin(t)];
  for (let i = 0; i + 1 < profile.length; i++) {
    const [r0, y0] = profile[i]!, [r1, y1] = profile[i + 1]!;
    if (r0 === 0 && r1 === 0) continue;
    const [lo, hi] = ends(i);
    for (let j = 0; j < segs; j++) {
      const t0 = start + (sweep * j) / segs, t1 = start + (sweep * (j + 1)) / segs;
      const a = ring(r0, y0, t1), bb = ring(r0, y0, t0), c = ring(r1, y1, t0), d = ring(r1, y1, t1);
      if (r0 === 0) b.tri(a, c, d, { normals: [nrm(lo, t1), nrm(hi, t0), nrm(hi, t1)] });
      else if (r1 === 0) b.tri(a, bb, c, { normals: [nrm(lo, t1), nrm(lo, t0), nrm(hi, t0)] });
      else b.quad(a, bb, c, d, { normals: [nrm(lo, t1), nrm(lo, t0), nrm(hi, t0), nrm(hi, t1)] });
    }
  }
}

/** A lump of a soft body: the unit ball's placement (an affine matrix) in the body's own space. */
interface Lump {
  inv: Mat4;
  /** The inverse's transpose, 3 x 3, row by row: turns a gradient in the ball's space into the body's. */
  invT: number[];
}

/** What a soft body is drawn with: its own builder (colour and pattern are set on it) and its lumps. */
export class SoftBody {
  /** Draw on this: positions are in the body's own space, which `soft` places where the host's transform is. */
  readonly b: MeshBuilder;
  readonly lumps: Lump[] = [];
  private m: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  private stack: Mat4[] = [];

  constructor(inkId: number) {
    this.b = new MeshBuilder();
    this.b.setInkId(inkId);
  }

  /** Runs `fn` with `m` applied on top of the body's transform (use this, not `b.at`, round lumps). */
  at(m: Mat4Like, fn: () => void): this {
    this.stack.push(this.m);
    this.m = multiply(this.m, m);
    try {
      this.b.at(m, fn);
    } finally {
      this.m = this.stack.pop()!;
    }
    return this;
  }

  /** A lump of the body, drawn: a smooth ball (rx, ry, rz) about (x, y, z). */
  ball(x: number, y: number, z: number, rx: number, ry = rx, rz = rx, segments = 10, rings = 6): this {
    this.hold(x, y, z, rx, ry, rz);
    smoothBall(this.b, x, y, z, rx, ry, rz, segments, rings);
    return this;
  }

  /** A lump the normals are taken from, not drawn (the body's shape where it is drawn some other way). */
  hold(x: number, y: number, z: number, rx: number, ry = rx, rz = rx): this {
    const place = multiply(this.m, compose(translation(x, y, z), scaling(rx, ry, rz)));
    const inv = invertAffine(place);
    this.lumps.push({ inv, invT: [inv[0]!, inv[1]!, inv[2]!, inv[4]!, inv[5]!, inv[6]!, inv[8]!, inv[9]!, inv[10]!] });
    return this;
  }
}

export interface SoftOptions {
  /** The ink group (in the host builder's namespace), or a raw ink id. */
  ink?: number | string;
  inkId?: number;
  /**
   * How round it is shaded: 1 (the default) each lump's own round normal, handed over where lumps meet;
   * toward 0 the normals lean up, so a cloud or a heap of dust is nearly one tone (as the nuke's are).
   */
  round?: number;
  /** How briskly the normal hands over from one lump to the next where they meet (default 7). */
  sharpness?: number;
}

/**
 * The field's normal at p: each lump's own (the gradient of its ellipsoidal distance), weighted by how
 * near p is to that lump's surface (exp(-k (d - 1)), the nearest surface winning but handing over
 * smoothly), summed. With no lumps, one ellipsoid round the whole body's bounds.
 */
function fieldNormal(lumps: readonly Lump[], p: Vec3, k: number, out: number[]): void {
  let best = Infinity;
  const ds: number[] = [];
  const gs: number[] = [];
  for (const L of lumps) {
    const m = L.inv;
    const qx = m[0]! * p[0] + m[4]! * p[1] + m[8]! * p[2] + m[12]!;
    const qy = m[1]! * p[0] + m[5]! * p[1] + m[9]! * p[2] + m[13]!;
    const qz = m[2]! * p[0] + m[6]! * p[1] + m[10]! * p[2] + m[14]!;
    const d = Math.hypot(qx, qy, qz) || 1e-6;
    // grad d = inv^T q / d: inv^T applied as the rows of inv's columns.
    const t = L.invT;
    let gx = t[0]! * qx + t[1]! * qy + t[2]! * qz;
    let gy = t[3]! * qx + t[4]! * qy + t[5]! * qz;
    let gz = t[6]! * qx + t[7]! * qy + t[8]! * qz;
    const gl = Math.hypot(gx, gy, gz) || 1;
    gx /= gl;
    gy /= gl;
    gz /= gl;
    ds.push(d);
    gs.push(gx, gy, gz);
    best = Math.min(best, d);
  }
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < ds.length; i++) {
    const w = Math.exp(-k * (ds[i]! - best));
    x += w * gs[i * 3]!;
    y += w * gs[i * 3 + 1]!;
    z += w * gs[i * 3 + 2]!;
  }
  out[0] = x;
  out[1] = y;
  out[2] = z;
}

/** Gives a mesh the soft field's normals (in place) and returns it. */
export function softenMesh(m: MeshData, lumps: readonly Lump[], opts: Pick<SoftOptions, 'round' | 'sharpness'> = {}): MeshData {
  const k = opts.sharpness ?? 7;
  const round = Math.max(0, Math.min(1, opts.round ?? 1));
  const pos = m.position, nor = m.normal;
  let use = lumps;
  if (use.length === 0 && pos.length > 0) {
    // One ellipsoid round the bounds.
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a]!, pos[i + a]!);
      hi[a] = Math.max(hi[a]!, pos[i + a]!);
    }
    const place = compose(translation((lo[0]! + hi[0]!) / 2, (lo[1]! + hi[1]!) / 2, (lo[2]! + hi[2]!) / 2), scaling(Math.max(1e-4, (hi[0]! - lo[0]!) / 2), Math.max(1e-4, (hi[1]! - lo[1]!) / 2), Math.max(1e-4, (hi[2]! - lo[2]!) / 2)));
    const inv = invertAffine(place);
    use = [{ inv, invT: [inv[0]!, inv[1]!, inv[2]!, inv[4]!, inv[5]!, inv[6]!, inv[8]!, inv[9]!, inv[10]!] }];
  }
  const n = [0, 0, 0];
  for (let i = 0; i < pos.length; i += 3) {
    fieldNormal(use, [pos[i]!, pos[i + 1]!, pos[i + 2]!], k, n);
    let l = Math.hypot(n[0]!, n[1]!, n[2]!) || 1;
    let x = n[0]! / l, y = n[1]! / l, z = n[2]! / l;
    if (round < 1) {
      // Lean toward straight up: a heap of puffs read as one pale mass.
      x *= round;
      z *= round;
      y = y * round + (1 - round);
      l = Math.hypot(x, y, z) || 1;
      x /= l;
      y /= l;
      z /= l;
    }
    nor[i] = x;
    nor[i + 1] = y;
    nor[i + 2] = z;
  }
  return m;
}

/**
 * Draws a soft body into `b` where `b`'s transform is now: `draw` draws on the body's own builder
 * (`s.b`, colours and patterns set there; lumps with `s.ball`, transforms round them with `s.at`), and
 * everything it draws takes one ink id and the soft field's normals.
 */
export function soft(b: MeshBuilder, opts: SoftOptions, draw: (s: SoftBody) => void): void {
  const id = opts.inkId ?? b.inkOf(opts.ink ?? 'soft');
  const s = new SoftBody(id);
  draw(s);
  b.add(softenMesh(s.b.build(), s.lumps, opts));
}
