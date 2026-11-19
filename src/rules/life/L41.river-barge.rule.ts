// L41 · tier 3 · River barge (town-wide). A river with a dock on it and
// another dock at least SHIPS.bargeReach (10) cells away by water → a flat
// barge poled along the river between them, carrying sacks, hay or barrels,
// passing under bridges (it lowers its short mast).
//
// Islands have no rivers yet; this rule asks only about WATER, so it works
// whatever makes one: RIVER WATER is open water at sea level (a bridge over
// it is fine) lying in a channel: within RIVER_REACH of a bank, with land on
// both sides no more than about five columns off (across, along or
// diagonally), so a coast or a wide lagoon is not a river. A dock is ON the
// river if river water lies beside it. Two such docks are joined if a barge
// fits all the way between them through river water.
//
// The harbour system poles the barge to and fro (barge.ts).

import { columnIndex, DIR4, inColumnBounds, key, keyX, keyY, keyZ, SIZE_X, SIZE_Z } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule } from '@/resolve/engine/api';
import type { Facts } from '@/resolve/facts/api';
import { SHIPS } from '@/style/ships';
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

/** Land columns, and the columns where something stands at sea level (a dock, a pier): what a barge sails round. */
export function lowObstacles(f: Facts): Uint8Array {
  const m = new Uint8Array(SIZE_X * SIZE_Z);
  for (let i = 0; i < m.length; i++) if (f.terrain.height[i]! > 0) m[i] = 1;
  for (const c of f.kinds.keys()) if (keyY(c) === 0) m[columnIndex(keyX(c), keyZ(c))] = 1;
  return m;
}

/** The barge's run for a town, or null. Pure. */
export function riverRun(f: Facts): RiverRun | null {
  const docks = [...f.structures.values()].filter((s) => s.kind === 'dock').sort((a, b) => a.id - b.id);
  if (docks.length < 2) return null;
  const land = new Uint8Array(SIZE_X * SIZE_Z);
  for (let i = 0; i < land.length; i++) if (f.terrain.height[i]! > 0) land[i] = 1;
  const low = lowObstacles(f);
  // Banks on both sides: land within reach one way and the other, across x, across z, or across a diagonal;
  // and a bank near (within RIVER_REACH) in one of those directions.
  const landAt = (x: number, z: number): boolean => inColumnBounds(x, z) && land[columnIndex(x, z)] === 1;
  const reach = Math.ceil(RIVER_REACH * 2);
  const bank = (x: number, z: number, dx: number, dz: number, n: number): boolean => {
    for (let k = 1; k <= n; k++) if (landAt(x + dx * k, z + dz * k)) return true;
    return false;
  };
  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]] as const;
  const river = (x: number, z: number): boolean =>
    inColumnBounds(x, z) &&
    low[columnIndex(x, z)] === 0 &&
    DIRS.some(([dx, dz]) => bank(x, z, dx, dz, reach) && bank(x, z, -dx, -dz, reach)) &&
    DIRS.some(([dx, dz]) => bank(x, z, dx, dz, Math.floor(RIVER_REACH)) || bank(x, z, -dx, -dz, Math.floor(RIVER_REACH)));
  // Only now, with docks that may be on a river, the distances the barge keeps.
  let near = 0;
  for (const s of docks) {
    if (s.cells.some((c) => keyY(c) === 0 && DIR4.some(([dx, dz]) => river(keyX(c) + dx, keyZ(c) + dz)))) near++;
  }
  if (near < 2) return null;
  const water = seaField(low);
  // Docks on the river: the river column beside each, one per dock structure.
  const ends: Pt[] = [];
  for (const s of docks) {
    let best: Pt | null = null;
    let room = -1;
    // Beside the dock's long side, where the barge lies along it, before off its end.
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
  // The first pair (in dock order) joined through the water far enough apart.
  for (let i = 0; i < ends.length; i++) {
    const g = graphFrom(water, ends[i]!, BARGE_CLEAR);
    for (let j = i + 1; j < ends.length; j++) {
      const route = routeTo(g, ends[i]!, ends[j]!);
      if (!route) continue;
      let length = 0, wet = 0;
      for (let k = 1; k < route.length; k++) {
        const a = route[k - 1]!, b = route[k]!;
        const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
        length += d;
        const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
        if (river(Math.floor(mx), Math.floor(mz))) wet += d;
      }
      // By the river: most of the way is river water, not out round the coast.
      if (length >= SHIPS.bargeReach && wet >= length * 0.7) return { a: ends[i]!, b: ends[j]!, route, length };
    }
  }
  return null;
}

export default defineRule<RiverRun>({
  id: 'L41.river-barge',
  part: 'life',
  tier: 3,
  priority: 590,
  townWide: true,
  about: 'Reads: docks, open water, the banks (water in a channel is a river). Emits: one ship-call (barge) between two docks on a river 10+ cells apart by water.',
  find({ facts }) {
    const run = riverRun(facts);
    return run ? [{ anchor: key(Math.floor(run.a[0]), 0, Math.floor(run.a[1])), key: 'barge', data: run }] : [];
  },
  apply(c, out, ctx) {
    const { a, b } = c.data;
    out.actor({ type: 'ship-call', variant: 'barge', at: null, params: { look: hash(ctx.seed, 'L41', 'look') % 48, x: a[0], z: a[1], x2: b[0], z2: b[1] } });
  },
});
