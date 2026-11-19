// STUB (Stage 0). Owner: Logic (Stage 1). Final signatures.
//
// The stub island is a flat disc of grass at height 1 with a sand rim. The
// Logic owner replaces generateTerrain with the real generator (design
// section 6: beach, hill, cliff, cove, checked and re-rolled) and
// initialWorld with one that plants the 6–14 starting trees.

import { columnIndex, inColumnBounds, SIZE_X, SIZE_Z } from '@/core/grid';
import { MAT, type Terrain, type World } from '@/core/world';
import { emptyWorld } from '@/world/world';

export type { Terrain, TerrainMaterial } from '@/core/world';
export { MAT } from '@/core/world';

/** The island for a seed. Pure and deterministic. */
export function generateTerrain(seed: number): Terrain {
  const height = new Uint8Array(SIZE_X * SIZE_Z);
  const cx = (SIZE_X - 1) / 2;
  const cz = (SIZE_Z - 1) / 2;
  for (let z = 0; z < SIZE_Z; z++) {
    for (let x = 0; x < SIZE_X; x++) {
      if (Math.hypot(x - cx, z - cz) <= 16.5) height[columnIndex(x, z)] = 1;
    }
  }
  return terrainFromHeights(seed, height);
}

/**
 * A Terrain from a height field, with materials derived: water at height 0,
 * sand on land at height 1 beside water, grass elsewhere. Scenarios with
 * hand-made terrain use this.
 */
export function terrainFromHeights(seed: number, height: Uint8Array): Terrain {
  if (height.length !== SIZE_X * SIZE_Z) throw new Error('terrainFromHeights: height must have 48 × 48 entries');
  const material = new Uint8Array(SIZE_X * SIZE_Z);
  const h = (x: number, z: number): number => (inColumnBounds(x, z) ? height[columnIndex(x, z)]! : 0);
  for (let z = 0; z < SIZE_Z; z++) {
    for (let x = 0; x < SIZE_X; x++) {
      const here = h(x, z);
      let mat: number = MAT.grass;
      if (here === 0) mat = MAT.water;
      else if (here === 1 && (h(x - 1, z) === 0 || h(x + 1, z) === 0 || h(x, z - 1) === 0 || h(x, z + 1) === 0)) mat = MAT.sand;
      material[columnIndex(x, z)] = mat;
    }
  }
  return { seed, height, material };
}

/** The world a new island starts with. */
export function initialWorld(seed: number, _t: Terrain): World {
  return emptyWorld(seed);
}

/** Terrain height of a column; 0 (water) outside the map. */
export function heightAt(t: Terrain, x: number, z: number): number {
  return inColumnBounds(x, z) ? t.height[columnIndex(x, z)]! : 0;
}
