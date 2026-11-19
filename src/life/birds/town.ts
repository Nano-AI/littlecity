// What a bird needs to know about the town it flies over, read straight
// off the shape plan (pure; worked out when the town changes, never per frame).

import { CELL_H, columnIndex, inColumnBounds, key, keyX, keyY, keyZ, SEA_Y, SIZE_X, SIZE_Z } from '@/core/grid';
import type { Kind } from '@/core/kinds';
import { hash } from '@/core/rand';
import type { ShapePlan } from '@/resolve/plan';

/** The column is open sea: no land and nothing built at sea level. */
export function openWater(shape: ShapePlan, x: number, z: number): boolean {
  return inColumnBounds(x, z) && shape.terrain.height[columnIndex(x, z)] === 0 && !shape.kinds.has(key(x, 0, z));
}

/**
 * The best point to circle over near a home column: the middle of the most open water within
 * `reach` columns, a few columns out from home. Null if there is no water there at all.
 */
export function waterCentre(shape: ShapePlan, hx: number, hz: number, reach: number): { x: number; z: number } | null {
  const r = Math.ceil(reach);
  let best: { x: number; z: number } | null = null;
  let bestScore = 0;
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = hx + dx, z = hz + dz;
      const dist = Math.hypot(dx, dz);
      if (dist > reach || !openWater(shape, x, z)) continue;
      let wet = 0;
      for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (openWater(shape, x + i, z + j)) wet++;
      // Open water all round is best; about three columns from home is nicest. Ties fall to the first met (lowest z, then x).
      const score = wet - Math.abs(dist - 3) * 0.6;
      if (!best || score > bestScore + 1e-9) {
        best = { x: x + 0.5, z: z + 0.5 };
        bestScore = score;
      }
    }
  }
  return best;
}

/** An open-water column close to home to sit on the water at, chosen by seed. Null if there is none within `reach`. */
export function floatSpot(shape: ShapePlan, hx: number, hz: number, reach: number, seed: number): { x: number; z: number } | null {
  const r = Math.ceil(reach);
  let best: { x: number; z: number } | null = null;
  let bestHash = Infinity;
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = hx + dx, z = hz + dz;
      if (Math.hypot(dx, dz) > reach || !openWater(shape, x, z)) continue;
      const h = hash(seed, 'float', x, z);
      if (h < bestHash) {
        bestHash = h;
        best = { x: x + 0.5, z: z + 0.5 };
      }
    }
  }
  return best;
}

/** How far above its top cell a piece of each kind reaches (roofs, caps, crowns), roughly. */
const ABOVE: Partial<Record<Kind, number>> = { house: 0.6, tower: 0.9, lighthouse: 0.9, windmill: 1.0, tree: 0.5, stall: 0.2 };

/**
 * The height (world units) of the tallest thing standing within `radius` columns of (cx, cz): land, sea
 * or building. `except` leaves one structure out (the one a bird is flying round).
 */
export function tallestNear(shape: ShapePlan, cx: number, cz: number, radius: number, except?: number): number {
  let top = SEA_Y;
  const x0 = Math.floor(cx - radius), x1 = Math.floor(cx + radius), z0 = Math.floor(cz - radius), z1 = Math.floor(cz + radius);
  for (let z = z0; z <= z1; z++) {
    for (let x = x0; x <= x1; x++) {
      if (inColumnBounds(x, z)) top = Math.max(top, shape.terrain.height[columnIndex(x, z)]! * CELL_H);
    }
  }
  for (const [cell, kind] of shape.kinds) {
    const x = keyX(cell), z = keyZ(cell);
    if (x < x0 || x > x1 || z < z0 || z > z1) continue;
    if (except !== undefined && shape.structureAt.get(cell) === except) continue;
    top = Math.max(top, (keyY(cell) + 1) * CELL_H + (ABOVE[kind] ?? 0.1));
  }
  return top;
}

const TOPS = new WeakMap<ShapePlan, Float32Array>();
/** The height of the tallest thing in each column (land, sea or building, roofs included), worked out once per town. */
export function columnTops(shape: ShapePlan): Float32Array {
  let tops = TOPS.get(shape);
  if (tops) return tops;
  tops = new Float32Array(SIZE_X * SIZE_Z);
  for (let z = 0; z < SIZE_Z; z++) for (let x = 0; x < SIZE_X; x++) tops[columnIndex(x, z)] = Math.max(SEA_Y, shape.terrain.height[columnIndex(x, z)]! * CELL_H);
  for (const [cell, kind] of shape.kinds) {
    const i = columnIndex(keyX(cell), keyZ(cell));
    tops[i] = Math.max(tops[i]!, (keyY(cell) + 1) * CELL_H + (ABOVE[kind] ?? 0.1));
  }
  TOPS.set(shape, tops);
  return tops;
}

/** The tallest top under a disc of radius `r` round (x, z), from columnTops. */
export function topUnder(tops: Float32Array, x: number, z: number, r: number): number {
  let top = SEA_Y;
  for (let j = Math.floor(z - r); j <= Math.floor(z + r); j++) {
    for (let i = Math.floor(x - r); i <= Math.floor(x + r); i++) if (inColumnBounds(i, j)) top = Math.max(top, tops[columnIndex(i, j)]!);
  }
  return top;
}
