// Shaping the land (design section 6, "Shaping the land"): the island a
// world stands on is the generated island with the player's changed columns
// laid over it (World.terrainEdits, column index → height).
//
// Everything here is pure and derived. The player only ever changes heights;
// materials follow from the heights the way the generators make them, so
// edited ground looks generated:
//
//   water   sea where it joins the open water at the map's edge; a river
//           where a dug column lies in a narrow channel (one to three wide,
//           three or more long, or joined to a river); a pond where it is
//           shut in. Water the generator made keeps its own material unless
//           it is shut in.
//   land    columns whose neighbourhood did not change keep the generator's
//           material exactly. Elsewhere: sand at height 1 beside the sea
//           (and beside a river near its mouth), grass, and rock on
//           cliff rims, gorge walls and high summits (generator 2's rules).
//
// islandOf(world, terrain) is the one way to get the island for a world: it
// accepts the generated island or any island derived from it, and is
// memoised per (base, edits), so callers may pass whichever they hold.

import { columnIndex, inColumnBounds, SIZE_X, SIZE_Z } from '@/core/grid';
import { MAT, type Terrain, type World } from '@/core/world';
import { ISLAND2 } from '@/style/island2';
import { components, D4, distanceFrom, fbm, N } from './noise';
import { MAT_RIVER } from './terrain2';

/** Material of water shut in by land (not joined to the sea): a pond. Not in the frozen MAT table. */
export const MAT_POND = 5;
/** The highest the player may raise the land (design section 6). */
export const LAND_MAX = 10;
/** Columns on every side of the map that always stay sea, so boats can come and go. */
export const LAND_BORDER = 5;

export type TerrainEdits = ReadonlyMap<number, number>;

/** True if the player may reshape this column (it is not in the sea border). */
export function landEditable(x: number, z: number): boolean {
  return x >= LAND_BORDER && z >= LAND_BORDER && x < SIZE_X - LAND_BORDER && z < SIZE_Z - LAND_BORDER;
}

/** Open water that is part of the sea (not a river or a pond): what a lighthouse looks out over. */
export function isSeaWater(t: Terrain, i: number): boolean {
  const m = t.material[i];
  return t.height[i] === 0 && m !== MAT_RIVER && m !== MAT_POND;
}

// ───────────────────────────────────────────────────────── memo ──

/** Derived island → the island it was derived from. */
const bases = new WeakMap<Terrain, Terrain>();
/** Edits map → the island they make on a base (one base per edits map in practice). */
const derived = new WeakMap<TerrainEdits, { base: Terrain; terrain: Terrain }>();

/** The generated (or hand-made) island under a possibly edited one. */
export function baseOf(t: Terrain): Terrain {
  return bases.get(t) ?? t;
}

/**
 * The island this world stands on, given the island it was generated on or
 * any island derived from that one. Never throws on a well-formed world.
 */
export function islandOf(w: Pick<World, 'terrainEdits'>, t: Terrain): Terrain {
  const base = baseOf(t);
  const edits = w.terrainEdits;
  if (!edits || edits.size === 0) return base;
  const hit = derived.get(edits);
  if (hit && hit.base === base) return hit.terrain;
  const terrain = deriveTerrain(base, edits);
  if (terrain !== base) bases.set(terrain, base);
  derived.set(edits, { base, terrain });
  return terrain;
}

// ──────────────────────────────────────────────────────── derive ──

const xOf = (i: number): number => i % SIZE_X;
const zOf = (i: number): number => (i / SIZE_X) | 0;

/** The edited island: base heights with the edits laid over, materials derived (see the file header). */
export function deriveTerrain(base: Terrain, edits: TerrainEdits): Terrain {
  const bh = base.height;
  const h = bh.slice();
  for (const [i, v] of edits) {
    if (Number.isInteger(i) && i >= 0 && i < N) h[i] = Math.max(0, Math.min(LAND_MAX, v | 0));
  }
  const changed = new Uint8Array(N);
  let any = false;
  for (let i = 0; i < N; i++) {
    if (h[i] !== bh[i]) {
      changed[i] = 1;
      any = true;
    }
  }
  if (!any) return base;
  return { seed: base.seed, height: h, material: deriveMaterials(base, h, changed) };
}

function deriveMaterials(base: Terrain, h: Uint8Array, changed: Uint8Array): Uint8Array {
  const bh = base.height;
  const bm = base.material;
  const m = bm.slice();
  const at = (x: number, z: number): number => (inColumnBounds(x, z) ? h[columnIndex(x, z)]! : 0);

  // ── water: sea, river or pond ──
  const water = components((i) => h[i] === 0);
  const seaLabels = new Set<number>();
  for (let x = 0; x < SIZE_X; x++) {
    for (const z of [0, SIZE_Z - 1]) {
      const l = water.label[columnIndex(x, z)]!;
      if (l >= 0) seaLabels.add(l);
    }
  }
  for (let z = 0; z < SIZE_Z; z++) {
    for (const x of [0, SIZE_X - 1]) {
      const l = water.label[columnIndex(x, z)]!;
      if (l >= 0) seaLabels.add(l);
    }
  }
  const dug = (i: number): boolean => h[i] === 0 && bh[i]! > 0;
  // A dug column in a channel: land within reach on both sides along one axis (the channel is 1 to 3 wide).
  const narrow = (i: number): boolean => {
    const x = xOf(i), z = zOf(i);
    for (const [dx, dz] of [[1, 0], [0, 1]] as const) {
      let a = 0, b = 0;
      while (a < 3 && at(x - dx * (a + 1), z - dz * (a + 1)) === 0 && inColumnBounds(x - dx * (a + 1), z - dz * (a + 1))) a++;
      while (b < 3 && at(x + dx * (b + 1), z + dz * (b + 1)) === 0 && inColumnBounds(x + dx * (b + 1), z + dz * (b + 1))) b++;
      const landA = inColumnBounds(x - dx * (a + 1), z - dz * (a + 1)) && at(x - dx * (a + 1), z - dz * (a + 1)) > 0;
      const landB = inColumnBounds(x + dx * (b + 1), z + dz * (b + 1)) && at(x + dx * (b + 1), z + dz * (b + 1)) > 0;
      if (landA && landB && a + b + 1 <= 3) return true;
    }
    return false;
  };
  const baseRiver = (i: number): boolean => h[i] === 0 && bh[i] === 0 && bm[i] === MAT_RIVER;
  const channel = new Uint8Array(N);
  for (let i = 0; i < N; i++) if ((dug(i) && narrow(i)) || baseRiver(i)) channel[i] = 1;
  const runs = components((i) => channel[i] === 1);
  const runRiver = new Uint8Array(runs.sizes.length);
  for (let i = 0; i < N; i++) {
    const l = runs.label[i]!;
    if (l < 0) continue;
    if (baseRiver(i) || runs.sizes[l]! >= 3) runRiver[l] = 1;
  }
  for (let i = 0; i < N; i++) {
    if (h[i] !== 0) continue;
    if (!seaLabels.has(water.label[i]!)) m[i] = MAT_POND;
    else if (bh[i] === 0) m[i] = bm[i] === MAT_POND ? MAT.water : bm[i]!;
    else m[i] = runs.label[i]! >= 0 && runRiver[runs.label[i]!] ? MAT_RIVER : MAT.water;
  }

  // ── which land columns to work out again ──
  const dirty = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const reclassed = h[i] === 0 && m[i] !== bm[i];
    if (!changed[i] && !reclassed) continue;
    const x = xOf(i), z = zOf(i);
    const r = changed[i] ? 1 : 0;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!r && dx !== 0 && dz !== 0) continue;
        if (inColumnBounds(x + dx, z + dz)) dirty[columnIndex(x + dx, z + dz)] = 1;
      }
    }
  }
  const isSea = (i: number): boolean => h[i] === 0 && m[i] !== MAT_RIVER && m[i] !== MAT_POND;
  let toSea: Int32Array | null = null;
  const seaDistance = (i: number): number => (toSea ??= distanceFrom(isSea))[i]!;
  const seed = base.seed;
  const rimDrop = ISLAND2.rockRimDrop;
  for (let i = 0; i < N; i++) {
    if (!dirty[i] || h[i] === 0) continue;
    const x = xOf(i), z = zOf(i);
    const here = h[i]!;
    let bySea = false, byRiver = false, drop = 0, highest = true;
    for (const [dx, dz] of D4) {
      const nx = x + dx, nz = z + dz;
      const v = at(nx, nz);
      drop = Math.max(drop, here - v);
      if (v > here) highest = false;
      if (v !== 0 || !inColumnBounds(nx, nz)) continue;
      const j = columnIndex(nx, nz);
      if (m[j] === MAT_RIVER) byRiver = true;
      else if (m[j] !== MAT_POND) bySea = true;
    }
    const same = here === bh[i];
    if (here === 1) {
      // A pond in the fields has grass banks, as a river inland does; the sea has a beach.
      if (bySea) m[i] = MAT.sand;
      else if (byRiver) m[i] = seaDistance(i) >= 0 && seaDistance(i) <= 3 ? MAT.sand : same && bm[i] === MAT.sand ? MAT.sand : MAT.grass;
      else m[i] = MAT.grass;
      continue;
    }
    if (here < 3) {
      m[i] = MAT.grass;
      continue;
    }
    if (same && bm[i] === MAT.rock) continue;
    const n = fbm(seed, 'rock', x, z, 4);
    let rock = false;
    if (drop >= rimDrop && n > 0.28) rock = true;
    if (byRiver) rock = true;
    if (here >= LAND_MAX - 1 || (here >= 7 && n > 0.3) || (here >= 5 && highest && n > 0.42)) rock = true;
    m[i] = rock ? MAT.rock : same && bm[i] !== MAT.sand ? bm[i]! : MAT.grass;
  }
  // Soften, as the generator does: a lone grass column ringed by rock goes to rock, a lone rock column in grass to grass.
  const next = m.slice();
  for (let i = 0; i < N; i++) {
    if (!dirty[i] || h[i]! < 3) continue;
    const x = xOf(i), z = zOf(i);
    let rocky = 0, sides = 0;
    for (const [dx, dz] of D4) {
      const nx = x + dx, nz = z + dz;
      if (!inColumnBounds(nx, nz) || h[columnIndex(nx, nz)] === 0) continue;
      sides++;
      if (m[columnIndex(nx, nz)] === MAT.rock) rocky++;
    }
    if (m[i] === MAT.grass && sides >= 3 && rocky >= sides) next[i] = MAT.rock;
    else if (m[i] === MAT.rock && rocky === 0 && sides === 4 && !(h[i] === bh[i] && bm[i] === MAT.rock)) next[i] = MAT.grass;
  }
  return next;
}

/** The edits map after columns change height: entries equal to the base are dropped. Null when nothing is left. */
export function editsWith(base: Terrain, edits: TerrainEdits | undefined, heights: ReadonlyMap<number, number>): Map<number, number> | null {
  const out = new Map(edits ?? []);
  for (const [i, v] of heights) {
    if (v === base.height[i]) out.delete(i);
    else out.set(i, v);
  }
  if (out.size === 0) return null;
  // Column order, so equal islands have equal maps (and save the same).
  return new Map([...out].sort((a, b) => a[0] - b[0]));
}
