// Reading the island before planning (design section 15a): where the water
// is and how far, the hill and its top, flat ground, the coast, coves and
// points. Pure arithmetic over the 48 × 48 height map.

import { columnIndex, inColumnBounds, SIZE_X, SIZE_Z } from '@/core/grid';
import { MAT, type Terrain } from '@/core/world';

const N = SIZE_X * SIZE_Z;
export const D4: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export interface Site {
  terrain: Terrain;
  /** Steps (4-connected) from each column to the nearest water column; 0 on water. */
  waterDist: Int32Array;
  /** Highest terrain level on the island. */
  maxH: number;
  /** The centre of the land (mean of land columns). */
  centre: readonly [number, number];
  /** Water columns within 3 (Chebyshev) of each column: how exposed it is. */
  exposure: Uint8Array;
  /** Land columns. */
  land: number;
  /** Narrow water (a river, a channel between islands): open water with land within 3 on both sides along x or z. */
  river: Uint8Array;
  /** Steps to the nearest narrow-water column (a big number on an island without one). */
  riverDist: Int32Array;
  h(x: number, z: number): number;
  isWater(x: number, z: number): boolean;
  isSand(x: number, z: number): boolean;
  /** Every column of the rectangle is land at the given height. */
  flat(x0: number, z0: number, w: number, d: number, height?: number): number;
}

export function readSite(t: Terrain): Site {
  const h = (x: number, z: number): number => (inColumnBounds(x, z) ? t.height[columnIndex(x, z)]! : 0);
  const waterDist = new Int32Array(N).fill(-1);
  const queue: number[] = [];
  let maxH = 0;
  let sx = 0, sz = 0, land = 0;
  for (let i = 0; i < N; i++) {
    const height = t.height[i]!;
    if (height === 0) {
      waterDist[i] = 0;
      queue.push(i);
    } else {
      land++;
      sx += i % SIZE_X;
      sz += Math.floor(i / SIZE_X);
      maxH = Math.max(maxH, height);
    }
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]!;
    const x = i % SIZE_X, z = Math.floor(i / SIZE_X);
    for (const [dx, dz] of D4) {
      if (!inColumnBounds(x + dx, z + dz)) continue;
      const j = columnIndex(x + dx, z + dz);
      if (waterDist[j] === -1) {
        waterDist[j] = waterDist[i]! + 1;
        queue.push(j);
      }
    }
  }
  const exposure = new Uint8Array(N);
  for (let z = 0; z < SIZE_Z; z++) {
    for (let x = 0; x < SIZE_X; x++) {
      if (h(x, z) === 0) continue;
      let n = 0;
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) if (h(x + dx, z + dz) === 0) n++;
      exposure[columnIndex(x, z)] = n;
    }
  }
  // Narrow water: a water column with land within 3 both ways along x, or both ways along z.
  const river = new Uint8Array(N);
  const landWithin = (x: number, z: number, dx: number, dz: number): boolean => {
    for (let k = 1; k <= 3; k++) if (h(x + dx * k, z + dz * k) > 0) return true;
    return false;
  };
  for (let z = 0; z < SIZE_Z; z++) {
    for (let x = 0; x < SIZE_X; x++) {
      if (h(x, z) !== 0) continue;
      if ((landWithin(x, z, 1, 0) && landWithin(x, z, -1, 0)) || (landWithin(x, z, 0, 1) && landWithin(x, z, 0, -1))) river[columnIndex(x, z)] = 1;
    }
  }
  const riverDist = new Int32Array(N).fill(9999);
  const rq: number[] = [];
  for (let i = 0; i < N; i++) if (river[i]) {
    riverDist[i] = 0;
    rq.push(i);
  }
  for (let q = 0; q < rq.length; q++) {
    const i = rq[q]!;
    const x = i % SIZE_X, z = Math.floor(i / SIZE_X);
    for (const [dx, dz] of D4) {
      if (!inColumnBounds(x + dx, z + dz)) continue;
      const j = columnIndex(x + dx, z + dz);
      if (riverDist[j]! > riverDist[i]! + 1) {
        riverDist[j] = riverDist[i]! + 1;
        rq.push(j);
      }
    }
  }
  return {
    river,
    riverDist,
    terrain: t,
    waterDist,
    maxH,
    centre: land ? [sx / land, sz / land] : [24, 24],
    exposure,
    land,
    h,
    isWater: (x, z) => h(x, z) === 0,
    isSand: (x, z) => inColumnBounds(x, z) && t.material[columnIndex(x, z)] === MAT.sand,
    flat(x0, z0, w, d, height) {
      const want = height ?? h(x0, z0);
      if (want === 0) return -1;
      for (let z = z0; z < z0 + d; z++) for (let x = x0; x < x0 + w; x++) if (h(x, z) !== want) return -1;
      return want;
    },
  };
}
