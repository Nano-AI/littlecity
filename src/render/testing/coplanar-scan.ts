// TEST SUPPORT (Look): finds faces that lie in one plane, face the same way and overlap, with different
// ink ids. The view settles which one is drawn (the coplanar tie-break in shaders/surface.ts), but one
// pair in 24 lands on the same level and still trades pixels as the camera moves; and the seam between
// them is drawn wherever one shows through the other. Used by coplanar.main.ts (the tool) and by
// coplanar.test.ts (the regression).
//
// Structures and layers always; with a dressing plan also every prop, at the frame the layout gives it
// (src/gen/layout.ts), as the renderer places it; with `actors`, every anchored actor at rest too (the
// people waiting at one door then stand in one another, which life never shows: for looking only).

import { allChunks } from '@/core/grid';
import type { Mat4Like } from '@/core/mat4';
import { createLayout } from '@/gen/layout';
import { transformMesh, type MeshData } from '@/gen/mesh';
import { registriesFor } from '@/render/registries';
import type { DressingPlan, ShapePlan } from '@/resolve/index';

type V3 = [number, number, number];

interface Tri {
  who: number;
  ink: number;
  n: V3;
  d: number;
  /** Corners in the plane's two widest axes. */
  p: [number, number][];
  /** Corners in the world. */
  v: V3[];
  area: number;
}

/** One overlapping pair: who drew each side, their ink ids, the smaller triangle's area, the area they share, and a place. */
export interface CoplanarPair {
  a: string;
  b: string;
  inkA: number;
  inkB: number;
  area: number;
  /** The area the two triangles share, in square units (projected on the plane's two widest axes). */
  shared: number;
  at: V3;
  normal: V3;
  triA: V3[];
  triB: V3[];
}

/** Separating axis test for two triangles in 2D: true if they overlap by more than `eps`. */
function overlap(a: [number, number][], b: [number, number][], eps: number): boolean {
  for (const tri of [a, b]) {
    for (let i = 0; i < 3; i++) {
      const p = tri[i]!, q = tri[(i + 1) % 3]!;
      const ax = -(q[1] - p[1]), ay = q[0] - p[0];
      const len = Math.hypot(ax, ay) || 1;
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (const v of a) { const s = (v[0] * ax + v[1] * ay) / len; a0 = Math.min(a0, s); a1 = Math.max(a1, s); }
      for (const v of b) { const s = (v[0] * ax + v[1] * ay) / len; b0 = Math.min(b0, s); b1 = Math.max(b1, s); }
      if (Math.min(a1, b1) - Math.max(a0, b0) < eps) return false;
    }
  }
  return true;
}

/** The area two 2D triangles share (one clipped by the other, Sutherland–Hodgman). */
function sharedArea(a: [number, number][], b: [number, number][]): number {
  const signed = (t: [number, number][]): number => (t[1]![0] - t[0]![0]) * (t[2]![1] - t[0]![1]) - (t[2]![0] - t[0]![0]) * (t[1]![1] - t[0]![1]);
  const clip = signed(b) >= 0 ? b : [b[0]!, b[2]!, b[1]!];
  let poly = a;
  for (let i = 0; i < 3 && poly.length; i++) {
    const p = clip[i]!, q = clip[(i + 1) % 3]!;
    const side = (v: [number, number]): number => (q[0] - p[0]) * (v[1] - p[1]) - (q[1] - p[1]) * (v[0] - p[0]);
    const next: [number, number][] = [];
    for (let k = 0; k < poly.length; k++) {
      const u = poly[k]!, w = poly[(k + 1) % poly.length]!;
      const su = side(u), sw = side(w);
      if (su >= 0) next.push(u);
      if ((su >= 0) !== (sw >= 0)) {
        const t = su / (su - sw);
        next.push([u[0] + (w[0] - u[0]) * t, u[1] + (w[1] - u[1]) * t]);
      }
    }
    poly = next;
  }
  let area = 0;
  for (let k = 0; k < poly.length; k++) {
    const u = poly[k]!, w = poly[(k + 1) % poly.length]!;
    area += u[0] * w[1] - w[0] * u[1];
  }
  return Math.abs(area) / 2;
}

/** Every coplanar overlapping pair with different ink ids among a shape's structures and layers. */
export function coplanarPairs(shape: ShapePlan, dressing: DressingPlan | null = null, opts: { actors?: boolean } = {}): CoplanarPair[] {
  const { generators, parts } = registriesFor(shape);
  const names: string[] = [];
  const buckets = new Map<string, Tri[]>();
  const add = (label: string, mesh: MeshData): void => {
    const who = names.push(label) - 1;
    const P = mesh.position;     // triangle soup: three vertices a triangle
    for (let t = 0; t < P.length / 9; t++) {
      const k = [t * 3, t * 3 + 1, t * 3 + 2];
      const v = k.map((i) => [P[i * 3]!, P[i * 3 + 1]!, P[i * 3 + 2]!] as V3);
      const e1 = [v[1]![0] - v[0]![0], v[1]![1] - v[0]![1], v[1]![2] - v[0]![2]];
      const e2 = [v[2]![0] - v[0]![0], v[2]![1] - v[0]![1], v[2]![2] - v[0]![2]];
      const c = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
      const len = Math.hypot(c[0]!, c[1]!, c[2]!);
      if (len < 1e-6) continue;
      const n: V3 = [c[0]! / len, c[1]! / len, c[2]! / len];
      const d = n[0] * v[0]![0] + n[1] * v[0]![1] + n[2] * v[0]![2];
      const big = Math.abs(n[0]) > Math.abs(n[1]) ? (Math.abs(n[0]) > Math.abs(n[2]) ? 0 : 2) : Math.abs(n[1]) > Math.abs(n[2]) ? 1 : 2;
      const [u, w] = big === 0 ? [1, 2] : big === 1 ? [0, 2] : [0, 1];
      const tri: Tri = { who, ink: mesh.inkId[k[0]!]!, n, d, p: v.map((x) => [x[u]!, x[w]!] as [number, number]), v, area: len / 2 };
      const key = `${Math.round(n[0] * 200)},${Math.round(n[1] * 200)},${Math.round(n[2] * 200)},${Math.round(d * 500)}`;
      let list = buckets.get(key);
      if (!list) buckets.set(key, (list = []));
      list.push(tri);
    }
  };
  const anchors = new Map<string, Mat4Like>();
  const keep = (out: { mesh: MeshData; anchors: Record<string, Mat4Like> }): MeshData => {
    for (const id in out.anchors) anchors.set(id, out.anchors[id]!);
    return out.mesh;
  };
  for (const s of shape.structures.values()) add(`${s.kind}#${s.id}`, keep(generators.build(s, shape, parts)));
  for (const layer of generators.layers()) for (const c of allChunks()) add(`layer ${layer.layer}`, keep(layer.build(c, shape, parts)));
  if (dressing) {
    const layout = createLayout({ shape, dressing, anchors, propOutput: (p, span) => parts.prop(p, { plan: shape, span }) });
    for (const p of dressing.props) {
      const at = layout.item(p.id);
      if (at) add(`prop ${p.type}#${p.id}`, transformMesh(parts.prop(p, { plan: shape, span: at.span }).mesh, at.frame));
    }
    for (const a of opts.actors ? dressing.actors : []) {
      const at = a.at === null ? null : layout.item(a.id);
      if (at) add(`actor ${a.type}#${a.id}`, transformMesh(parts.actor(a, { plan: shape, span: at.span }).mesh, at.frame));
    }
  }

  const out: CoplanarPair[] = [];
  const seen = new Set<string>();
  for (const [key, list] of buckets) {
    const [a, b, c, dk] = key.split(',').map(Number) as [number, number, number, number];
    const near = [dk - 1, dk, dk + 1].flatMap((k) => buckets.get(`${a},${b},${c},${k}`) ?? []);
    // A big plane (the ground, every floor at one level) holds thousands of triangles: only those whose
    // boxes in the plane meet can overlap, so look them up in a grid instead of trying every pair. The
    // candidates keep their order in `near`, so the pairs found (and which side is `a`) are as before.
    const index = near.length > 64 ? planeGrid(near) : null;
    for (const t of list) {
      for (const o of index ? index.around(t) : near) {
        if (o === t || o.ink === t.ink || Math.abs(o.d - t.d) > 2e-4) continue;
        if (o.n[0] * t.n[0] + o.n[1] * t.n[1] + o.n[2] * t.n[2] < 0.99995) continue;
        if (!overlap(t.p, o.p, 1e-3)) continue;
        const [x, y] = t.ink < o.ink ? [t, o] : [o, t];
        const pairKey = `${x.ink}:${y.ink}:${x.v[0]}`;
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);
        out.push({ a: names[x.who]!, b: names[y.who]!, inkA: x.ink, inkB: y.ink, area: Math.min(t.area, o.area), shared: sharedArea(t.p, o.p), at: x.v[0]!, normal: t.n, triA: x.v, triB: y.v });
      }
    }
  }
  return out;
}

/** Cell size of the plane grid, in world units (a cell is 1 × 1 on the ground). */
const GRID = 0.5;

/**
 * The triangles of one plane, by the cells of a grid over their 2D corners. `around(t)` gives every
 * triangle whose box meets t's (touching counts), in `near` order. Two triangles whose boxes are apart
 * never pass `overlap`, so nothing is missed. Triangles projected on other axes than t (a normal right
 * between two axes) are always given, as the plain loop gave them.
 */
function planeGrid(near: Tri[]): { around(t: Tri): Tri[] } {
  // The axis left out of t.p (as in coplanarPairs' `big`).
  const axes = (t: Tri): number => (Math.abs(t.n[0]) > Math.abs(t.n[1]) ? (Math.abs(t.n[0]) > Math.abs(t.n[2]) ? 0 : 2) : Math.abs(t.n[1]) > Math.abs(t.n[2]) ? 1 : 2);
  const box = (t: Tri): [number, number, number, number] => {
    let u0 = Infinity, u1 = -Infinity, w0 = Infinity, w1 = -Infinity;
    for (const [u, w] of t.p) { u0 = Math.min(u0, u); u1 = Math.max(u1, u); w0 = Math.min(w0, w); w1 = Math.max(w1, w); }
    return [Math.floor(u0 / GRID), Math.floor(u1 / GRID), Math.floor(w0 / GRID), Math.floor(w1 / GRID)];
  };
  const cells = new Map<string, number[]>();
  const odd = new Map<number, number[]>(); // by projection axis: triangles listed for every query on another axis
  const axisOf = near.map(axes);
  near.forEach((o, i) => {
    const [u0, u1, w0, w1] = box(o);
    for (let u = u0; u <= u1; u++) {
      for (let w = w0; w <= w1; w++) {
        const k = `${axisOf[i]}:${u}:${w}`;
        let l = cells.get(k);
        if (!l) cells.set(k, (l = []));
        l.push(i);
      }
    }
    let l = odd.get(axisOf[i]!);
    if (!l) odd.set(axisOf[i]!, (l = []));
    l.push(i);
  });
  return {
    around(t: Tri): Tri[] {
      const ax = axes(t);
      const found = new Set<number>();
      const [u0, u1, w0, w1] = box(t);
      for (let u = u0; u <= u1; u++) for (let w = w0; w <= w1; w++) for (const i of cells.get(`${ax}:${u}:${w}`) ?? []) found.add(i);
      for (const [other, l] of odd) if (other !== ax) for (const i of l) found.add(i);
      return [...found].sort((x, y) => x - y).map((i) => near[i]!);
    },
  };
}

/** The kind of a label: `house#12` is `house`, `layer terrain` stays. */
export const kindOf = (label: string): string => label.replace(/#.*$/, '');

/** Pairs grouped by the kinds of their two sides: `{ 'arch / house': { pairs, area, at } }`. */
export function summarise(pairs: CoplanarPair[], minArea = 0): Map<string, { pairs: number; area: number; at: V3 }> {
  const found = new Map<string, { pairs: number; area: number; at: V3 }>();
  for (const p of pairs) {
    if (p.area < minArea) continue;
    const label = [kindOf(p.a), kindOf(p.b)].sort().join(' / ');
    const f = found.get(label) ?? { pairs: 0, area: 0, at: p.at };
    f.pairs++;
    f.area += p.area;
    found.set(label, f);
  }
  return new Map([...found].sort((x, y) => y[1].area - x[1].area));
}
