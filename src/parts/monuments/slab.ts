// A wall with arched openings cut up into it from below: the one shape
// behind every arch cell, bridge span, belfry wall and arcade.
//
// The slab is drawn in a local frame: `u` runs along +X, height along +Y,
// thickness along +Z. Openings may reach outside the slab (one arch over
// three cells: each cell draws its third of the curve).

import type { MeshBuilder } from '@/gen/mesh';

type Vec3 = [number, number, number];

export interface Opening {
  /** Where the opening starts and ends along u. */
  lo: number;
  hi: number;
  /** Height of the straight jamb before the curve starts, above the slab's foot. */
  spring: number;
  /** Rise of the half-ellipse above the spring line. */
  rise: number;
}

export interface SlabSpec {
  u0: number;
  u1: number;
  /** Foot and top of the slab. */
  v0: number;
  v1: number;
  /** Front (+Z, the larger) and back faces. */
  z0: number;
  z1: number;
  openings: readonly Opening[];
  /** Which surfaces to draw. Default: front, back and soffit. */
  front?: boolean;
  back?: boolean;
  soffit?: boolean;
  /** The flat undersides between openings (a leg's foot). */
  foot?: boolean;
  /** The end faces at u0 and u1 (from the opening's height there up to v1), and the top. */
  endLo?: boolean;
  endHi?: boolean;
  top?: boolean;
  /** Segments in a full half-ellipse. Default 14. */
  segments?: number;
}

/** Height of the underside of the stone at `u`, above the slab's foot (0 = solid to the foot). */
export function openingHeight(openings: readonly Opening[], u: number): number {
  for (const o of openings) {
    if (u <= o.lo || u >= o.hi) continue;
    const c = (o.lo + o.hi) / 2, a = (o.hi - o.lo) / 2;
    const t = (u - c) / a;
    return o.spring + o.rise * Math.sqrt(Math.max(0, 1 - t * t));
  }
  return 0;
}

interface EdgePoint {
  u: number;
  v: number;
  /** Normal of the opening's surface here (pointing into the air), or null on a flat foot. */
  nu: number;
  nv: number;
  /** Starts a new smoothing run (a jamb meets a curve, or a foot starts). */
  kind: 'foot' | 'jamb' | 'curve';
}

/** The slab's lower edge from u0 to u1 as a polyline, with what each stretch is. */
function lowerEdge(s: SlabSpec): EdgePoint[][] {
  const runs: EdgePoint[][] = [];
  const seg = s.segments ?? 14;
  let cursor = s.u0;
  const foot = (a: number, b: number): void => {
    if (b - a > 1e-6) {
      runs.push([
        { u: a, v: 0, nu: 0, nv: -1, kind: 'foot' },
        { u: b, v: 0, nu: 0, nv: -1, kind: 'foot' },
      ]);
    }
  };
  const openings = [...s.openings].filter((o) => o.hi > s.u0 + 1e-6 && o.lo < s.u1 - 1e-6 && o.hi - o.lo > 1e-6).sort((a, b) => a.lo - b.lo);
  for (const o of openings) {
    const lo = Math.max(o.lo, s.u0), hi = Math.min(o.hi, s.u1);
    foot(cursor, lo);
    const c = (o.lo + o.hi) / 2, a = (o.hi - o.lo) / 2;
    // Left jamb (only if the opening starts inside the slab).
    if (o.lo >= s.u0 - 1e-6 && o.spring > 1e-6) {
      runs.push([
        { u: lo, v: 0, nu: 1, nv: 0, kind: 'jamb' },
        { u: lo, v: o.spring, nu: 1, nv: 0, kind: 'jamb' },
      ]);
    }
    // The curve, by angle so the steps are even along it.
    const t0 = Math.acos(Math.max(-1, Math.min(1, (lo - c) / a))); // π at the left end
    const t1 = Math.acos(Math.max(-1, Math.min(1, (hi - c) / a))); // 0 at the right end
    const n = Math.max(2, Math.round((seg * (t0 - t1)) / Math.PI));
    const curve: EdgePoint[] = [];
    for (let i = 0; i <= n; i++) {
      const t = t0 + ((t1 - t0) * i) / n;
      const cu = Math.cos(t), sv = Math.sin(t);
      // Inward normal of the ellipse (toward its centre): the stone is outside it.
      let nu = -cu / a, nv = -sv / Math.max(o.rise, 1e-6);
      const len = Math.hypot(nu, nv) || 1;
      nu /= len;
      nv /= len;
      curve.push({ u: i === 0 ? lo : i === n ? hi : c + a * cu, v: o.spring + o.rise * sv, nu, nv, kind: 'curve' });
    }
    runs.push(curve);
    if (o.hi <= s.u1 + 1e-6 && o.spring > 1e-6) {
      runs.push([
        { u: hi, v: o.spring, nu: -1, nv: 0, kind: 'jamb' },
        { u: hi, v: 0, nu: -1, nv: 0, kind: 'jamb' },
      ]);
    }
    cursor = hi;
  }
  foot(cursor, s.u1);
  return runs;
}

/** Draws the slab. Uses the builder's current colour, pattern and ink group. */
export function profileSlab(b: MeshBuilder, s: SlabSpec): void {
  const runs = lowerEdge(s);
  const h = s.v1 - s.v0;
  // The face outline: along the lower edge, then back along the top.
  const outline: [number, number][] = [];
  const push = (u: number, v: number): void => {
    const last = outline[outline.length - 1];
    if (last && Math.abs(last[0] - u) < 1e-6 && Math.abs(last[1] - v) < 1e-6) return;
    outline.push([u, v]);
  };
  for (const run of runs) for (const p of run) push(p.u, Math.min(p.v, h - 1e-4));
  push(s.u1, h);
  push(s.u0, h);
  const first = outline[0]!, last = outline[outline.length - 1]!;
  if (Math.abs(first[0] - last[0]) < 1e-6 && Math.abs(first[1] - last[1]) < 1e-6) outline.pop();
  if (outline.length >= 3) {
    if (s.front ?? true) b.polygon(outline.map(([u, v]): Vec3 => [u, s.v0 + v, s.z1]));
    if (s.back ?? true) b.polygon([...outline].reverse().map(([u, v]): Vec3 => [u, s.v0 + v, s.z0]));
  }
  for (const run of runs) {
    const isFoot = run[0]!.kind === 'foot';
    if (isFoot ? !s.foot : !(s.soffit ?? true)) continue;
    for (let i = 0; i + 1 < run.length; i++) {
      const p = run[i]!, q = run[i + 1]!;
      const pn: Vec3 = [p.nu, p.nv, 0], qn: Vec3 = [q.nu, q.nv, 0];
      b.quad([p.u, s.v0 + p.v, s.z0], [q.u, s.v0 + q.v, s.z0], [q.u, s.v0 + q.v, s.z1], [p.u, s.v0 + p.v, s.z1], { normals: [pn, qn, qn, pn] });
    }
  }
  const hLo = openingHeight(s.openings, s.u0 + 1e-6), hHi = openingHeight(s.openings, s.u1 - 1e-6);
  if (s.endLo) b.quad([s.u0, s.v0 + hLo, s.z0], [s.u0, s.v0 + hLo, s.z1], [s.u0, s.v1, s.z1], [s.u0, s.v1, s.z0]);
  if (s.endHi) b.quad([s.u1, s.v0 + hHi, s.z1], [s.u1, s.v0 + hHi, s.z0], [s.u1, s.v1, s.z0], [s.u1, s.v1, s.z1]);
  if (s.top) b.quad([s.u0, s.v1, s.z1], [s.u1, s.v1, s.z1], [s.u1, s.v1, s.z0], [s.u0, s.v1, s.z0]);
}
