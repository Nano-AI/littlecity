// TEST SUPPORT (Look): finds faces that lie in one plane, face the same way and overlap, with different
// ink ids. The view settles which one is drawn (the coplanar tie-break in shaders/surface.ts), but one
// pair in 24 lands on the same level and still trades pixels as the camera moves; and the seam between
// them is drawn wherever one shows through the other. Run by coplanar.mjs.
//
// Structures and layers only: they are built in world coordinates. Props and actors are placed by
// slot matrices and are not checked.

import { allChunks } from '@/core/grid';
import type { MeshData } from '@/gen/mesh';
import { registriesFor } from '@/render/registries';
import { resolveShape } from '@/resolve/index';
import { buildScenario, scenarioResolveOptions } from '@/scenario';
import { findScenario } from '@/scenario/discover';

interface Tri {
  who: number;
  ink: number;
  n: [number, number, number];
  d: number;
  /** Corners in the plane's two widest axes. */
  p: [number, number][];
  area: number;
  at: [number, number, number];
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

export function main(name: string, log: (line: string) => void): number {
  const scn = findScenario(name);
  if (!scn) {
    log(`no scenario named '${name}'`);
    return 1;
  }
  const built = buildScenario(scn);
  const shape = resolveShape(built.world, built.terrain, scenarioResolveOptions(scn));
  const { generators, parts } = registriesFor(shape);
  const names: string[] = [];
  const buckets = new Map<string, Tri[]>();
  const add = (label: string, mesh: MeshData): void => {
    const who = names.push(label) - 1;
    const P = mesh.position;     // triangle soup: three vertices a triangle
    for (let t = 0; t < P.length / 9; t++) {
      const k = [t * 3, t * 3 + 1, t * 3 + 2];
      const v = k.map((i) => [P[i * 3]!, P[i * 3 + 1]!, P[i * 3 + 2]!] as [number, number, number]);
      const e1 = [v[1]![0] - v[0]![0], v[1]![1] - v[0]![1], v[1]![2] - v[0]![2]];
      const e2 = [v[2]![0] - v[0]![0], v[2]![1] - v[0]![1], v[2]![2] - v[0]![2]];
      const c = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
      const len = Math.hypot(c[0]!, c[1]!, c[2]!);
      if (len < 1e-6) continue;
      const n: [number, number, number] = [c[0]! / len, c[1]! / len, c[2]! / len];
      const d = n[0] * v[0]![0] + n[1] * v[0]![1] + n[2] * v[0]![2];
      const big = Math.abs(n[0]) > Math.abs(n[1]) ? (Math.abs(n[0]) > Math.abs(n[2]) ? 0 : 2) : Math.abs(n[1]) > Math.abs(n[2]) ? 1 : 2;
      const [u, w] = big === 0 ? [1, 2] : big === 1 ? [0, 2] : [0, 1];
      const tri: Tri = { who, ink: mesh.inkId[k[0]!]!, n, d, p: v.map((x) => [x[u]!, x[w]!] as [number, number]), area: len / 2, at: v[0]! };
      const key = `${Math.round(n[0] * 200)},${Math.round(n[1] * 200)},${Math.round(n[2] * 200)},${Math.round(d * 500)}`;
      let list = buckets.get(key);
      if (!list) buckets.set(key, (list = []));
      list.push(tri);
    }
  };
  for (const s of shape.structures.values()) add(s.kind, generators.build(s, shape, parts).mesh);
  for (const layer of generators.layers()) for (const c of allChunks()) add(`layer ${layer.layer}`, layer.build(c, shape, parts).mesh);

  const found = new Map<string, { pairs: number; area: number; at: [number, number, number] }>();
  const seen = new Set<string>();
  for (const [key, list] of buckets) {
    const [a, b, c, dk] = key.split(',').map(Number) as [number, number, number, number];
    const near = [dk - 1, dk, dk + 1].flatMap((k) => buckets.get(`${a},${b},${c},${k}`) ?? []);
    for (const t of list) {
      for (const o of near) {
        if (o === t || o.ink === t.ink || Math.abs(o.d - t.d) > 2e-4) continue;
        if (o.n[0] * t.n[0] + o.n[1] * t.n[1] + o.n[2] * t.n[2] < 0.99995) continue;
        if (!overlap(t.p, o.p, 1e-3)) continue;
        const pairKey = t.ink < o.ink ? `${t.ink}:${o.ink}:${t.at}` : `${o.ink}:${t.ink}:${o.at}`;
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);
        const label = [names[t.who]!, names[o.who]!].sort().join(' / ');
        const f = found.get(label) ?? { pairs: 0, area: 0, at: t.at };
        f.pairs++;
        f.area += Math.min(t.area, o.area);
        found.set(label, f);
      }
    }
  }
  const rows = [...found].sort((x, y) => y[1].area - x[1].area);
  log(`${name}: faces in one plane, facing one way, overlapping, with different ink ids (structures and layers)`);
  log(`  ${'who / who'.padEnd(46)} ${'pairs'.padStart(6)} ${'area'.padStart(8)}   e.g. at`);
  for (const [label, f] of rows) log(`  ${label.padEnd(46)} ${String(f.pairs).padStart(6)} ${f.area.toFixed(3).padStart(8)}   ${f.at.map((x) => x.toFixed(2)).join(', ')}`);
  return 0;
}
