// Roofs for any footprint (Houses owner; design section 11, catalogue J04).
//
// A roof is a height field over the cells it covers:
//
//     height(p) = pitch × (distance from p to the nearest EAVE edge)
//
// with the distance measured the square way (the larger of the x and z
// distances). That one rule gives every roof type, by choosing which outline
// edges count as eaves:
//
//     hip       every free edge is an eave: planes rise from all sides and
//               meet in hips, valleys and a ridge. Correct for rectangles,
//               L, T, U and ring shapes alike (it is the straight skeleton
//               of a right-angled outline).
//     gable     only the edges along the ridge axis are eaves; the two ends
//               are cut off vertically and closed by a gable wall.
//     lean-to   one eave; the roof climbs to the taller wall behind it.
//
// Each outline edge has a mode saying what happens there:
//
//     eave     slopes on past the cell line as an overhang
//     eave0    an eave with no overhang (against a neighbour's wall)
//     gutter   an eave against a taller wall of the same building: the roof
//              runs level into that wall
//     rake     a gable end: cut off, overhanging a little, closed by a wall
//     cut      cut off flush with the cell line (party walls, towers), closed by a wall
//     inset    cut off short of the cell line, behind a parapet that rises past the roof
//              (a stepped gable)
//     wall     runs on into a taller wall of the same building
//
// The distance field of right-angled outlines only ever creases along
// half-cell lines and 45° diagonals, so sampling it on a half-cell lattice
// (with each lattice square split along the right diagonal) is exact: no
// faceting, and the renderer's crease lines fall exactly on hips and ridges.
// The ridge sag is a smooth offset added afterwards; shading normals ignore
// it so a slope keeps one tone.

import { DIR4, keyX, keyZ, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import type { Vec3 } from '@/core/mat4';
import type { ColorInput, MeshBuilder } from '@/gen/mesh';
import { leftOf, rightOf } from '@/gen/house/outline';

export type EdgeMode = 'eave' | 'eave0' | 'gutter' | 'rake' | 'cut' | 'inset' | 'wall';

export interface RoofInput {
  /** The cells under the roof, all on one level. */
  cells: readonly CellKey[];
  /** What happens at each outline edge (asked only for sides with no roofed neighbour). */
  mode(cell: CellKey, dir: Dir4): EdgeMode;
  /** World y of the eave line at the cell edge (normally the wall top). */
  base: number;
  /** Rise per unit of distance. If omitted it is chosen from `rise` and the roof's half-span. */
  pitch?: number;
  /** Ridge height for a half-span of 0.5, 1 and 1.5 cells (used when `pitch` is omitted). */
  rise: readonly [number, number, number];
  /** Added to the ridge height (J03). */
  lift: number;
  /** How far the middle of the ridge sags, in world units. */
  sag: number;
  /** One end of the ridge sits this much lower than the other (the hand). */
  tilt: number;
  /** Overhangs past the cell line. */
  eave: number;
  rake: number;
  /** How far a roof runs into a taller wall of its own building (the wall inset). */
  into: number;
  /** How far inside the cell line an 'inset' edge stops (the back of the parapet). Default 0. */
  trim?: number;
}

export interface RoofField {
  readonly input: RoofInput;
  readonly pitch: number;
  /** The largest eave distance: the half-span. */
  readonly span: number;
  /** Ridge height above `base` (before sag). */
  readonly rise: number;
  has(cell: CellKey): boolean;
  mode(cell: CellKey, dir: Dir4): EdgeMode | null;
  /** World height of the roof surface at a point over (or just outside) `cell`. */
  heightAt(cell: CellKey, x: number, z: number): number;
  /** The same without sag and tilt: the true planes, for shading normals. */
  planeAt(cell: CellKey, x: number, z: number): number;
  /** The highest lattice point over a cell: where its ridge is. */
  crest(cell: CellKey): { x: number; z: number; y: number };
}

interface Seg {
  /** true: the segment runs along x at z = at; false: along z at x = at. */
  alongX: boolean;
  at: number;
  lo: number;
  hi: number;
}

const OVER: Record<EdgeMode, (i: RoofInput) => number> = {
  eave: (i) => i.eave,
  eave0: () => 0,
  gutter: (i) => i.into,
  rake: (i) => i.rake,
  cut: () => 0,
  inset: () => 0,
  wall: (i) => i.into,
};
const IS_EAVE: Record<EdgeMode, boolean> = { eave: true, eave0: true, gutter: true, rake: false, cut: false, inset: false, wall: false };
const HAS_FASCIA: Record<EdgeMode, boolean> = { eave: true, eave0: false, gutter: false, rake: true, cut: false, inset: false, wall: false };

/** Builds the height field of one roof. */
export function roofField(input: RoofInput): RoofField {
  const cells = new Set(input.cells);
  const has = (c: CellKey): boolean => c !== NO_CELL && cells.has(c);
  const modes = new Map<number, EdgeMode>();
  const segs: Seg[] = [];
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const c of input.cells) {
    const x = keyX(c), z = keyZ(c);
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x + 1);
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z + 1);
    for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
      if (has(neighbor(c, d))) continue;
      const m = input.mode(c, d);
      modes.set(c * 4 + d, m);
      if (!IS_EAVE[m]) continue;
      if (d === 0) segs.push({ alongX: true, at: z, lo: x, hi: x + 1 });
      else if (d === 2) segs.push({ alongX: true, at: z + 1, lo: x, hi: x + 1 });
      else if (d === 1) segs.push({ alongX: false, at: x + 1, lo: z, hi: z + 1 });
      else segs.push({ alongX: false, at: x, lo: z, hi: z + 1 });
    }
  }
  const mode = (c: CellKey, d: Dir4): EdgeMode | null => modes.get(c * 4 + d) ?? null;

  /** Square distance from a point to the nearest eave edge. */
  const dist = (x: number, z: number): number => {
    let best = Infinity;
    for (const s of segs) {
      const along = s.alongX ? x : z;
      const across = Math.abs((s.alongX ? z : x) - s.at);
      const over = along < s.lo ? s.lo - along : along > s.hi ? along - s.hi : 0;
      const d = across > over ? across : over;
      if (d < best) best = d;
    }
    return best === Infinity ? 0 : best;
  };

  let span = 0;
  for (const c of input.cells) {
    for (let j = 0; j <= 2; j++) for (let i = 0; i <= 2; i++) span = Math.max(span, dist(keyX(c) + i / 2, keyZ(c) + j / 2));
  }
  const [r1, r2, r3] = input.rise;
  const table = span <= 0.5 ? r1 : span <= 1 ? r1 + (r2 - r1) * (span - 0.5) * 2 : span <= 1.5 ? r2 + (r3 - r2) * (span - 1) * 2 : r3 + (span - 1.5) * 0.12;
  const rise = span === 0 ? 0 : input.pitch !== undefined ? input.pitch * span + input.lift : Math.max(0.2, table + input.lift);
  const pitch = span === 0 ? 0 : rise / span;

  /** Distance for a point over or just outside `cell`: overhangs keep sloping, gable ends do not. */
  const reach = (cell: CellKey, x: number, z: number): number => {
    const cx = keyX(cell), cz = keyZ(cell);
    let ex = x, ez = z, drop = 0;
    const side = (d: Dir4, over: number): void => {
      const m = mode(cell, d);
      if (m === 'wall') return; // keep going: the field is defined past the edge
      if (d === 1 || d === 3) ex = d === 1 ? cx + 1 : cx;
      else ez = d === 2 ? cz + 1 : cz;
      if (m === 'eave') drop = Math.max(drop, over);
    };
    if (x > cx + 1) side(1, x - cx - 1);
    else if (x < cx) side(3, cx - x);
    if (z > cz + 1) side(2, z - cz - 1);
    else if (z < cz) side(0, cz - z);
    return dist(ex, ez) - drop;
  };

  const longX = x1 - x0 >= z1 - z0;
  const length = Math.max(1, longX ? x1 - x0 : z1 - z0);
  const planeAt = (cell: CellKey, x: number, z: number): number => input.base + pitch * reach(cell, x, z);
  const heightAt = (cell: CellKey, x: number, z: number): number => {
    const r = reach(cell, x, z);
    if (span === 0) return input.base;
    const w = Math.max(0, Math.min(1, r / span));
    const u = Math.max(0, Math.min(1, ((longX ? x : z) - (longX ? x0 : z0)) / length));
    // The ridge dips in the middle and one end sits a touch low; the eaves stay true so they meet the walls.
    const hand = w * w * (input.sag * 4 * u * (1 - u) + input.tilt * (u - 0.5));
    return input.base + pitch * r - hand;
  };
  const crest = (cell: CellKey): { x: number; z: number; y: number } => {
    let best = { x: keyX(cell) + 0.5, z: keyZ(cell) + 0.5, y: -Infinity };
    // Centre first, so a flat-topped cell answers with its middle.
    for (const [i, j] of [[1, 1], [1, 0], [0, 1], [2, 1], [1, 2], [0, 0], [2, 0], [0, 2], [2, 2]] as const) {
      const x = keyX(cell) + i / 2, z = keyZ(cell) + j / 2;
      const y = heightAt(cell, x, z);
      if (y > best.y + 1e-6) best = { x, z, y };
    }
    return best;
  };
  return { input, pitch, span, rise, has, mode, heightAt, planeAt, crest };
}

export interface RoofLook {
  color: ColorInput;
  pattern: number;
  /** Ink group of the roof surface. */
  ink: string;
  /** The slab edge shown at eaves and rakes: its height, colour and ink group. 0 = a paper-thin roof. */
  thick: number;
  fascia: ColorInput;
  fasciaInk: string;
  /**
   * Ridge and hip caps: a raised strip of ridge tile along every line where the roof folds
   * outward. Omit for a roof without them.
   */
  cap?: { color: ColorInput; ink: string; width: number; proud: number };
  /** The tile colour at a point (seeded bands of slightly different tone). Default: `color` everywhere. */
  tone?(x: number, z: number): ColorInput;
}

type P2 = readonly [number, number];

/** Emits the roof surface, its overhangs and its edge. World space. */
export function emitRoof(b: MeshBuilder, f: RoofField, look: RoofLook): void {
  const input = f.input;
  /** Every roof triangle drawn, for finding the folds afterwards (only when caps are wanted). */
  const faces: { v: [Vec3, Vec3, Vec3]; flat: [Vec3, Vec3, Vec3]; n: Vec3 }[] = [];
  /** One triangle of roof over `cell`, counter-clockwise seen from above. */
  const tri = (cell: CellKey, p: P2, q: P2, r: P2): void => {
    const A: Vec3 = [p[0], f.planeAt(cell, p[0], p[1]), p[1]];
    const B: Vec3 = [q[0], f.planeAt(cell, q[0], q[1]), q[1]];
    const C: Vec3 = [r[0], f.planeAt(cell, r[0], r[1]), r[1]];
    // The shading normal is the true plane's, so sag never breaks a slope into tones.
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
    const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const n: Vec3 = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    const len = Math.hypot(n[0], n[1], n[2]);
    if (len < 1e-9) return;
    const P: Vec3 = [p[0], f.heightAt(cell, p[0], p[1]), p[1]];
    const Q: Vec3 = [q[0], f.heightAt(cell, q[0], q[1]), q[1]];
    const R: Vec3 = [r[0], f.heightAt(cell, r[0], r[1]), r[1]];
    const tone = look.tone?.((p[0] + q[0] + r[0]) / 3, (p[1] + q[1] + r[1]) / 3);
    b.tri(P, Q, R, tone === undefined ? { normals: [n, n, n] } : { normals: [n, n, n], colors: [tone, tone, tone] });
    if (look.cap) faces.push({ v: [P, Q, R], flat: [A, B, C], n: [n[0] / len, n[1] / len, n[2] / len] });
  };
  /** A four-sided patch a→b→c→d (counter-clockwise from above), split along the diagonal the field creases on. */
  const patch = (cell: CellKey, a: P2, p: P2, c: P2, d: P2): void => {
    const h = (q: P2): number => f.planeAt(cell, q[0], q[1]);
    const mid: P2 = [(a[0] + p[0] + c[0] + d[0]) / 4, (a[1] + p[1] + c[1] + d[1]) / 4];
    const hm = h(mid), ac = (h(a) + h(c)) / 2, pd = (h(p) + h(d)) / 2;
    if (Math.abs(ac - hm) < 1e-6) {
      tri(cell, a, p, c);
      tri(cell, a, c, d);
    } else if (Math.abs(pd - hm) < 1e-6) {
      tri(cell, a, p, d);
      tri(cell, p, c, d);
    } else {
      tri(cell, a, p, mid);
      tri(cell, p, c, mid);
      tri(cell, c, d, mid);
      tri(cell, d, a, mid);
    }
  };
  /**
   * The underside of an overhang (a→b→c→d counter-clockwise from above, as for `patch`). A far
   * slope's overhang is seen from below whenever the camera is lower than the roof is steep, so
   * without this the edge of the roof would float.
   */
  const soffit = (cell: CellKey, a: P2, p: P2, c: P2, d: P2): void => {
    if (look.thick <= 0) return;
    const at = (q: P2): Vec3 => [q[0], f.heightAt(cell, q[0], q[1]) - look.thick, q[1]];
    b.quad(at(d), at(c), at(p), at(a));
  };
  const fascia = (cell: CellKey, p: P2, q: P2): void => {
    if (look.thick <= 0) return;
    const yp = f.heightAt(cell, p[0], p[1]), yq = f.heightAt(cell, q[0], q[1]);
    b.quad([p[0], yp - look.thick, p[1]], [q[0], yq - look.thick, q[1]], [q[0], yq, q[1]], [p[0], yp, p[1]]);
  };

  const trimOf = (cell: CellKey, d: Dir4): number => (f.mode(cell, d) === 'inset' ? (input.trim ?? 0) : 0);
  b.with({ color: look.color, pattern: look.pattern, ink: look.ink }, () => {
    for (const cell of input.cells) {
      const cx = keyX(cell), cz = keyZ(cell);
      // An 'inset' edge stops the roof short of the cell line.
      const x0 = cx + trimOf(cell, 3), x1 = cx + 1 - trimOf(cell, 1), z0 = cz + trimOf(cell, 0), z1 = cz + 1 - trimOf(cell, 2);
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 2; i++) {
          const xa = Math.max(x0, cx + i / 2), xb = Math.min(x1, cx + (i + 1) / 2), za = Math.max(z0, cz + j / 2), zb = Math.min(z1, cz + (j + 1) / 2);
          patch(cell, [xa, za], [xa, zb], [xb, zb], [xb, za]);
        }
      }
    }
  });

  // Overhangs: a strip along each outline edge, a square at each outer corner.
  for (const cell of input.cells) {
    for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
      const m = f.mode(cell, d);
      if (!m) continue;
      const o = OVER[m](input);
      const [dx, dz] = DIR4[d]!;
      const ox = keyX(cell) + 0.5 + 0.5 * dx, oz = keyZ(cell) + 0.5 + 0.5 * dz;
      // Along the edge by t (0 at the viewer's left, 1 at the right), out from it by a.
      const P = (t: number, a: number): P2 => [ox + dz * (t - 0.5) + dx * a, oz - dx * (t - 0.5) + dz * a];
      const L = leftOf(d), R = rightOf(d);
      // A concave end: the neighbour's strip comes the other way; share the corner along the diagonal.
      const concave = (lateral: Dir4): number => {
        const n = neighbor(cell, lateral);
        if (!f.has(n)) return 0;
        const diag = neighbor(n, d);
        if (!f.has(diag)) return 0;
        const other = f.mode(diag, lateral === L ? R : L);
        return Math.min(o, other ? OVER[other](input) : 0);
      };
      if (o > 0) {
        // Where the strip starts and ends along the edge: mitred at a concave end, cut short at an inset one.
        const cl = Math.max(concave(L), f.has(neighbor(cell, L)) ? 0 : trimOf(cell, L));
        const cr = Math.max(concave(R), f.has(neighbor(cell, R)) ? 0 : trimOf(cell, R));
        const il = f.has(neighbor(cell, L)) ? 0 : trimOf(cell, L), ir = f.has(neighbor(cell, R)) ? 0 : trimOf(cell, R);
        b.with({ color: look.color, pattern: look.pattern, ink: look.ink }, () => {
          patch(cell, P(il, 0), P(cl, o), P(0.5, o), P(0.5, 0));
          patch(cell, P(0.5, 0), P(0.5, o), P(1 - cr, o), P(1 - ir, 0));
        });
        if (HAS_FASCIA[m]) {
          b.with({ color: look.fascia, ink: look.fasciaInk }, () => {
            fascia(cell, P(cl, o), P(0.5, o));
            fascia(cell, P(0.5, o), P(1 - cr, o));
            soffit(cell, P(il, 0), P(cl, o), P(0.5, o), P(0.5, 0));
            soffit(cell, P(0.5, 0), P(0.5, o), P(1 - cr, o), P(1 - ir, 0));
          });
        }
      }
      // The outer corner at this edge's right end, shared with the side to the right.
      if (f.has(neighbor(cell, R))) continue;
      const mr = f.mode(cell, R);
      const or = mr ? OVER[mr](input) : 0;
      if (o > 0 && or > 0 && m !== 'wall' && mr !== 'wall') {
        const c0 = P(1, 0), c1 = P(1, o), c2 = P(1 + or, o), c3 = P(1 + or, 0);
        b.with({ color: look.color, pattern: look.pattern, ink: look.ink }, () => {
          tri(cell, c0, c1, c2);
          tri(cell, c0, c2, c3);
        });
        b.with({ color: look.fascia, ink: look.fasciaInk }, () => {
          if (HAS_FASCIA[m]) fascia(cell, c1, c2);
          if (mr && HAS_FASCIA[mr]) fascia(cell, c2, c3);
          if (HAS_FASCIA[m] || (mr && HAS_FASCIA[mr])) soffit(cell, c0, c1, c2, c3);
        });
      } else if (o > 0 && or === 0 && HAS_FASCIA[m] && (mr === 'cut' || mr === 'eave0')) {
        // The slab's end where an overhang stops at a party wall.
        b.with({ color: look.fascia, ink: look.fasciaInk }, () => fascia(cell, P(1, o), P(1, 0)));
      }
      // And the mirror case at the left end.
      const ml = f.has(neighbor(cell, L)) ? null : f.mode(cell, L);
      if (o > 0 && HAS_FASCIA[m] && (ml === 'cut' || ml === 'eave0')) {
        b.with({ color: look.fascia, ink: look.fasciaInk }, () => fascia(cell, P(0, 0), P(0, o)));
      }
    }
  }
  if (look.cap) {
    // A point on an overhang (outside every cell of the roof), where the slab's edge has a fascia.
    const cellSet = new Set(input.cells.map((c) => `${keyX(c)},${keyZ(c)}`));
    const inside = (x: number, z: number): boolean => cellSet.has(`${Math.floor(x)},${Math.floor(z)}`);
    const e = 1e-3;
    const overhang = (p: Vec3): boolean => !inside(p[0] - e, p[2] - e) && !inside(p[0] + e, p[2] - e) && !inside(p[0] - e, p[2] + e) && !inside(p[0] + e, p[2] + e);
    ridgeCaps(b, faces, look.cap, overhang);
  }
}

/** How far a cap's free end stands past the roof's edge (the step that keeps it off the fascia's plane). */
const RIDGE_PROUD = 0.004;

/**
 * Ridge and hip caps. Wherever two roof triangles meet at a fold that points
 * outward (a ridge or a hip, not a valley), lay a small tent of ridge tile
 * along the shared edge. Found from the drawn triangles, so it is right for
 * every roof type and footprint without knowing which is which.
 */
function ridgeCaps(
  b: MeshBuilder,
  faces: readonly { v: [Vec3, Vec3, Vec3]; flat: [Vec3, Vec3, Vec3]; n: Vec3 }[],
  cap: { color: ColorInput; ink: string; width: number; proud: number },
  overhang: (p: Vec3) => boolean,
): void {
  const q = (p: Vec3): string => `${Math.round(p[0] * 2000)},${Math.round(p[2] * 2000)}`;
  const edges = new Map<string, { face: number; a: number; b: number }[]>();
  faces.forEach((face, i) => {
    for (let k = 0; k < 3; k++) {
      const a = k, c = (k + 1) % 3;
      const ka = q(face.v[a]), kc = q(face.v[c]);
      const id = ka < kc ? `${ka}|${kc}` : `${kc}|${ka}`;
      const list = edges.get(id);
      if (list) list.push({ face: i, a, b: c });
      else edges.set(id, [{ face: i, a, b: c }]);
    }
  });
  const sub = (u: Vec3, v: Vec3): Vec3 => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
  const dot = (u: Vec3, v: Vec3): number => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const cross = (u: Vec3, v: Vec3): Vec3 => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const unit = (u: Vec3): Vec3 => {
    const l = Math.hypot(u[0], u[1], u[2]) || 1;
    return [u[0] / l, u[1] / l, u[2] / l];
  };
  const along = (p: Vec3, d: Vec3, t: number): Vec3 => [p[0] + d[0] * t, p[1] + d[1] * t, p[2] + d[2] * t];

  const folds: { a: Vec3; c: Vec3; n1: Vec3; n2: Vec3; d1: Vec3; d2: Vec3 }[] = [];
  const ends = new Map<string, number>();
  for (const pair of edges.values()) {
    if (pair.length !== 2) continue;
    const f1 = faces[pair[0]!.face]!, f2 = faces[pair[1]!.face]!;
    if (dot(f1.n, f2.n) > 0.985) continue; // the same slope, or nearly
    const a = f1.v[pair[0]!.a]!, c = f1.v[pair[0]!.b]!;
    // Outward fold: the far corner of the second triangle lies below the plane of the first.
    const far2 = f2.flat[3 - pair[1]!.a - pair[1]!.b]!, far1 = f1.flat[3 - pair[0]!.a - pair[0]!.b]!;
    const on = f1.flat[pair[0]!.a]!;
    if (dot(sub(far2, on), f1.n) > -1e-5) continue;
    const e = unit(sub(c, a));
    // In each slope, the direction straight away from the fold.
    let d1 = unit(cross(f1.n, e)), d2 = unit(cross(f2.n, e));
    if (dot(d1, sub(far1, on)) < 0) d1 = [-d1[0], -d1[1], -d1[2]];
    if (dot(d2, sub(far2, on)) < 0) d2 = [-d2[0], -d2[1], -d2[2]];
    folds.push({ a, c, n1: f1.n, n2: f2.n, d1, d2 });
    for (const p of [a, c]) ends.set(q(p), (ends.get(q(p)) ?? 0) + 1);
  }
  if (folds.length === 0) return;
  const hw = cap.width / 2;
  b.with({ color: cap.color, ink: cap.ink }, () => {
    for (const fold of folds) {
      const { n1, n2, d1, d2 } = fold;
      // Where the cap stops over an overhang (a ridge at a gable end) its end stands a hair proud of the
      // fascia, which lies in the same plane: flush, the two would trade pixels as the view turns. (At a
      // party wall it stops on the cell line, where the neighbour's cap begins.)
      const run = unit(sub(fold.c, fold.a));
      const proud = (p: Vec3): boolean => ends.get(q(p)) === 1 && overhang(p);
      const a = proud(fold.a) ? along(fold.a, run, -RIDGE_PROUD) : fold.a;
      const c = proud(fold.c) ? along(fold.c, run, RIDGE_PROUD) : fold.c;
      const up = unit([n1[0] + n2[0], n1[1] + n2[1], n1[2] + n2[2]]);
      const peakA = along(a, up, cap.proud), peakC = along(c, up, cap.proud);
      const side = (d: Vec3, n: Vec3): void => {
        const footA = along(along(a, d, hw), n, 0.003), footC = along(along(c, d, hw), n, 0.003);
        // Wind it so the face looks away from the roof.
        const normal = cross(sub(peakC, peakA), sub(footA, peakA));
        if (dot(normal, n) >= 0) b.quad(peakA, peakC, footC, footA);
        else b.quad(peakA, footA, footC, peakC);
      };
      side(d1, n1);
      side(d2, n2);
      // Close an end where the cap stops (a ridge at a gable end).
      for (const [p, peak, out, end] of [[a, peakA, -1, fold.a], [c, peakC, 1, fold.c]] as const) {
        if (ends.get(q(end)) !== 1) continue;
        const f1 = along(along(p, d1, hw), n1, 0.003), f2 = along(along(p, d2, hw), n2, 0.003);
        const e = sub(c, a);
        const normal = cross(sub(f1, peak), sub(f2, peak));
        if (dot(normal, e) * out >= 0) b.tri(peak, f1, f2);
        else b.tri(peak, f2, f1);
      }
    }
  });
}
