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

export type EdgeMode = 'eave' | 'eave0' | 'gutter' | 'rake' | 'cut' | 'wall';

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
  wall: (i) => i.into,
};
const IS_EAVE: Record<EdgeMode, boolean> = { eave: true, eave0: true, gutter: true, rake: false, cut: false, wall: false };
const HAS_FASCIA: Record<EdgeMode, boolean> = { eave: true, eave0: false, gutter: false, rake: true, cut: false, wall: false };

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
}

type P2 = readonly [number, number];

/** Emits the roof surface, its overhangs and its edge. World space. */
export function emitRoof(b: MeshBuilder, f: RoofField, look: RoofLook): void {
  const input = f.input;
  /** One triangle of roof over `cell`, counter-clockwise seen from above. */
  const tri = (cell: CellKey, p: P2, q: P2, r: P2): void => {
    const A: Vec3 = [p[0], f.planeAt(cell, p[0], p[1]), p[1]];
    const B: Vec3 = [q[0], f.planeAt(cell, q[0], q[1]), q[1]];
    const C: Vec3 = [r[0], f.planeAt(cell, r[0], r[1]), r[1]];
    // The shading normal is the true plane's, so sag never breaks a slope into tones.
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
    const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const n: Vec3 = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    if (Math.hypot(n[0], n[1], n[2]) < 1e-9) return;
    b.tri(
      [p[0], f.heightAt(cell, p[0], p[1]), p[1]],
      [q[0], f.heightAt(cell, q[0], q[1]), q[1]],
      [r[0], f.heightAt(cell, r[0], r[1]), r[1]],
      { normals: [n, n, n] },
    );
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
  const fascia = (cell: CellKey, p: P2, q: P2): void => {
    if (look.thick <= 0) return;
    const yp = f.heightAt(cell, p[0], p[1]), yq = f.heightAt(cell, q[0], q[1]);
    b.quad([p[0], yp - look.thick, p[1]], [q[0], yq - look.thick, q[1]], [q[0], yq, q[1]], [p[0], yp, p[1]]);
  };

  b.with({ color: look.color, pattern: look.pattern, ink: look.ink }, () => {
    for (const cell of input.cells) {
      const cx = keyX(cell), cz = keyZ(cell);
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 2; i++) {
          const xa = cx + i / 2, xb = xa + 0.5, za = cz + j / 2, zb = za + 0.5;
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
        const cl = concave(L), cr = concave(R);
        b.with({ color: look.color, pattern: look.pattern, ink: look.ink }, () => {
          patch(cell, P(0, 0), P(cl, o), P(0.5, o), P(0.5, 0));
          patch(cell, P(0.5, 0), P(0.5, o), P(1 - cr, o), P(1, 0));
        });
        if (HAS_FASCIA[m]) {
          b.with({ color: look.fascia, ink: look.fasciaInk }, () => {
            fascia(cell, P(cl, o), P(0.5, o));
            fascia(cell, P(0.5, o), P(1 - cr, o));
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
}
