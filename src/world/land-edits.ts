// Land edits picked by seeded chance, for tests, fuzzing and the benchmark
// (shaping the land). Like src/scenario/edits.ts: only edits canApply
// accepts come back.

import { columnIndex, keyX, keyZ, SIZE_X, SIZE_Z } from '@/core/grid';
import { hash } from '@/core/rand';
import type { Edit, Terrain, World } from '@/core/world';
import { islandOf, LAND_BORDER } from '@/terrain/land';
import { canApply } from './world';

/** The columns of a brush `size` across (1, 2 or 3) at column (x, z); size 2 grows toward (+x, +z). */
export function brushColumns(x: number, z: number, size: number): number[] {
  const out: number[] = [];
  const lo = size === 3 ? -1 : 0;
  const hi = size === 1 ? 0 : 1;
  for (let dz = lo; dz <= hi; dz++) {
    for (let dx = lo; dx <= hi; dx++) {
      const nx = x + dx, nz = z + dz;
      if (nx >= 0 && nz >= 0 && nx < SIZE_X && nz < SIZE_Z) out.push(columnIndex(nx, nz));
    }
  }
  return out;
}

/**
 * The i-th random land edit for a world: raise, dig or level with a brush of
 * 1 to 3, mostly in and around the town, sometimes anywhere. Null if nothing
 * legal turned up.
 */
export function randomLandEdit(w: World, terrain: Terrain, seed: number, i: number): Edit | null {
  const t = islandOf(w, terrain);
  let x0 = SIZE_X, z0 = SIZE_Z, x1 = -1, z1 = -1;
  for (const c of w.blocks.keys()) {
    x0 = Math.min(x0, keyX(c));
    x1 = Math.max(x1, keyX(c));
    z0 = Math.min(z0, keyZ(c));
    z1 = Math.max(z1, keyZ(c));
  }
  const m = LAND_BORDER;
  for (let attempt = 0; attempt < 60; attempt++) {
    const r = (what: string, n: number): number => hash(seed, 'land', what, i, attempt) % n;
    const anywhere = x1 < 0 || r('where', 4) === 0;
    const bx0 = anywhere ? m : Math.max(m, x0 - 2), bx1 = anywhere ? SIZE_X - 1 - m : Math.min(SIZE_X - 1 - m, x1 + 2);
    const bz0 = anywhere ? m : Math.max(m, z0 - 2), bz1 = anywhere ? SIZE_Z - 1 - m : Math.min(SIZE_Z - 1 - m, z1 + 2);
    const x = bx0 + r('x', bx1 - bx0 + 1);
    const z = bz0 + r('z', bz1 - bz0 + 1);
    const cols = brushColumns(x, z, 1 + r('size', 3));
    const what = r('what', 10);
    let e: Edit;
    if (what < 4) e = { type: 'land', up: cols, down: [] };
    else if (what < 8) e = { type: 'land', up: [], down: cols };
    else {
      const to = t.height[columnIndex(x, z)]!;
      e = { type: 'land', up: cols.filter((c) => t.height[c]! < to), down: cols.filter((c) => t.height[c]! > to) };
    }
    if (canApply(w, t, e).ok) return e;
  }
  return null;
}
