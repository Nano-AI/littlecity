// Sheltered water: open water with land or dock on two or more sides.

import { columnIndex, DIR4, inColumnBounds, key, SIZE_X, SIZE_Z, type CellKey } from '@/core/grid';
import { defineFact } from './api';
import { openWater } from './lib';

export interface ShelteredWater {
  /** Sea-level cells (y = 0) of open-water columns with land or a dock on 2+ sides. Ascending. */
  cells: readonly CellKey[];
  /** How many of the four sides are land or dock, per sheltered cell. */
  sides: ReadonlyMap<CellKey, number>;
  has(cell: CellKey): boolean;
}

export const shelteredWater = defineFact<ShelteredWater>('shelteredWater', (f) => {
  const sides = new Map<CellKey, number>();
  const firm = (x: number, z: number): boolean =>
    inColumnBounds(x, z) && (f.terrain.height[columnIndex(x, z)]! > 0 || f.kinds.get(key(x, 0, z)) === 'dock');
  for (let z = 0; z < SIZE_Z; z++) {
    for (let x = 0; x < SIZE_X; x++) {
      if (!openWater(f, x, z)) continue;
      let n = 0;
      for (const [dx, dz] of DIR4) if (firm(x + dx!, z + dz!)) n++;
      if (n >= 2) sides.set(key(x, 0, z), n);
    }
  }
  const cells = [...sides.keys()].sort((a, b) => a - b);
  return { cells, sides, has: (c) => sides.has(c) };
});
