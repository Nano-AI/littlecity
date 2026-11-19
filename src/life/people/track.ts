// A track: a walk along the graph sampled into a line with arc length, for
// things that follow a route as one body (the garrison's column, L36; the
// rider's horse, L37). Pure.
//
// Built from routes with walk.ts (lane 0: the middle of the way), so it
// curves through turning cells exactly as people do and never leaves a cell
// of the graph; a soldier a hand's breadth to either side of it stays in the
// same cells.

import type { NavGraph } from '@/resolve/plan';
import type { Router, Route } from './route';
import { buildWalk, nodeCentre, pieceAt } from './walk';

export interface Track {
  /** Samples: position and floor height, every STEP or so along the line. */
  x: number[];
  y: number[];
  z: number[];
  /** Arc length at each sample. */
  s: number[];
  length: number;
  /** The last sample is the first (a loop). */
  loop: boolean;
  /** The graph node of each sample's cell. */
  node: number[];
}

const STEP = 0.05;
const scratch = { x: 0, y: 0, z: 0, dx: 0, dz: 0 };

/** True if a route never goes through a building (people may; a column of soldiers or a horse may not). */
export function outdoors(nav: NavGraph, route: Route): boolean {
  return route.links.every((l) => nav.links[l]!.via !== 'interior');
}

/** The track along routes joined end to end (each starting where the last ended). Null if any is missing. */
export function trackOf(nav: NavGraph, routes: readonly (Route | null)[], loop: boolean): Track | null {
  const t: Track = { x: [], y: [], z: [], s: [], length: 0, loop, node: [] };
  for (const route of routes) {
    if (!route || route.nodes.length === 0) return null;
    const pieces = buildWalk(nav, route, { lane: 0, from: nodeCentre(nav, route.nodes[0]!), to: nodeCentre(nav, route.nodes[route.nodes.length - 1]!) });
    for (const p of pieces) {
      const n = Math.max(1, Math.ceil(p.length / STEP));
      for (let i = t.x.length === 0 ? 0 : 1; i <= n; i++) {
        pieceAt(p, i / n, scratch);
        const k = t.x.length;
        if (k > 0) {
          const d = Math.hypot(scratch.x - t.x[k - 1]!, scratch.z - t.z[k - 1]!);
          if (d < 1e-6) continue;
          t.length += d;
        }
        t.x.push(scratch.x);
        t.y.push(scratch.y);
        t.z.push(scratch.z);
        t.s.push(t.length);
        t.node.push(p.node);
      }
    }
  }
  return t.x.length >= 2 ? t : null;
}

export interface TrackPoint {
  x: number;
  y: number;
  z: number;
  /** Unit direction of travel (increasing s). */
  dx: number;
  dz: number;
  node: number;
}

/** Where the track is at arc length s (wrapped on a loop, clamped otherwise). */
export function trackAt(t: Track, s: number, out: TrackPoint): TrackPoint {
  if (t.loop) s = ((s % t.length) + t.length) % t.length;
  else s = Math.max(0, Math.min(t.length, s));
  // Binary search for the segment.
  let lo = 0, hi = t.s.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t.s[mid]! <= s) lo = mid;
    else hi = mid;
  }
  const seg = t.s[hi]! - t.s[lo]! || 1;
  const k = Math.max(0, Math.min(1, (s - t.s[lo]!) / seg));
  out.x = t.x[lo]! + (t.x[hi]! - t.x[lo]!) * k;
  out.y = t.y[lo]! + (t.y[hi]! - t.y[lo]!) * k;
  out.z = t.z[lo]! + (t.z[hi]! - t.z[lo]!) * k;
  // The direction from a little behind to a little ahead: smooth through the samples' corners.
  const a = sample(t, s - 0.08), b = sample(t, s + 0.08);
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len = Math.hypot(dx, dz) || 1;
  out.dx = dx / len;
  out.dz = dz / len;
  out.node = k < 0.5 ? t.node[lo]! : t.node[hi]!;
  return out;
}

function sample(t: Track, s: number): [number, number] {
  if (t.loop) s = ((s % t.length) + t.length) % t.length;
  else s = Math.max(0, Math.min(t.length, s));
  let lo = 0, hi = t.s.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t.s[mid]! <= s) lo = mid;
    else hi = mid;
  }
  const k = Math.max(0, Math.min(1, (s - t.s[lo]!) / (t.s[hi]! - t.s[lo]! || 1)));
  return [t.x[lo]! + (t.x[hi]! - t.x[lo]!) * k, t.z[lo]! + (t.z[hi]! - t.z[lo]!) * k];
}

/** The arc length of the sample nearest a point. */
export function nearestOnTrack(t: Track, x: number, z: number): number {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < t.x.length; i++) {
    const d = (t.x[i]! - x) ** 2 + (t.z[i]! - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = t.s[i]!;
    }
  }
  return best;
}

/** A route that stays out of doors, or null. */
export function outdoorRoute(nav: NavGraph, router: Router, from: number, to: number): Route | null {
  const r = router.find(from, to);
  return r && outdoors(nav, r) ? r : null;
}
