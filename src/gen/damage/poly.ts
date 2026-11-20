// A mesh as a soup of convex polygons with every vertex attribute, so it can
// be cut by planes (the broken top of a wall, the pieces a blast tears off)
// and written back as triangles. Owner: Mischief. Pure.

import type { MeshData } from '@/gen/mesh';

/** px py pz  nx ny nz  r g b  edge sway */
export type Vert = Float64Array;
export const VERT = 11;

export interface Poly {
  v: Vert[];
  pattern: number;
  ink: number;
}

export function vert(p: readonly number[], n: readonly number[], c: readonly number[], edge = 9, sway = 0): Vert {
  const v = new Float64Array(VERT);
  v[0] = p[0]!;
  v[1] = p[1]!;
  v[2] = p[2]!;
  v[3] = n[0]!;
  v[4] = n[1]!;
  v[5] = n[2]!;
  v[6] = c[0]!;
  v[7] = c[1]!;
  v[8] = c[2]!;
  v[9] = edge;
  v[10] = sway;
  return v;
}

/** Every triangle of a mesh as a polygon of three. */
export function polysOf(mesh: MeshData): Poly[] {
  const n = mesh.position.length / 9;
  const out: Poly[] = new Array(n);
  for (let t = 0; t < n; t++) {
    const v: Vert[] = [];
    for (let k = 0; k < 3; k++) {
      const i = t * 3 + k;
      const a = new Float64Array(VERT);
      a[0] = mesh.position[i * 3]!;
      a[1] = mesh.position[i * 3 + 1]!;
      a[2] = mesh.position[i * 3 + 2]!;
      a[3] = mesh.normal[i * 3]!;
      a[4] = mesh.normal[i * 3 + 1]!;
      a[5] = mesh.normal[i * 3 + 2]!;
      a[6] = mesh.color[i * 3]!;
      a[7] = mesh.color[i * 3 + 1]!;
      a[8] = mesh.color[i * 3 + 2]!;
      a[9] = mesh.edge[i]!;
      a[10] = mesh.sway[i]!;
      v.push(a);
    }
    out[t] = { v, pattern: mesh.pattern[t * 3]!, ink: mesh.inkId[t * 3]! };
  }
  return out;
}

function lerpVert(a: Vert, b: Vert, t: number): Vert {
  const v = new Float64Array(VERT);
  for (let i = 0; i < VERT; i++) v[i] = a[i]! + (b[i]! - a[i]!) * t;
  // Normals stay unit length (both ends are the same face's normal in practice).
  const l = Math.hypot(v[3]!, v[4]!, v[5]!) || 1;
  v[3]! /= l;
  v[4]! /= l;
  v[5]! /= l;
  return v;
}

/**
 * Keeps the part of a convex polygon where f(p) ≤ 0, f = a·x + b·y + c·z + d.
 * Returns null if nothing is left. `cut`, if given, receives the new edge
 * that lies on the plane (two vertices), when there is one.
 */
export function clip(poly: Poly, a: number, b: number, c: number, d: number, cut?: Vert[]): Poly | null {
  const v = poly.v;
  const n = v.length;
  const f = new Array<number>(n);
  let inside = 0;
  for (let i = 0; i < n; i++) {
    const p = v[i]!;
    f[i] = a * p[0]! + b * p[1]! + c * p[2]! + d;
    if (f[i]! <= 1e-9) inside++;
  }
  if (inside === n) return poly;
  if (inside === 0) return null;
  const out: Vert[] = [];
  const onPlane: Vert[] = [];
  for (let i = 0; i < n; i++) {
    const p = v[i]!;
    const q = v[(i + 1) % n]!;
    const fp = f[i]!;
    const fq = f[(i + 1) % n]!;
    if (fp <= 1e-9) out.push(p);
    if ((fp <= 1e-9) !== (fq <= 1e-9)) {
      const x = lerpVert(p, q, fp / (fp - fq));
      out.push(x);
      onPlane.push(x);
    }
  }
  if (out.length < 3) return null;
  if (cut && onPlane.length === 2) cut.push(onPlane[0]!, onPlane[1]!);
  return { v: out, pattern: poly.pattern, ink: poly.ink };
}

/** Both sides of a plane: [f ≤ 0 part, f ≥ 0 part]. */
export function split(poly: Poly, a: number, b: number, c: number, d: number): [Poly | null, Poly | null] {
  return [clip(poly, a, b, c, d), clip(poly, -a, -b, -c, -d)];
}

export function centroid(poly: Poly): [number, number, number] {
  let x = 0, y = 0, z = 0;
  for (const p of poly.v) {
    x += p[0]!;
    y += p[1]!;
    z += p[2]!;
  }
  const n = poly.v.length;
  return [x / n, y / n, z / n];
}

export function bounds(poly: Poly): [number, number, number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (const p of poly.v) {
    if (p[0]! < x0) x0 = p[0]!;
    if (p[0]! > x1) x1 = p[0]!;
    if (p[1]! < y0) y0 = p[1]!;
    if (p[1]! > y1) y1 = p[1]!;
    if (p[2]! < z0) z0 = p[2]!;
    if (p[2]! > z1) z1 = p[2]!;
  }
  return [x0, y0, z0, x1, y1, z1];
}

/** The polygon's own face normal (from its first vertex: the generators give flat faces one normal). */
export function normalOf(poly: Poly): [number, number, number] {
  const p = poly.v[0]!;
  return [p[3]!, p[4]!, p[5]!];
}

export function area(poly: Poly): number {
  const v = poly.v;
  let ax = 0, ay = 0, az = 0;
  const o = v[0]!;
  for (let i = 1; i + 1 < v.length; i++) {
    const p = v[i]!;
    const q = v[i + 1]!;
    const ux = p[0]! - o[0]!, uy = p[1]! - o[1]!, uz = p[2]! - o[2]!;
    const wx = q[0]! - o[0]!, wy = q[1]! - o[1]!, wz = q[2]! - o[2]!;
    ax += uy * wz - uz * wy;
    ay += uz * wx - ux * wz;
    az += ux * wy - uy * wx;
  }
  return Math.hypot(ax, ay, az) / 2;
}

/** The same polygon seen from behind: reversed winding, flipped normal, moved `inset` along the old back. */
export function backOf(poly: Poly, inset: number, color: readonly number[] | null, ink = poly.ink): Poly {
  const v = poly.v
    .slice()
    .reverse()
    .map((p) => {
      const q = new Float64Array(p);
      q[0] = p[0]! - p[3]! * inset;
      q[1] = p[1]! - p[4]! * inset;
      q[2] = p[2]! - p[5]! * inset;
      q[3] = -p[3]!;
      q[4] = -p[4]!;
      q[5] = -p[5]!;
      if (color) {
        q[6] = color[0]!;
        q[7] = color[1]!;
        q[8] = color[2]!;
      }
      return q;
    });
  return { v, pattern: poly.pattern, ink };
}

/** Collects polygons and writes them out as one mesh (fan triangulation). */
export class Soup {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];
  private pat: number[] = [];
  private ink: number[] = [];
  private edg: number[] = [];
  private swy: number[] = [];

  add(poly: Poly): void {
    const v = poly.v;
    for (let i = 1; i + 1 < v.length; i++) {
      for (const p of [v[0]!, v[i]!, v[i + 1]!]) {
        this.pos.push(p[0]!, p[1]!, p[2]!);
        this.nor.push(p[3]!, p[4]!, p[5]!);
        this.col.push(Math.round(p[6]!), Math.round(p[7]!), Math.round(p[8]!));
        this.pat.push(poly.pattern);
        this.ink.push(poly.ink);
        this.edg.push(p[9]!);
        this.swy.push(p[10]!);
      }
    }
  }

  get empty(): boolean {
    return this.pos.length === 0;
  }

  build(): MeshData {
    return {
      position: Float32Array.from(this.pos),
      normal: Float32Array.from(this.nor),
      color: Uint8Array.from(this.col.map((c) => Math.max(0, Math.min(255, c)))),
      pattern: Uint8Array.from(this.pat),
      inkId: Uint16Array.from(this.ink),
      edge: Float32Array.from(this.edg),
      sway: Float32Array.from(this.swy),
    };
  }
}

/** Mixes a vertex colour toward a target. */
export function tint(poly: Poly, to: readonly number[], amount: number): void {
  if (amount <= 0) return;
  for (const p of poly.v) {
    p[6] = p[6]! + (to[0]! - p[6]!) * amount;
    p[7] = p[7]! + (to[1]! - p[7]!) * amount;
    p[8] = p[8]! + (to[2]! - p[8]!) * amount;
  }
}

/** Applies a rigid transform (column-major 4×4) to a polygon's positions and normals, in place. */
export function transformPoly(poly: Poly, m: ArrayLike<number>): void {
  for (const p of poly.v) {
    const x = p[0]!, y = p[1]!, z = p[2]!;
    p[0] = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
    p[1] = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
    p[2] = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
    const nx = p[3]!, ny = p[4]!, nz = p[5]!;
    p[3] = m[0]! * nx + m[4]! * ny + m[8]! * nz;
    p[4] = m[1]! * nx + m[5]! * ny + m[9]! * nz;
    p[5] = m[2]! * nx + m[6]! * ny + m[10]! * nz;
  }
}

export function clonePoly(poly: Poly): Poly {
  return { v: poly.v.map((p) => new Float64Array(p)), pattern: poly.pattern, ink: poly.ink };
}
