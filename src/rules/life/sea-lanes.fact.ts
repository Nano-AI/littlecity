// The sea lane (L19): the way round the island that sailboats follow.
// Worked out from the terrain and what stands in the sea, and from nothing
// else, so the rule that counts the boats and the behaviour that sails them
// agree by construction.
//
// HOW. Everything that is not open sea is an obstacle: land, docks, anything
// built in or over the water. A lane point must be at least BOATS.laneClear
// (3) columns from every obstacle and BOATS.laneEdge from the edge of the map.
//
//   1. A distance field on a half-column grid: how far each point is from the
//      nearest obstacle column (exact at the samples, read between them with
//      a margin).
//   2. For 96 bearings round the island's middle, the stretch of each ray
//      that is clear, measured in from the map's edge.
//   3. A radius on each bearing, a little outside the inner end of that
//      stretch, smoothed round the circle without leaving it.
//
// If every bearing has a clear stretch the lane is a LOOP round the island.
// If land or a dock reaches the edge of the map somewhere, the longest clear
// arc is sailed there and back: out along its outer side, round, and home
// along its inner side (a SHUTTLE). Too short an arc, and there is no lane.
//
// A lane is a closed line either way; boats all sail it the same way round.

import { columnIndex, keyX, keyZ, SIZE_X, SIZE_Z, type CellKey } from '@/core/grid';
import type { Kind } from '@/core/kinds';
import type { Terrain } from '@/core/world';
import { defineFact } from '@/resolve/facts/api';
import { BOATS } from '@/style/boats';

export interface LanePoint {
  x: number;
  z: number;
  /** Unit tangent: the way a boat heads here. */
  dx: number;
  dz: number;
}

export interface SeaLane {
  kind: 'loop' | 'shuttle' | 'none';
  /** The closed line, as points [x, z] in sailing order. Empty when there is no lane. */
  points: readonly (readonly [number, number])[];
  /** Its length in columns (0 when there is none). */
  length: number;
  /** How far apart the two sides of a shuttle are at their narrowest (Infinity for a loop). */
  width: number;
  /** Where a boat is after `s` columns along the lane (wraps round), and which way it heads. */
  at(s: number): LanePoint;
  /** The distance along the lane of the point nearest (x, z). */
  nearest(x: number, z: number): number;
}

const BEARINGS = 96;
/** Samples per column of the distance field. */
const FINE = 2;
const NX = SIZE_X * FINE + 1, NZ = SIZE_Z * FINE + 1;
/** Reading the field between samples can be this far out: the lane keeps that much extra room. */
const MARGIN = 0.16;

/** How far every half-column grid point is from the nearest obstacle column (capped a little beyond what a lane needs). */
function distanceField(obstacle: Uint8Array, reach: number): Float32Array {
  const field = new Float32Array(NX * NZ).fill(reach);
  const is = (x: number, z: number): boolean => x >= 0 && z >= 0 && x < SIZE_X && z < SIZE_Z && obstacle[columnIndex(x, z)] === 1;
  for (let z = 0; z < SIZE_Z; z++) {
    for (let x = 0; x < SIZE_X; x++) {
      if (!is(x, z)) continue;
      // Only an obstacle with sea beside it can be the nearest one to a point at sea. A column whose
      // eight neighbours are all obstacles (or off the map on that side with obstacles round it) is not.
      let edge = false;
      for (let dz = -1; dz <= 1 && !edge; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ax = x + dx, az = z + dz;
          if (ax < 0 || az < 0 || ax >= SIZE_X || az >= SIZE_Z) continue;
          if (!is(ax, az)) {
            edge = true;
            break;
          }
        }
      }
      if (!edge) {
        // Inside the land: nothing sails here; mark its own samples and move on.
        for (let j = z * FINE; j <= (z + 1) * FINE; j++) for (let i = x * FINE; i <= (x + 1) * FINE; i++) field[i + j * NX] = 0;
        continue;
      }
      const i0 = Math.max(0, Math.floor((x - reach) * FINE)), i1 = Math.min(NX - 1, Math.ceil((x + 1 + reach) * FINE));
      const j0 = Math.max(0, Math.floor((z - reach) * FINE)), j1 = Math.min(NZ - 1, Math.ceil((z + 1 + reach) * FINE));
      for (let j = j0; j <= j1; j++) {
        const pz = j / FINE;
        const ez = pz < z ? z - pz : pz > z + 1 ? pz - z - 1 : 0;
        for (let i = i0; i <= i1; i++) {
          const px = i / FINE;
          const ex = px < x ? x - px : px > x + 1 ? px - x - 1 : 0;
          const d = Math.hypot(ex, ez);
          if (d < field[i + j * NX]!) field[i + j * NX] = d;
        }
      }
    }
  }
  return field;
}

function sample(field: Float32Array, x: number, z: number): number {
  const fx = Math.min(NX - 1.001, Math.max(0, x * FINE)), fz = Math.min(NZ - 1.001, Math.max(0, z * FINE));
  const i = Math.floor(fx), j = Math.floor(fz);
  const tx = fx - i, tz = fz - j;
  const a = field[i + j * NX]!, b = field[i + 1 + j * NX]!, c = field[i + (j + 1) * NX]!, d = field[i + 1 + (j + 1) * NX]!;
  return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
}

const NO_LANE: SeaLane = {
  kind: 'none',
  points: [],
  length: 0,
  width: 0,
  at: () => ({ x: SIZE_X / 2, z: SIZE_Z / 2, dx: 1, dz: 0 }),
  nearest: () => 0,
};

function laneFrom(kind: 'loop' | 'shuttle', points: [number, number][], width: number, reverse: boolean): SeaLane {
  if (reverse) points.reverse();
  const n = points.length;
  const cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const p = points[i]!, q = points[(i + 1) % n]!;
    cum[i + 1] = cum[i]! + Math.hypot(q[0] - p[0], q[1] - p[1]);
  }
  const length = cum[n]!;
  const where = (s: number): [number, number] => {
    let d = s % length;
    if (d < 0) d += length;
    // Segments are of similar length: start the search near the answer.
    let i = Math.min(n - 1, Math.floor((d / length) * n));
    while (i > 0 && cum[i]! > d) i--;
    while (i < n - 1 && cum[i + 1]! <= d) i++;
    const p = points[i]!, q = points[(i + 1) % n]!;
    const seg = cum[i + 1]! - cum[i]!;
    const t = seg > 0 ? (d - cum[i]!) / seg : 0;
    return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  };
  /** The heading is taken across a stretch of the lane, so it swings round a corner instead of snapping. */
  const look = Math.min(0.6, length / 8);
  return {
    kind,
    points,
    length,
    width,
    at(s) {
      const [x, z] = where(s);
      const a = where(s - look), b = where(s + look);
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const len = Math.hypot(dx, dz) || 1;
      return { x, z, dx: dx / len, dz: dz / len };
    },
    nearest(x, z) {
      let best = 0, bestD = Infinity;
      for (let i = 0; i < n; i++) {
        const p = points[i]!, q = points[(i + 1) % n]!;
        const ex = q[0] - p[0], ez = q[1] - p[1];
        const l2 = ex * ex + ez * ez;
        const t = l2 > 0 ? Math.min(1, Math.max(0, ((x - p[0]) * ex + (z - p[1]) * ez) / l2)) : 0;
        const d = Math.hypot(p[0] + ex * t - x, p[1] + ez * t - z);
        if (d < bestD) {
          bestD = d;
          best = cum[i]! + (cum[i + 1]! - cum[i]!) * t;
        }
      }
      return best;
    },
  };
}

/**
 * The lane for a terrain and the blocks standing on it. Pure.
 */
export function computeLane(terrain: Terrain, kinds: ReadonlyMap<CellKey, Kind>): SeaLane {
  const obstacle = new Uint8Array(SIZE_X * SIZE_Z);
  let cx = 0, cz = 0, land = 0;
  for (let z = 0; z < SIZE_Z; z++) {
    for (let x = 0; x < SIZE_X; x++) {
      if (terrain.height[columnIndex(x, z)]! > 0) {
        obstacle[columnIndex(x, z)] = 1;
        cx += x + 0.5;
        cz += z + 0.5;
        land++;
      }
    }
  }
  for (const cell of kinds.keys()) obstacle[columnIndex(keyX(cell), keyZ(cell))] = 1;
  if (land === 0) {
    cx = SIZE_X / 2;
    cz = SIZE_Z / 2;
  } else {
    cx /= land;
    cz /= land;
  }
  // Which way round the boats go is the island's own: half of all islands are sailed each way.
  const reverse = (terrain.seed & 1) === 1;
  const need = BOATS.laneClear + MARGIN;
  const field = distanceField(obstacle, need + 1);
  const edge = BOATS.laneEdge;
  const clearAt = (x: number, z: number): boolean => x >= edge && z >= edge && x <= SIZE_X - edge && z <= SIZE_Z - edge && sample(field, x, z) >= need;

  // ── each bearing: the clear stretch [lo, hi] of its ray, measured from the middle ──
  const cos: number[] = [], sin: number[] = [], lo: number[] = [], hi: number[] = [];
  for (let k = 0; k < BEARINGS; k++) {
    const a = (k / BEARINGS) * Math.PI * 2;
    const ux = Math.cos(a), uz = Math.sin(a);
    cos.push(ux);
    sin.push(uz);
    // Where the ray leaves the map (less the edge margin).
    const tx = ux > 1e-9 ? (SIZE_X - edge - cx) / ux : ux < -1e-9 ? (edge - cx) / ux : Infinity;
    const tz = uz > 1e-9 ? (SIZE_Z - edge - cz) / uz : uz < -1e-9 ? (edge - cz) / uz : Infinity;
    const out = Math.min(tx, tz) - 1e-6;
    if (!(out > 0) || !clearAt(cx + ux * out, cz + uz * out)) {
      lo.push(1);
      hi.push(0);
      continue;
    }
    let r = out;
    while (r - 0.2 > 0 && clearAt(cx + ux * (r - 0.2), cz + uz * (r - 0.2))) r -= 0.2;
    lo.push(r);
    hi.push(out);
  }
  const open = (k: number): boolean => lo[k]! <= hi[k]!;

  /** A radius for each bearing in `ks` (consecutive bearings), smoothed along the run and kept inside each stretch. */
  const radii = (ks: number[], wrap: boolean): number[] => {
    const r = ks.map((k) => {
      const band = hi[k]! - lo[k]!;
      // A little off the inner limit; out at sea if the island is tiny or there is none.
      return Math.min(hi[k]!, Math.max(lo[k]! + Math.min(1.1, band * 0.5), Math.min(10, hi[k]! * 0.6)));
    });
    const m = r.length;
    for (let pass = 0; pass < 40; pass++) {
      for (let i = 0; i < m; i++) {
        const a = wrap ? r[(i + m - 1) % m]! : r[Math.max(0, i - 1)]!, c = wrap ? r[(i + 1) % m]! : r[Math.min(m - 1, i + 1)]!;
        const k = ks[i]!;
        r[i] = Math.min(hi[k]!, Math.max(lo[k]!, 0.25 * a + 0.5 * r[i]! + 0.25 * c));
      }
    }
    return r;
  };
  /** True if the whole closed line is clear, checked every quarter column. */
  const sound = (pts: [number, number][]): boolean => {
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!, q = pts[(i + 1) % pts.length]!;
      const steps = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 0.25));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const x = p[0] + (q[0] - p[0]) * t, z = p[1] + (q[1] - p[1]) * t;
        if (x < edge - 1e-6 || z < edge - 1e-6 || x > SIZE_X - edge + 1e-6 || z > SIZE_Z - edge + 1e-6) return false;
        if (sample(field, x, z) < BOATS.laneClear + MARGIN * 0.5) return false;
      }
    }
    return true;
  };

  const all = Array.from({ length: BEARINGS }, (_, k) => k);
  if (all.every(open)) {
    const r = radii(all, true);
    const pts = all.map((k): [number, number] => [cx + cos[k]! * r[k]!, cz + sin[k]! * r[k]!]);
    if (sound(pts)) return laneFrom('loop', pts, Infinity, reverse);
    // A chord cut a corner somewhere: close the bearings beside it and fall through to a shuttle.
    for (let k = 0; k < BEARINGS; k++) {
      const p = pts[k]!, q = pts[(k + 1) % BEARINGS]!;
      if (!sound([p, q])) {
        hi[k] = 0;
        hi[(k + 1) % BEARINGS] = 0;
      }
    }
  }

  // ── a shuttle: the longest run of open bearings, sailed out along its outer side and back along its inner ──
  let bestStart = -1, bestLen = 0;
  for (let k = 0; k < BEARINGS; k++) {
    if (!open(k) || open((k + BEARINGS - 1) % BEARINGS)) continue;
    let len = 0;
    while (len < BEARINGS && open((k + len) % BEARINGS)) len++;
    if (len > bestLen) {
      bestLen = len;
      bestStart = k;
    }
  }
  if (bestLen < 5) return NO_LANE;
  const run = Array.from({ length: bestLen }, (_, i) => (bestStart + i) % BEARINGS);
  const mid = radii(run, false);
  // Half the gap between the two sides: as wide as the clear stretch allows, and no wider than a boat needs.
  const half = run.map((k, i) => Math.max(0, Math.min(0.7, hi[k]! - mid[i]!, mid[i]! - lo[k]!)));
  for (let pass = 0; pass < 20; pass++) {
    for (let i = 0; i < half.length; i++) half[i] = Math.min(half[i]!, 0.5 * (half[Math.max(0, i - 1)]! + half[Math.min(half.length - 1, i + 1)]!) + 0.02);
  }
  // The two ends are where the boat turns round: the sides start one bearing in, and meet at the end's middle.
  const pts: [number, number][] = [];
  const at = (i: number, r: number): [number, number] => [cx + cos[run[i]!]! * r, cz + sin[run[i]!]! * r];
  pts.push(at(0, mid[0]!));
  for (let i = 1; i < bestLen - 1; i++) pts.push(at(i, mid[i]! + half[i]!));
  pts.push(at(bestLen - 1, mid[bestLen - 1]!));
  for (let i = bestLen - 2; i >= 1; i--) pts.push(at(i, mid[i]! - half[i]!));
  let reach = 0;
  for (let i = 0; i + 1 < bestLen; i++) reach += Math.hypot(at(i + 1, mid[i + 1]!)[0] - at(i, mid[i]!)[0], at(i + 1, mid[i + 1]!)[1] - at(i, mid[i]!)[1]);
  if (reach < BOATS.laneMin || !sound(pts)) return NO_LANE;
  let width = Infinity;
  for (let i = 1; i < bestLen - 1; i++) width = Math.min(width, half[i]! * 2);
  return laneFrom('shuttle', pts, width, reverse);
}

/** How far (x, z) is from the nearest obstacle column: land, or any column with a block in it. Exact; for tests. */
export function obstacleDistance(terrain: Terrain, kinds: ReadonlyMap<CellKey, Kind>, x: number, z: number): number {
  const blocked = new Set<number>();
  for (const cell of kinds.keys()) blocked.add(columnIndex(keyX(cell), keyZ(cell)));
  let best = Infinity;
  for (let cz = 0; cz < SIZE_Z; cz++) {
    for (let cx = 0; cx < SIZE_X; cx++) {
      if (terrain.height[columnIndex(cx, cz)] === 0 && !blocked.has(columnIndex(cx, cz))) continue;
      const ex = x < cx ? cx - x : x > cx + 1 ? x - cx - 1 : 0;
      const ez = z < cz ? cz - z : z > cz + 1 ? z - cz - 1 : 0;
      best = Math.min(best, Math.hypot(ex, ez));
    }
  }
  return best;
}

export const seaLane = defineFact<SeaLane>('seaLane', (f) => computeLane(f.terrain, f.kinds));
