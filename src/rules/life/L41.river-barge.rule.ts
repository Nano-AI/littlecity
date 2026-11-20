// L41 · tier 3 · River barge (town-wide; "Boats and ships"). Any dock on a
// river → a flat barge poled along the river, carrying sacks, hay or
// barrels: between two river docks if there are two or more, else between
// the one dock and the river's mouth; it passes under bridges (it lowers its
// short mast).
//
// RIVER WATER is open water at sea level marked as river by generator 2
// (MAT_RIVER), or (a channel the player dug) water at most three columns
// across for a run of six or more: a channel, not a cove. A dock is ON the
// river if river water lies beside it. The barge goes under a bridge only if
// there is room: see lowObstacles.
//
// The harbour system poles the barge to and fro (src/life/ships/barge.ts).

import { columnIndex, DIR4, inColumnBounds, key, keyX, keyY, keyZ, SIZE_X, SIZE_Z } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule } from '@/resolve/engine/api';
import { defineFact, type Facts } from '@/resolve/facts/api';
import { MAT_RIVER } from '@/terrain/terrain2';
import { graphFrom, routeTo, seaField, type Pt } from './ship-routes';

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
 * What a barge sails round: land, anything standing at sea level (a dock, a pier, and an arch: a bridge's
 * opening at sea level is about a quarter of a storey high, and the barge stands half a storey out of the
 * water with its load, its bargeman more), and anything one storey up over the water (a bridge deck: under
 * it there is less than half a storey). Only what is built two storeys or more over the water leaves room
 * to pass under, the mast lowered (barge.ts).
 */
export function lowObstacles(f: Facts): Uint8Array {
  const m = new Uint8Array(SIZE_X * SIZE_Z);
  for (let i = 0; i < m.length; i++) if (f.terrain.height[i]! > 0) m[i] = 1;
  for (const c of f.kinds.keys()) if (keyY(c) <= 1) m[columnIndex(keyX(c), keyZ(c))] = 1;
  return m;
}

/** A channel this narrow or narrower (columns across) is a river, if it runs on at least RIVER_RUN columns. */
export const RIVER_WIDE = 3;
export const RIVER_RUN = 6;

/**
 * Is the water at a column river water? Generator 2 marks it (MAT_RIVER). Otherwise (a channel the player
 * dug) water counts as river where it is narrow, at most RIVER_WIDE columns across, for a run of at least
 * RIVER_RUN columns along it: a channel, not a cove.
 */
export function riverWater(f: Facts, low: Uint8Array): (x: number, z: number) => boolean {
  const wet = (x: number, z: number): boolean => inColumnBounds(x, z) && f.terrain.height[columnIndex(x, z)] === 0;
  /** How wide the water is across (dx, dz) through a column. */
  const across = (x: number, z: number, dx: number, dz: number): number => {
    let n = 1;
    for (let k = 1; wet(x + dx * k, z + dz * k) && n <= RIVER_WIDE; k++) n++;
    for (let k = 1; wet(x - dx * k, z - dz * k) && n <= RIVER_WIDE; k++) n++;
    return n;
  };
  /** How far a narrow channel (narrow across (cx, cz)) runs along (ax, az) through a column. */
  const run = (x: number, z: number, ax: number, az: number, cx: number, cz: number): number => {
    let n = 1;
    for (let k = 1; wet(x + ax * k, z + az * k) && across(x + ax * k, z + az * k, cx, cz) <= RIVER_WIDE && n < RIVER_RUN; k++) n++;
    for (let k = 1; wet(x - ax * k, z - az * k) && across(x - ax * k, z - az * k, cx, cz) <= RIVER_WIDE && n < RIVER_RUN; k++) n++;
    return n;
  };
  return (x, z) => {
    if (!inColumnBounds(x, z) || low[columnIndex(x, z)] !== 0) return false;
    if (f.terrain.material[columnIndex(x, z)] === MAT_RIVER) return true;
    return (across(x, z, 1, 0) <= RIVER_WIDE && run(x, z, 0, 1, 1, 0) >= RIVER_RUN) || (across(x, z, 0, 1) <= RIVER_WIDE && run(x, z, 1, 0, 0, 1) >= RIVER_RUN);
  };
}

/** The barge keeps to the river: the sea, a lake or a cove is no water of its (1 = not its water). */
function riverOnly(low: Uint8Array, river: (x: number, z: number) => boolean): Uint8Array {
  const m = new Uint8Array(low);
  for (let z = 0; z < SIZE_Z; z++) for (let x = 0; x < SIZE_X; x++) if (!river(x, z)) m[columnIndex(x, z)] = 1;
  return m;
}

/** The water the barge works its run in (barge.ts): the river, under nothing too low to pass. */
export function bargeWater(f: Facts): Uint8Array {
  const low = lowObstacles(f);
  return riverOnly(low, riverWater(f, low));
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
  const riverField = seaField(riverOnly(low, river));
  // Two or more: between the first pair (in dock order) joined through the river, not side by side.
  for (let i = 0; i < ends.length; i++) {
    const g = graphFrom(riverField, ends[i]!, BARGE_CLEAR);
    for (let j = i + 1; j < ends.length; j++) {
      if (Math.hypot(ends[j]![0] - ends[i]![0], ends[j]![1] - ends[i]![1]) < 3) continue;
      const route = routeTo(g, ends[i]!, ends[j]!);
      if (route) return run(ends[i]!, ends[j]!, route);
    }
  }
  // Else: between a river dock and the river's mouth (the nearest open water that is not river), the first
  // dock (in dock order) that has a way there; a bridge too low to pass under may stand between.
  for (const a of ends) {
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
    if (mouth < 0) continue;
    // It turns about in the river short of the mouth: the river water it can reach nearest the mouth.
    const gr = graphFrom(riverField, a, BARGE_CLEAR);
    const mx = (mouth % SIZE_X) + 0.5, mz = Math.floor(mouth / SIZE_X) + 0.5;
    let b: Pt | null = null, near = Infinity;
    for (let z = Math.floor(mz) - 3; z <= Math.floor(mz) + 3; z++) {
      for (let x = Math.floor(mx) - 3; x <= Math.floor(mx) + 3; x++) {
        if (!inColumnBounds(x, z) || gr.cost[columnIndex(x, z)]! === Infinity) continue;
        const d = Math.hypot(x + 0.5 - mx, z + 0.5 - mz);
        if (d < near) {
          near = d;
          b = [x + 0.5, z + 0.5];
        }
      }
    }
    if (!b) continue;
    const route = routeTo(gr, a, b);
    const r = route ? run(a, b, route) : null;
    // A dock right at the mouth has no river to work: try the next.
    if (r && r.length >= 4) return r;
  }
  return null;
}

/** The barge's run, once per resolve (L17 keeps its rowboats out of the barge's way). */
export const bargeRun = defineFact<RiverRun | null>('bargeRun', (f) => riverRun(f));

export default defineRule<RiverRun>({
  id: 'L41.river-barge',
  part: 'life',
  tier: 3,
  priority: 590,
  townWide: true,
  about: 'Reads: docks, river water (MAT_RIVER, or a channel), open water. Emits: one ship-call (barge) between two river docks, or between a river dock and the river mouth.',
  find({ facts }) {
    const run = bargeRun(facts);
    return run ? [{ anchor: key(Math.floor(run.a[0]), 0, Math.floor(run.a[1])), key: 'barge', data: run }] : [];
  },
  apply(c, out, ctx) {
    const { a, b } = c.data;
    out.actor({ type: 'ship-call', variant: 'barge', at: null, params: { look: hash(ctx.seed, 'L41', 'look') % 48, x: a[0], z: a[1], x2: b[0], z2: b[1] } });
  },
});
