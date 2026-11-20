// Ways across the water (Polish): a boat's route between two points that
// keeps to open water, for the fishing boat's legs between its berth and the
// sea lane (L18) and the rower's crossings between two piers (L20). Not a
// fact file: it reads the terrain and what stands at sea level, nothing else.
//
// HOW. Open water is a column of terrain height 0 with no block at sea level
// (freeWater, as for moorings). A shortest path over those columns, eight
// ways round (a diagonal step only where both columns beside it are water
// too, so it never squeezes between two corners of land), from the column
// of the start to the column of the end. Then the corners are cut: from each
// point the route goes straight to the farthest later point it can see,
// where "see" means a boat of half-width `clear` swept along the straight
// line touches only open water.

import { columnIndex, key, SIZE_X, SIZE_Z } from '@/core/grid';
import type { DockBase } from '../roles/dock-shape';
import { freeWater } from '../roles/dock-shape';

export type Pt = readonly [number, number];

/**
 * Open-water columns, one byte each (1 = water), for a town. Something built one storey up over the water
 * (a bridge deck, the lowest arch of a viaduct) leaves no room for a boat under it: not water. (An arch at
 * sea level is a block at y = 0, so it is not water either: its opening is a hand's breadth high.)
 */
export function waterMask(f: DockBase): Uint8Array {
  const m = new Uint8Array(SIZE_X * SIZE_Z);
  for (let z = 0; z < SIZE_Z; z++) for (let x = 0; x < SIZE_X; x++) if (freeWater(f, x, z) && !f.kinds.has(key(x, 1, z))) m[columnIndex(x, z)] = 1;
  return m;
}

const wet = (m: Uint8Array, x: number, z: number): boolean => x >= 0 && z >= 0 && x < SIZE_X && z < SIZE_Z && m[columnIndex(x, z)] === 1;

/** A straight run from a to b, `clear` either side, crosses open water only. */
export function clearRun(m: Uint8Array, a: Pt, b: Pt, clear = 0.2): boolean {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(len / 0.12));
  const nx = len > 0 ? -dz / len : 0, nz = len > 0 ? dx / len : 0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = a[0] + dx * t, pz = a[1] + dz * t;
    for (const s of [-clear, 0, clear]) {
      if (!wet(m, Math.floor(px + nx * s), Math.floor(pz + nz * s))) return false;
    }
  }
  return true;
}

/**
 * A route from `from` to `to` through open water: the points to steer for,
 * `from` first and `to` last. Null if either end is not on open water or no
 * way joins them.
 */
export function waterRoute(m: Uint8Array, from: Pt, to: Pt, clear = 0.2): Pt[] | null {
  const sx = Math.floor(from[0]), sz = Math.floor(from[1]);
  const tx = Math.floor(to[0]), tz = Math.floor(to[1]);
  if (!wet(m, sx, sz) || !wet(m, tx, tz)) return null;
  if (clearRun(m, from, to, clear)) return [from, to];
  // Dijkstra over columns (steps 1 and √2), ties broken by column index: the same route every time.
  const n = SIZE_X * SIZE_Z;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  const start = columnIndex(sx, sz), goal = columnIndex(tx, tz);
  dist[start] = 0;
  // A small binary heap of [distance, column].
  const heap: [number, number][] = [[0, start]];
  const push = (d: number, i: number): void => {
    heap.push([d, i]);
    for (let k = heap.length - 1; k > 0; ) {
      const p = (k - 1) >> 1;
      if (heap[p]![0] < heap[k]![0] || (heap[p]![0] === heap[k]![0] && heap[p]![1] <= heap[k]![1])) break;
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
        const l = 2 * k + 1, r = l + 1;
        let s = k;
        const less = (a: number, b: number): boolean => heap[a]![0] < heap[b]![0] || (heap[a]![0] === heap[b]![0] && heap[a]![1] < heap[b]![1]);
        if (l < heap.length && less(l, s)) s = l;
        if (r < heap.length && less(r, s)) s = r;
        if (s === k) break;
        [heap[s], heap[k]] = [heap[k]!, heap[s]!];
        k = s;
      }
    }
    return top;
  };
  while (heap.length) {
    const [d, i] = pop();
    if (done[i]) continue;
    done[i] = 1;
    if (i === goal) break;
    const x = i % SIZE_X, z = (i - x) / SIZE_X;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dz === 0) continue;
        const ax = x + dx, az = z + dz;
        if (!wet(m, ax, az)) continue;
        if (dx !== 0 && dz !== 0 && (!wet(m, x + dx, z) || !wet(m, x, z + dz))) continue;
        const j = columnIndex(ax, az);
        const nd = d + (dx !== 0 && dz !== 0 ? Math.SQRT2 : 1);
        if (nd < dist[j]!) {
          dist[j] = nd;
          prev[j] = i;
          push(nd, j);
        }
      }
    }
  }
  if (prev[goal] === -1 && goal !== start) return null;
  const cols: Pt[] = [];
  for (let i = goal; i !== -1; i = prev[i]!) cols.push([(i % SIZE_X) + 0.5, Math.floor(i / SIZE_X) + 0.5]);
  cols.reverse();
  const pts: Pt[] = [from, ...cols.slice(1, -1), to];
  // Cut the corners: steer for the farthest point that can be reached in a straight run.
  const out: Pt[] = [from];
  for (let i = 0; i < pts.length - 1; ) {
    let j = pts.length - 1;
    while (j > i + 1 && !clearRun(m, pts[i]!, pts[j]!, clear)) j--;
    out.push(pts[j]!);
    i = j;
  }
  return out;
}

/** The length of a route. */
export function routeLength(route: readonly Pt[]): number {
  let n = 0;
  for (let i = 1; i < route.length; i++) n += Math.hypot(route[i]![0] - route[i - 1]![0], route[i]![1] - route[i - 1]![1]);
  return n;
}

/** Where a boat is `s` along a route, and which way it heads (unit vector). */
export function alongRoute(route: readonly Pt[], s: number): { x: number; z: number; dx: number; dz: number } {
  let left = Math.max(0, s);
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!, b = route[i]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (left <= len || i === route.length - 1) {
      const t = len > 0 ? Math.min(1, left / len) : 1;
      return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dx: len > 0 ? (b[0] - a[0]) / len : 0, dz: len > 0 ? (b[1] - a[1]) / len : 1 };
    }
    left -= len;
  }
  const p = route[route.length - 1] ?? [0, 0];
  return { x: p[0], z: p[1], dx: 0, dz: 1 };
}
