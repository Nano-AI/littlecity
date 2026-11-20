// The way back out of fly mode (design section 7): a path for the eye that
// never passes through anything. Pure.
//
// Straight there if the line is clear. Otherwise up first: the first of a
// list of headings and slopes whose line from the eye to a height over
// everything on the island is clear (the way the eye faces first, then the
// others round it, from a gentle slope to straight up), so in an alley it
// rises along the alley and under an arch it comes out through the opening;
// then across at that height, and down to the end the same way if the end
// is itself down among the houses.
//
// Ported from the walk experiment (swarm/walk, src/walk/glide.ts), where the
// same search brought the camera down to a walker's eyes.

import type { SolidMap } from './solid';

export type Vec3 = readonly [number, number, number];

const DEG = Math.PI / 180;
/** How far clear of anything the eye keeps on the way (world units). */
const CLEARANCE = 0.14;

/** Is the straight line from a to b clear of everything, with a little room round it? `skip` leaves out the first stretch from a. */
export function clearPath(map: SolidMap, a: Vec3, b: Vec3, skip = 0): boolean {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const n = Math.max(2, Math.ceil(len / 0.06));
  const c = CLEARANCE;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (t * len < skip) continue;
    const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t;
    if (map.hidden(x, y, z)) return false;
    if (map.hidden(x + c, y, z) || map.hidden(x - c, y, z) || map.hidden(x, y, z + c) || map.hidden(x, y, z - c) || map.hidden(x, y - c, z) || map.hidden(x, y + c, z)) return false;
  }
  return true;
}

/** The height the eye travels at when it must go over: above everything on the island. */
export function safeHeight(map: SolidMap): number {
  return map.top + 1.4;
}

/**
 * The way up from `at` to the safe height: a list of points after `at` (one, or two when it first
 * comes out level from under something), or null if there is none. `yaw` (degrees, 0 toward −z, 90
 * toward −x) is the heading tried first.
 */
export function wayUp(map: SolidMap, at: Vec3, yaw: number): Vec3[] | null {
  const top = Math.max(safeHeight(map), at[1]);
  const rise = top - at[1];
  if (rise <= 1e-6) return [];
  const headings = [0, 45, -45, 90, -90, 135, -135, 180].map((d) => yaw + d);
  const toward = (from: Vec3, h: number, slope: number): Vec3 => {
    const along = (top - from[1]) / Math.tan(slope * DEG);
    return [from[0] - Math.sin(h * DEG) * along, top, from[2] - Math.cos(h * DEG) * along];
  };
  if (clearPath(map, at, [at[0], top, at[2]], 0.02)) return [[at[0], top, at[2]]];
  for (const h of headings) {
    for (const slope of [70, 55, 42, 30]) {
      const high = toward(at, h, slope);
      if (clearPath(map, at, high, 0.02)) return [high];
    }
  }
  // Under something: out level through the opening first, then up.
  for (const d of [0.65, 0.85, 1.1, 1.6, 2.4, 3.5]) {
    for (const h of headings) {
      const mid: Vec3 = [at[0] - Math.sin(h * DEG) * d, at[1], at[2] - Math.cos(h * DEG) * d];
      if (!clearPath(map, at, mid, 0.02)) continue;
      for (const slope of [85, 70, 55]) {
        const high = toward(mid, h, slope);
        if (clearPath(map, mid, high)) return [mid, high];
      }
    }
  }
  return null;
}

/**
 * The path from `from` to `to` (both included), clear of everything: straight if it can be, else up,
 * across over the town and down. If no clear way is found it goes straight (the eye may be somewhere
 * it should not be already, after the town changed round it).
 */
export function planPath(map: SolidMap, from: Vec3, to: Vec3, fromYaw: number, toYaw: number): Vec3[] {
  if (clearPath(map, from, to, 0.02)) return [from, to];
  const up = wayUp(map, from, fromYaw);
  if (!up) return [from, to];
  const high = up.length > 0 ? up[up.length - 1]! : from;
  if (clearPath(map, high, to)) return [from, ...up, to];
  // The end is down among the houses: the way up from it, backwards.
  const down = wayUp(map, to, toYaw + 180);
  if (!down) return [from, ...up, to];
  const high2 = down.length > 0 ? down[down.length - 1]! : to;
  return [from, ...up, high2, ...down.slice(0, -1).reverse(), to];
}

/** The point at a share t (0 to 1) of the way along a path, by length. */
export function along(path: readonly Vec3[], t: number): Vec3 {
  if (path.length === 1) return path[0]!;
  const lens: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!, b = path[i]!;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    lens.push(l);
    total += l;
  }
  if (total <= 1e-9) return path[path.length - 1]!;
  let d = Math.min(1, Math.max(0, t)) * total;
  for (let i = 0; i < lens.length; i++) {
    const l = lens[i]!;
    if (d <= l || i === lens.length - 1) {
      const a = path[i]!, b = path[i + 1]!;
      const k = l <= 1e-9 ? 1 : Math.min(1, d / l);
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    }
    d -= l;
  }
  return path[path.length - 1]!;
}
