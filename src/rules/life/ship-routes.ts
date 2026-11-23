// Ways for the big ships (L38–L42): how far every point of the sea is from
// anything a hull must not touch, whether a hull fits at a pose, and routes
// from the edge of the map to a berth and away again that a whole hull can
// sail, bow first, round gentle curves. Pure: it reads a terrain and the
// columns that hold anything, and nothing else, so the rules (is there a
// way in?) and the harbour system (sail it) agree by construction.
//
// HOW.
//   1. Obstacles are columns: land (terrain above the sea), anything built in
//      a column (a dock, a pier, a bridge over the water, a house on stilts),
//      and whatever the caller adds (a moored ship, the small boats'
//      moorings). A distance field on a half-column grid says how far each
//      point is from the nearest obstacle column.
//   2. A hull is a line of discs from stern to bow, narrower at the ends. It
//      fits at a pose if each disc's centre is at least its radius (plus a
//      margin) from every obstacle: `hullClear`.
//   3. A route is a shortest way over column centres where a hull fits
//      (Dijkstra; a little dearer where the water is tight), its corners cut
//      where the straight run between two points is clear, then rounded
//      (Chaikin) where the rounding stays clear. A whole path is then swept
//      with the hull, heading along its tangent: `pathClear`.
//   4. An arrival comes up over an edge of the map, sails the route to a
//      point astern of the berth, lines up with the quay and glides along it
//      to lie a little off; the mooring lines take it the last stretch. A
//      departure glides on ahead and turns away to another edge.

import { columnIndex, keyX, keyZ, SIZE_X, SIZE_Z, type CellKey } from '@/core/grid';
import type { Kind } from '@/core/kinds';
import type { Terrain } from '@/core/world';
import { TERRAIN } from '@/style/terrain';

export type Pt = readonly [number, number];

/** Samples per column of the distance field. */
const FINE = 2;
const NX = SIZE_X * FINE + 1, NZ = SIZE_Z * FINE + 1;
/** Distances are worked out this far; anything further is "far". */
const REACH = 6;

export interface SeaField {
  /** Obstacle columns, one byte each (1 = blocked). */
  blocked: Uint8Array;
  /** Distance from each half-column sample to the nearest obstacle column, capped at REACH. */
  dist: Float32Array;
  /** Distance at any point (bilinear between samples; off the map: from the nearest sample). */
  at(x: number, z: number): number;
}

/** The obstacle columns of a town: land, and every column with anything built in it. */
export function obstacleColumns(terrain: Terrain, kinds: ReadonlyMap<CellKey, Kind> | Iterable<CellKey>): Uint8Array {
  const m = new Uint8Array(SIZE_X * SIZE_Z);
  for (let i = 0; i < m.length; i++) if (terrain.height[i]! > 0) m[i] = 1;
  const keys = kinds instanceof Map ? kinds.keys() : (kinds as Iterable<CellKey>);
  for (const k of keys) m[columnIndex(keyX(k), keyZ(k))] = 1;
  return m;
}

/** Fields worked out lately, newest first. Callers share them and none writes to `blocked` or `dist`. */
const recent: { hash: number; key: Uint8Array; field: SeaField }[] = [];
const RECENT = 4;

/** The field for a mask, worked out once per shape of shore: nearly every resolve asks again with the same columns. */
export function seaField(blocked: Uint8Array): SeaField {
  let hash = 2166136261;
  for (let i = 0; i < blocked.length; i++) hash = Math.imul(hash ^ blocked[i]!, 16777619);
  const at = recent.findIndex((r) => r.hash === hash && r.key.length === blocked.length && r.key.every((b, i) => b === blocked[i]));
  if (at >= 0) {
    const [hit] = recent.splice(at, 1);
    recent.unshift(hit!);
    return hit!.field;
  }
  // The key is a private copy: a caller reuses and edits its own mask after asking.
  const key = blocked.slice();
  const field = seaFieldUncached(key);
  recent.unshift({ hash, key, field });
  if (recent.length > RECENT) recent.pop();
  return field;
}

export function seaFieldUncached(blocked: Uint8Array): SeaField {
  const dist = new Float32Array(NX * NZ).fill(REACH);
  const is = (x: number, z: number): boolean => x >= 0 && z >= 0 && x < SIZE_X && z < SIZE_Z && blocked[columnIndex(x, z)] === 1;
  for (let z = 0; z < SIZE_Z; z++) {
    for (let x = 0; x < SIZE_X; x++) {
      if (!is(x, z)) continue;
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
        for (let j = z * FINE; j <= (z + 1) * FINE; j++) for (let i = x * FINE; i <= (x + 1) * FINE; i++) dist[i + j * NX] = 0;
        continue;
      }
      const i0 = Math.max(0, Math.floor((x - REACH) * FINE)), i1 = Math.min(NX - 1, Math.ceil((x + 1 + REACH) * FINE));
      const j0 = Math.max(0, Math.floor((z - REACH) * FINE)), j1 = Math.min(NZ - 1, Math.ceil((z + 1 + REACH) * FINE));
      for (let j = j0; j <= j1; j++) {
        const pz = j / FINE;
        const ez = pz < z ? z - pz : pz > z + 1 ? pz - z - 1 : 0;
        for (let i = i0; i <= i1; i++) {
          const px = i / FINE;
          const ex = px < x ? x - px : px > x + 1 ? px - x - 1 : 0;
          const d = Math.hypot(ex, ez);
          if (d < dist[i + j * NX]!) dist[i + j * NX] = d;
        }
      }
    }
  }
  return {
    blocked,
    dist,
    at(x, z) {
      const fx = Math.min(NX - 1.001, Math.max(0, x * FINE)), fz = Math.min(NZ - 1.001, Math.max(0, z * FINE));
      const i = Math.floor(fx), j = Math.floor(fz);
      const tx = fx - i, tz = fz - j;
      const a = dist[i + j * NX]!, b = dist[i + 1 + j * NX]!, c = dist[i + (j + 1) * NX]!, d = dist[i + 1 + (j + 1) * NX]!;
      // Bilinear reading can overstate the distance a little between samples round a corner: take a bit off.
      return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz - 0.04;
    },
  };
}

/** A hull for keeping clear: its extent along its length from its origin (stern < 0 < bow) and its half-beam. */
export interface HullSize {
  stern: number;
  bow: number;
  halfBeam: number;
}

/** The discs that stand for a hull: [along, radius] pairs, stern to bow. */
function discsOf(h: HullSize): [number, number][] {
  const len = h.bow - h.stern;
  const n = Math.max(3, Math.ceil(len / 0.45));
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    // Full beam over the middle; toward the ends the hull narrows (a sharper bow than stern).
    const w = u < 0.25 ? 0.55 + 0.45 * (u / 0.25) : u > 0.62 ? Math.max(0.2, 1 - 0.8 * ((u - 0.62) / 0.38) ** 1.4) : 1;
    out.push([h.stern + len * u, h.halfBeam * w]);
  }
  return out;
}
const DISCS = new WeakMap<HullSize, [number, number][]>();

/** Does the hull fit with its origin at (x, z), heading `yaw` (0 = +Z), `margin` clear of everything? */
export function hullClear(field: SeaField, h: HullSize, x: number, z: number, yaw: number, margin: number): boolean {
  let discs = DISCS.get(h);
  if (!discs) DISCS.set(h, (discs = discsOf(h)));
  const sx = Math.sin(yaw), cz = Math.cos(yaw);
  for (const [along, r] of discs) {
    if (field.at(x + sx * along, z + cz * along) < r + margin) return false;
  }
  return true;
}

// ───────────────────────────────────────────────────────────── paths ──

export interface Path {
  points: Pt[];
  /** Cumulative length at each point. */
  cum: number[];
  length: number;
}

export function pathOf(points: readonly Pt[]): Path {
  const pts = points.filter((p, i) => i === 0 || Math.hypot(p[0] - points[i - 1]![0], p[1] - points[i - 1]![1]) > 1e-6);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  return { points: pts as Pt[], cum, length: cum[cum.length - 1]! };
}

/** Where a path is at distance s, and its heading there (taken over a short stretch, so it turns smoothly). */
export function pathAt(p: Path, s: number, out = { x: 0, z: 0, yaw: 0 }): { x: number; z: number; yaw: number } {
  const where = (d: number): [number, number] => {
    const pts = p.points;
    if (pts.length === 1) return [pts[0]![0], pts[0]![1]];
    const c = Math.max(0, Math.min(p.length, d));
    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (p.cum[mid]! <= c) lo = mid;
      else hi = mid;
    }
    const seg = p.cum[hi]! - p.cum[lo]!;
    const t = seg > 0 ? (c - p.cum[lo]!) / seg : 0;
    return [pts[lo]![0] + (pts[hi]![0] - pts[lo]![0]) * t, pts[lo]![1] + (pts[hi]![1] - pts[lo]![1]) * t];
  };
  const [x, z] = where(s);
  const look = 0.5;
  let a = where(s - look), b = where(s + look);
  if (s - look < 0) {
    // At the start: look ahead only.
    a = where(0);
    b = where(Math.min(p.length, 2 * look));
  } else if (s + look > p.length) {
    a = where(Math.max(0, p.length - 2 * look));
    b = where(p.length);
  }
  out.x = x;
  out.z = z;
  out.yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
  return out;
}

/** Sweeps a hull along a path (from `from` to `to`, every `step`), heading along it. True if it fits all the way. */
export function pathClear(field: SeaField, h: HullSize, p: Path, margin: number, from = 0, to = p.length, step = 0.25): boolean {
  const q = { x: 0, z: 0, yaw: 0 };
  for (let s = from; s <= to + 1e-9; s += step) {
    pathAt(p, Math.min(s, to), q);
    if (!hullClear(field, h, q.x, q.z, q.yaw, margin)) return false;
  }
  return true;
}

/** A straight run from a to b where a disc of radius r (plus margin) fits all the way. */
function runClear(field: SeaField, a: Pt, b: Pt, r: number): boolean {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.ceil(len / 0.2));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (field.at(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) < r) return false;
  }
  return true;
}

/** Chaikin's corner cutting, `rounds` times, keeping the ends. */
export function chaikin(pts: readonly Pt[], rounds: number): Pt[] {
  let p = pts.slice() as Pt[];
  for (let k = 0; k < rounds; k++) {
    if (p.length < 3) return p;
    const out: Pt[] = [p[0]!];
    for (let i = 0; i + 1 < p.length; i++) {
      const a = p[i]!, b = p[i + 1]!;
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    out.push(p[p.length - 1]!);
    p = out;
  }
  return p;
}

/** Columns a hull of half-beam `r` may have its middle in: clear of obstacles by r. */
export interface Graph {
  field: SeaField;
  r: number;
  /** Shortest cost from the source to every column (Infinity: unreachable). */
  cost: Float64Array;
  prev: Int32Array;
}

const inMap = (x: number, z: number): boolean => x >= 0 && z >= 0 && x < SIZE_X && z < SIZE_Z;

/** Dijkstra from the column holding `from` over columns where a disc of radius r fits. */
export function graphFrom(field: SeaField, from: Pt, r: number): Graph {
  const n = SIZE_X * SIZE_Z;
  const cost = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const sx = Math.floor(from[0]), sz = Math.floor(from[1]);
  const g: Graph = { field, r, cost, prev };
  if (!inMap(sx, sz)) return g;
  const ok = (x: number, z: number): boolean => inMap(x, z) && field.at(x + 0.5, z + 0.5) >= r;
  const start = columnIndex(sx, sz);
  cost[start] = 0;
  const heap: [number, number][] = [[0, start]];
  const less = (a: [number, number], b: [number, number]): boolean => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
  const push = (d: number, i: number): void => {
    heap.push([d, i]);
    for (let k = heap.length - 1; k > 0; ) {
      const p = (k - 1) >> 1;
      if (!less(heap[k]!, heap[p]!)) break;
      [heap[p], heap[k]] = [heap[k]!, heap[p]!];
      k = p;
    }
  };
  const pop = (): [number, number] => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let k = 0; ; ) {
        const l = 2 * k + 1, rr = l + 1;
        let s = k;
        if (l < heap.length && less(heap[l]!, heap[s]!)) s = l;
        if (rr < heap.length && less(heap[rr]!, heap[s]!)) s = rr;
        if (s === k) break;
        [heap[s], heap[k]] = [heap[k]!, heap[s]!];
        k = s;
      }
    }
    return top;
  };
  const done = new Uint8Array(n);
  while (heap.length) {
    const [d, i] = pop();
    if (done[i]) continue;
    done[i] = 1;
    const x = i % SIZE_X, z = (i - x) / SIZE_X;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dz === 0) continue;
        const ax = x + dx, az = z + dz;
        if (!ok(ax, az)) continue;
        if (dx !== 0 && dz !== 0 && (!ok(x + dx, z) || !ok(x, z + dz))) continue;
        const j = columnIndex(ax, az);
        // Dearer where the water is tight: ships keep to the middle of a channel and well off the land.
        const room = field.at(ax + 0.5, az + 0.5);
        const nd = d + (dx !== 0 && dz !== 0 ? Math.SQRT2 : 1) * (1 + 1.5 * Math.max(0, r + 1.5 - room));
        if (nd < cost[j]!) {
          cost[j] = nd;
          prev[j] = i;
          push(nd, j);
        }
      }
    }
  }
  return g;
}

/** The column route from a graph's source to the column holding `to`, as points to steer for, source first; null if none. */
export function routeTo(g: Graph, from: Pt, to: Pt): Pt[] | null {
  const tx = Math.floor(to[0]), tz = Math.floor(to[1]);
  if (!inMap(tx, tz)) return null;
  const goal = columnIndex(tx, tz);
  if (g.cost[goal] === Infinity) return null;
  const cols: Pt[] = [];
  for (let i = goal; i !== -1; i = g.prev[i]!) cols.push([(i % SIZE_X) + 0.5, Math.floor(i / SIZE_X) + 0.5]);
  cols.reverse();
  const pts: Pt[] = [from, ...cols.slice(1, -1), to];
  // Cut the corners: from each point, straight to the farthest later one that can be reached clear.
  const out: Pt[] = [from];
  for (let i = 0; i < pts.length - 1; ) {
    let j = pts.length - 1;
    while (j > i + 1 && !runClear(g.field, pts[i]!, pts[j]!, g.r)) j--;
    out.push(pts[j]!);
    i = j;
  }
  return out;
}

// ─────────────────────────────────────────────── edges of the map ──

export interface EdgePoint {
  x: number;
  z: number;
  /** Heading into the map (yaw). */
  yaw: number;
  /** Which edge: 0 N (z small), 1 E, 2 S, 3 W. */
  side: number;
}

/**
 * Points `inset` columns in from the map's edge, every 2 columns, where a hull of half-beam r fits. Only
 * on the straight part of each side (the slab's corners are rounded): a ship crosses the edge square to it.
 */
export function edgePoints(field: SeaField, inset: number, r: number): EdgePoint[] {
  const out: EdgePoint[] = [];
  const keep = Math.ceil(TERRAIN.slabRadius + r + 1);
  for (let v = keep; v <= SIZE_X - keep; v += 2) {
    out.push({ x: v, z: inset, yaw: 0, side: 0 });
    out.push({ x: SIZE_X - inset, z: v, yaw: -Math.PI / 2, side: 1 });
    out.push({ x: v, z: SIZE_Z - inset, yaw: Math.PI, side: 2 });
    out.push({ x: inset, z: v, yaw: Math.PI / 2, side: 3 });
  }
  return out.filter((p) => field.at(p.x, p.z) >= r + 0.3);
}

// ───────────────────────────────────────────────── a ship's visit ──

/** Where a ship lies at a berth, and the line it comes in on. */
export interface Mooring {
  /** The ship's origin moored, and its heading. */
  x: number;
  z: number;
  yaw: number;
  /** Where the mooring lines take over: the same, out from the quay by the warp gap. */
  wx: number;
  wz: number;
  /** Unit vector from the quay out to the water. */
  ox: number;
  oz: number;
}

export interface Pose {
  x: number;
  z: number;
  yaw: number;
}

/** How far beyond the map's edge a ship's way starts and ends, for a hull of this length: all of it out of sight. */
export const beyond = (h: HullSize): number => h.bow - h.stern + 2.5;

/** Signed distance from the map's edge (the slab's rounded square): negative inside. The renderer's wall is the same. */
export function mapEdge(x: number, z: number): number {
  const R = TERRAIN.slabRadius;
  const qx = Math.abs(x - SIZE_X / 2) - (SIZE_X / 2 - R), qz = Math.abs(z - SIZE_Z / 2) - (SIZE_Z / 2 - R);
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - R;
}

export interface Voyage {
  /** From beyond the edge to where it swings in (arriving), or from where it has swung out to beyond the edge (leaving). */
  path: Path;
  /** The edge it comes in over or goes out over. */
  edge: EdgePoint;
  /**
   * The swing at the quay end: arriving, the ship ends the path heading in toward the quay by `swing`
   * radians and its stern swings in about its bow until it lies along the quay; leaving, its bow swings
   * out about its stern by `swing` before it sails. 0 when it lines up straight.
   */
  swing: number;
  /** The pose the swing starts from (arriving: the path's end) or ends at (leaving: the path's start). */
  swung: Pose;
  /**
   * Leaving with no way ahead (a closed basin): towed out from the quay by this far first, and the swing is
   * a turn about its middle instead of its stern. 0: not towed.
   */
  tow: number;
}

/** The pose of a hull turned by `angle` about a point `along` its length from the origin of pose `p`. */
export function pivot(p: Pose, along: number, angle: number, out: Pose = { x: 0, z: 0, yaw: 0 }): Pose {
  const px = p.x + Math.sin(p.yaw) * along, pz = p.z + Math.cos(p.yaw) * along;
  const yaw = p.yaw + angle;
  out.x = px - Math.sin(yaw) * along;
  out.z = pz - Math.cos(yaw) * along;
  out.yaw = yaw;
  return out;
}

/** Which way (±1) a turn of the heading takes the bow out toward the water at a mooring. */
export function outward(m: Mooring): number {
  return Math.cos(m.yaw) * m.ox - Math.sin(m.yaw) * m.oz >= 0 ? 1 : -1;
}

/** The hull fits all through a swing about a point `along` it, from `a0` to `a1` radians off pose `p`. */
function swingClear(field: SeaField, h: HullSize, p: Pose, along: number, a0: number, a1: number, margin: number): boolean {
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 0.05));
  const q: Pose = { x: 0, z: 0, yaw: 0 };
  for (let i = 0; i <= n; i++) {
    pivot(p, along, a0 + ((a1 - a0) * i) / n, q);
    if (!hullClear(field, h, q.x, q.z, q.yaw, margin)) return false;
  }
  return true;
}

/** Swings tried at the quay, straight first. */
const SWINGS = [0, 0.3, 0.55, 0.8];
/** Margin while lying close along the quay and swinging. */
const NEAR = 0.1;

/** The mooring for a hull at a berth line (quay face from (ax, az) running `len` along (dx, dz), water toward (ox, oz)), heading +1 or −1 along it. */
export function mooringAt(h: HullSize, face: { ax: number; az: number; dx: number; dz: number; len: number; ox: number; oz: number }, dir: 1 | -1, alongside: number, warpGap: number): Mooring {
  const off = alongside + h.halfBeam;
  // The hull's middle at the middle of the berth.
  const mid = (h.stern + h.bow) / 2;
  const hx = face.dx * dir, hz = face.dz * dir;
  const cx = face.ax + face.dx * face.len * 0.5 + face.ox * off;
  const cz = face.az + face.dz * face.len * 0.5 + face.oz * off;
  const x = cx - hx * mid, z = cz - hz * mid;
  return { x, z, yaw: Math.atan2(hx, hz), wx: x + face.ox * warpGap, wz: z + face.oz * warpGap, ox: face.ox, oz: face.oz };
}

/** Rounds a route's corners where the rounding stays clear for a disc of radius r; else leaves it. */
function smoothRoute(field: SeaField, pts: Pt[], r: number): Pt[] {
  for (const rounds of [3, 2, 1]) {
    const c = chaikin(pts, rounds);
    let ok = true;
    for (let i = 0; i + 1 < c.length && ok; i++) ok = runClear(field, c[i]!, c[i + 1]!, r * 0.9);
    if (ok) return c;
  }
  return pts;
}

/**
 * The way in to a mooring: from an edge of the map, round to a point astern of where it swings in, lined
 * up, ending at the swing (or straight at the warp point). Null if a hull cannot get there. `pick` (0–1)
 * chooses among the nearest edges for variety; `avoid` is an edge side not to come in over if there is
 * another (−1 none); `start` replaces the edge (a ship already at sea).
 */
export function planArrival(field: SeaField, h: HullSize, m: Mooring, inset: number, margin: number, pick = 0, avoid = -1, start?: Pose): Voyage | null {
  const len = h.bow - h.stern;
  const r = h.halfBeam + margin;
  const warp: Pose = { x: m.wx, z: m.wz, yaw: m.yaw };
  const sense = outward(m);
  for (const swing of SWINGS) {
    // Heading in toward the quay by `swing`, its bow where the bow lies at the warp point.
    const end = pivot(warp, h.bow, -sense * swing);
    if (!swingClear(field, h, warp, h.bow, -sense * swing, 0, NEAR)) continue;
    const hx = Math.sin(end.yaw), hz = Math.cos(end.yaw);
    // Lined up well astern where there is room; closer in (a basin, a short reach) where there is not.
    for (const [back, out] of [[1.9, 0.9], [1.9, 1.6], [1.9, 0.4], [1.9, 2.4], [1.3, 0.9], [1.3, 1.8], [1.0, 1.2], [1.0, 2.2]] as const) {
      const lineup: Pt = [end.x - hx * len * back * 0.47, end.z - hz * len * back * 0.47];
      const stage: Pt = [end.x - hx * len * back + m.ox * out, end.z - hz * len * back + m.oz * out];
      if (field.at(stage[0], stage[1]) < r) continue;
      const g = graphFrom(field, stage, r);
      const tail: Pt[] = [stage, lineup, [end.x, end.z]];
      let starts: EdgePoint[];
      if (start) starts = [{ x: start.x, z: start.z, yaw: start.yaw, side: -1 }];
      else {
        starts = edgePoints(field, inset, r).filter((e) => g.cost[columnIndex(Math.floor(e.x), Math.floor(e.z))]! < Infinity);
        starts.sort((a, b) => g.cost[columnIndex(Math.floor(a.x), Math.floor(a.z))]! - g.cost[columnIndex(Math.floor(b.x), Math.floor(b.z))]! || a.side - b.side || a.x + a.z - b.x - b.z);
        if (avoid >= 0 && starts.some((e) => e.side !== avoid)) starts = starts.filter((e) => e.side !== avoid);
        // One of the nearest few, seeded, so ships do not always come the same way.
        const few = starts.slice(0, Math.min(starts.length, 4));
        const first = few[Math.min(few.length - 1, Math.floor(pick * few.length))];
        starts = first ? [first, ...starts.filter((e) => e !== first)] : starts;
      }
      for (const e of starts.slice(0, 5)) {
        // From beyond the edge, square in through it (or on ahead from where it is), then the route.
        const out = start ? 0 : beyond(h);
        const outside: Pt = [e.x - Math.sin(e.yaw) * out, e.z - Math.cos(e.yaw) * out];
        const from: Pt = [e.x, e.z];
        const ahead: Pt = [e.x + Math.sin(e.yaw) * 2.5, e.z + Math.cos(e.yaw) * 2.5];
        const back = routeTo(g, stage, ahead);
        if (!back) continue;
        const route = [...(start ? [] : [outside]), from, ...back.slice().reverse().slice(0, -1), ...tail];
        const path = pathOf(smoothRoute(field, dedupe(route), r));
        const near = Math.max(0, path.length - len * 1.6);
        if (pathClear(field, h, path, margin, start ? 0 : out, near) && pathClear(field, h, path, NEAR, near, path.length)) {
          return { path, edge: e, swing: -sense * swing, swung: end, tow: 0 };
        }
      }
    }
  }
  return null;
}

/**
 * The way out from the warp point: the bow swings out about the stern (if it must), on ahead, then round
 * to an edge (not `avoid` if it can). `from` replaces the warp point (a ship already under way: no swing).
 */
export function planDeparture(field: SeaField, h: HullSize, m: Mooring, inset: number, margin: number, pick = 0, avoid = -1, from?: Pose): Voyage | null {
  const len = h.bow - h.stern;
  const r = h.halfBeam + margin;
  const warp: Pose = { x: m.wx, z: m.wz, yaw: m.yaw };
  const sense = outward(m);
  for (const swing of from ? [0] : SWINGS) {
    const s0 = from ?? pivot(warp, h.stern, sense * swing);
    if (!from && !swingClear(field, h, warp, h.stern, 0, sense * swing, NEAR)) continue;
    const hx = Math.sin(s0.yaw), hz = Math.cos(s0.yaw);
    for (const run of [0.9, 0.5, 1.4]) {
      for (const out of from ? [0] : [0.9, 1.8, 0.3]) {
        const ahead: Pt = [s0.x + hx * len * run + m.ox * out * 0.4, s0.z + hz * len * run + m.oz * out * 0.4];
        const clear: Pt = [s0.x + hx * len * (run + 1) + m.ox * out, s0.z + hz * len * (run + 1) + m.oz * out];
        if (field.at(clear[0], clear[1]) < r) continue;
        const g = graphFrom(field, clear, r);
        let ends = edgePoints(field, inset, r).filter((e) => g.cost[columnIndex(Math.floor(e.x), Math.floor(e.z))]! < Infinity);
        ends.sort((a, b) => g.cost[columnIndex(Math.floor(a.x), Math.floor(a.z))]! - g.cost[columnIndex(Math.floor(b.x), Math.floor(b.z))]! || a.side - b.side || a.x + a.z - b.x - b.z);
        if (avoid >= 0 && ends.some((e) => e.side !== avoid)) ends = ends.filter((e) => e.side !== avoid);
        const few = ends.slice(0, Math.min(ends.length, 4));
        const first = few[Math.min(few.length - 1, Math.floor(pick * few.length))];
        ends = first ? [first, ...ends.filter((e) => e !== first)] : ends;
        for (const e of ends.slice(0, 5)) {
          const outward: Pt = [e.x + Math.sin(e.yaw) * 2.5, e.z + Math.cos(e.yaw) * 2.5];
          const way = routeTo(g, clear, outward);
          if (!way) continue;
          // Out through the edge, square to it, and on until all of it is beyond.
          const out = beyond(h);
          const outside: Pt = [e.x - Math.sin(e.yaw) * out, e.z - Math.cos(e.yaw) * out];
          const route = [[s0.x, s0.z] as Pt, ahead, ...way.slice(0, -1), [e.x, e.z] as Pt, outside];
          const path = pathOf(smoothRoute(field, dedupe(route), r));
          const near = Math.min(path.length, len * 1.4);
          if (pathClear(field, h, path, NEAR, 0, near) && pathClear(field, h, path, margin, near, Math.max(near, path.length - out))) {
            return { path, edge: { ...e, yaw: e.yaw + Math.PI }, swing: from ? 0 : sense * swing, swung: s0, tow: 0 };
          }
        }
      }
    }
  }
  if (from) return null;
  // No way out ahead: towed out from the quay and turned round about its middle, then away.
  const mid = (h.stern + h.bow) / 2;
  for (const tow of [2.2, 3.2, 4.2]) {
    const towed: Pose = { x: m.wx + m.ox * tow, z: m.wz + m.oz * tow, yaw: m.yaw };
    let ok = true;
    for (let d = 0; d <= tow && ok; d += 0.25) ok = hullClear(field, h, m.wx + m.ox * d, m.wz + m.oz * d, m.yaw, NEAR);
    if (!ok) continue;
    for (const turn of [sense * Math.PI, -sense * Math.PI]) {
      if (!swingClear(field, h, towed, mid, 0, turn, NEAR)) continue;
      const turned = pivot(towed, mid, turn);
      const v = planDeparture(field, h, m, inset, margin, pick, avoid, turned);
      if (v) return { ...v, swing: turn, swung: turned, tow };
    }
  }
  return null;
}

function dedupe(pts: Pt[]): Pt[] {
  return pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1]![0], p[1] - pts[i - 1]![1]) > 0.05);
}
