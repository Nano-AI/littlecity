// Waterfront: where you can stand beside open water.

import { columnIndex, DIR4, key, keyX, keyZ, SIZE_X, SIZE_Z, type CellKey, type Dir4 } from '@/core/grid';
import { defineFact } from './api';
import { DIRS, openWater, standable } from './lib';

export interface Waterfront {
  /**
   * Cells a person can stand in (standable) on a land column or on a dock
   * deck, with open water in a side-neighbouring column. Ascending.
   */
  cells: readonly CellKey[];
  /** For each waterfront cell, the sides that face open water. */
  sides: ReadonlyMap<CellKey, readonly Dir4[]>;
  has(cell: CellKey): boolean;
}

export const waterfront = defineFact<Waterfront>('waterfront', (f) => {
  const sides = new Map<CellKey, Dir4[]>();
  const consider = (cell: CellKey): void => {
    if (!standable(f, cell)) return;
    const x = keyX(cell), z = keyZ(cell);
    const wet = DIRS.filter((d) => openWater(f, x + DIR4[d]![0], z + DIR4[d]![1]));
    if (wet.length) sides.set(cell, wet);
  };
  for (let z = 0; z < SIZE_Z; z++) {
    for (let x = 0; x < SIZE_X; x++) {
      const h = f.terrain.height[columnIndex(x, z)]!;
      if (h > 0 && h < 32) consider(key(x, h, z));
      else if (h === 0 && f.kinds.get(key(x, 0, z)) === 'dock') consider(key(x, 1, z));
    }
  }
  const cells = [...sides.keys()].sort((a, b) => a - b);
  return { cells, sides, has: (c) => sides.has(c) };
});
