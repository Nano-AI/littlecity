// Wild grass (catalogue part U): bare grass with nothing on it.

import { key, SIZE_X, SIZE_Z, type CellKey } from '@/core/grid';
import { defineFact } from './api';
import { ground, isGrass } from './lib';

export interface WildGrass {
  /**
   * Bare grass: the cell on the terrain top of a grass column (not sand)
   * holding no block and no floor. Ascending.
   */
  cells: readonly CellKey[];
  has(cell: CellKey): boolean;
}

export const wildGrass = defineFact<WildGrass>('wildGrass', (f) => {
  const cells: CellKey[] = [];
  for (let z = 0; z < SIZE_Z; z++) {
    for (let x = 0; x < SIZE_X; x++) {
      if (!isGrass(f, x, z)) continue;
      const c = key(x, ground(f, x, z), z);
      if (!f.kinds.has(c) && !f.world.floors.has(c)) cells.push(c);
    }
  }
  cells.sort((a, b) => a - b);
  const set = new Set(cells);
  return { cells, has: (c) => set.has(c) };
});
