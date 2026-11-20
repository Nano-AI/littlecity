// L41 · tier 3 · River barge (town-wide; "Boats and ships"). Any dock on a
// river → a flat barge poled along the river, carrying sacks, hay or
// barrels: between two river docks if there are two or more, else between
// the one dock and the river's mouth; it passes under bridges (it lowers its
// short mast).
//
// RIVER WATER is open water at sea level marked as river by generator 2
// (MAT_RIVER), or, on a hand-made island, water lying in a channel: within
// RIVER_REACH of a bank with land on both sides (across x or across z) no
// more than about five columns off, so a coast or a wide lagoon is not a
// river. A bridge's arch
// over the water is no obstacle. A dock is ON the river if river water lies
// beside it.
//
// The harbour system poles the barge to and fro (src/life/ships/barge.ts).

import { columnIndex, DIR4, inColumnBounds, key, keyX, keyY, keyZ, SIZE_X, SIZE_Z } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule } from '@/resolve/engine/api';
import type { Facts } from '@/resolve/facts/api';
import { MAT_RIVER } from '@/terrain/terrain2';
import { graphFrom, routeTo, seaField, type Pt } from './ship-routes';

/** River water lies within this many columns of a bank. */
export const RIVER_REACH = 2.6;
/** A barge's half-beam for keeping off the banks. */
export const BARGE_CLEAR = 0.45;
/** Its drawn half-beam. */
export const BARGE_HALF = 0.53;

export interface RiverRun {
  /** The water column beside each dock (its middle), and the route between them. */
  a: Pt;
  b: Pt;
  route: Pt[];
  length: number;
}

/**
 * Land columns, and the columns where something stands at sea level (a dock, a pier): what a barge sails
 * round. A bridge's arch over the water is not in the way: the barge goes under it (its mast lowered).
 */
export function lowObstacles(f: Facts): Uint8Array {
  const m = new Uint8Array(SIZE_X * SIZE_Z);
  for (let i = 0; i < m.length; i++) if (f.terrain.height[i]! > 0) m[i] = 1;
  for (const [c, k] of f.kinds) if (keyY(c) === 0 && k !== 'arch') m[columnIndex(keyX(c), keyZ(c))] = 1;
  return m;
}

/** Is the water at a column river water? Generator 2 marks it (MAT_RIVER); a hand-dug channel counts by its shape. */
export function riverWater(f: Facts, low: Uint8Array): (x: number, z: number) => boolean {
  const landAt = (x: number, z: number): boolean => inColumnBounds(x, z) && f.terrain.height[columnIndex(x, z)]! > 0;
  const reach = Math.ceil(RIVER_REACH * 2);
  const bank = (x: number, z: number, dx: number, dz: number, n: number): boolean => {
    for (let k = 1; k <= n; k++) if (landAt(x + dx * k, z + dz * k)) return true;
    return false;
  };
  const DIRS = [[1, 0], [0, 1]] as const;
  return (x, z) => {
    if (!inColumnBounds(x, z) || low[columnIndex(x, z)] !== 0) return false;
    if (f.terrain.material[columnIndex(x, z)] === MAT_RIVER) return true;
    // A channel: banks on both sides within reach (across x or across z), one of them near.
    return (
      DIRS.some(([dx, dz]) => bank(x, z, dx, dz, reach) && bank(x, z, -dx, -dz, reach)) &&
      DIRS.some(([dx, dz]) => bank(x, z, dx, dz, Math.floor(RIVER_REACH)) || bank(x, z, -dx, -dz, Math.floor(RIVER_REACH)))
    );
  };
}

/** The barge's run for a town, or null. Pure. */
export function riverRun(f: Facts): RiverRun | null {
  const docks = [...f.structures.values()].filter((s) => s.kind === 'dock').sort((a, b) => a.id - b.id);
  if (!docks.length) return null;
  const low = lowObstacles(f);
  const river = riverWater(f, low);
  // Only docks with river water beside them; then the distances the barge keeps.
  const onRiver = docks.filter((s) => s.cells.some((c) => keyY(c) === 0 && DIR4.some(([dx, dz]) => river(keyX(c) + dx, keyZ(c) + dz))));
  if (!onRiver.length) return null;
  const water = seaField(low);
  // Each river dock: the place beside it the barge lies, along its long side if it has one.
  const ends: Pt[] = [];
  for (const s of onRiver) {
    let best: Pt | null = null;
    let room = -1;
    const alongZ = s.cells.some((c) => keyZ(c) !== keyZ(s.cells[0]!));
    for (const c of [...s.cells].sort((a, b) => a - b)) {
      if (keyY(c) !== 0) continue;
      for (const [dx, dz] of DIR4) {
        const x = keyX(c) + dx, z = keyZ(c) + dz;
        const r = water.at(x + 0.5, z + 0.5) + ((alongZ ? dx : dz) !== 0 ? 0.5 : 0);
        // Lying alongside: its side a hand's breadth off the dock's face.
        const off = 0.5 + 0.08 + BARGE_HALF;
        const bx = keyX(c) + 0.5 + dx * off, bz = keyZ(c) + 0.5 + dz * off;
        if (river(x, z) && water.at(bx, bz) >= BARGE_HALF && r > room + 1e-6) {
          best = [bx, bz];
          room = r;
        }
      }
    }
    if (best) ends.push(best);
  }
  if (!ends.length) return null;
  const run = (a: Pt, b: Pt, route: Pt[]): RiverRun => {
    let length = 0;
    for (let k = 1; k < route.length; k++) length += Math.hypot(route[k]![0] - route[k - 1]![0], route[k]![1] - route[k - 1]![1]);
    return { a, b, route, length };
  };
  // Two or more: between the first pair (in dock order) joined through the water, not side by side.
  for (let i = 0; i < ends.length; i++) {
    const g = graphFrom(water, ends[i]!, BARGE_CLEAR);
    for (let j = i + 1; j < ends.length; j++) {
      if (Math.hypot(ends[j]![0] - ends[i]![0], ends[j]![1] - ends[i]![1]) < 3) continue;
      const route = routeTo(g, ends[i]!, ends[j]!);
      if (route) return run(ends[i]!, ends[j]!, route);
    }
  }
  // One: between the dock and the river's mouth (the nearest open water that is not river).
  const a = ends[0]!;
  const g = graphFrom(water, a, BARGE_CLEAR);
  let mouth = -1, best = Infinity;
  for (let z = 0; z < SIZE_Z; z++) {
    for (let x = 0; x < SIZE_X; x++) {
      const i = columnIndex(x, z);
      if (low[i] || river(x, z) || g.cost[i]! === Infinity || g.cost[i]! >= best) continue;
      if (!DIR4.some(([dx, dz]) => river(x + dx, z + dz))) continue;
      best = g.cost[i]!;
      mouth = i;
    }
  }
  if (mouth < 0) return null;
  const b: Pt = [(mouth % SIZE_X) + 0.5, Math.floor(mouth / SIZE_X) + 0.5];
  const route = routeTo(g, a, b);
  const r = route ? run(a, b, route) : null;
  // A dock right at the mouth has no river to work: no barge.
  return r && r.length >= 4 ? r : null;
}

export default defineRule<RiverRun>({
  id: 'L41.river-barge',
  part: 'life',
  tier: 3,
  priority: 590,
  townWide: true,
  about: 'Reads: docks, river water (MAT_RIVER, or a channel), open water. Emits: one ship-call (barge) between two river docks, or between a river dock and the river mouth.',
  find({ facts }) {
    const run = riverRun(facts);
    return run ? [{ anchor: key(Math.floor(run.a[0]), 0, Math.floor(run.a[1])), key: 'barge', data: run }] : [];
  },
  apply(c, out, ctx) {
    const { a, b } = c.data;
    out.actor({ type: 'ship-call', variant: 'barge', at: null, params: { look: hash(ctx.seed, 'L41', 'look') % 48, x: a[0], z: a[1], x2: b[0], z2: b[1] } });
  },
});
