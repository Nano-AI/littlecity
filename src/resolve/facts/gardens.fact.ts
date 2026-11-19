// Gardens: connected garden cells.

import type { CellKey } from '@/core/grid';
import type { StructureId } from '../plan';
import { defineFact } from './api';
import { openWater } from './lib';
import { floorRegions, type FloorRegion } from './regions';
import { DIR4, keyX, keyZ } from '@/core/grid';

export interface Garden extends FloorRegion {
  /** Some garden cell has open water in a side-neighbouring column. */
  byWater: boolean;
}

export interface Gardens {
  list: readonly Garden[];
  byId: ReadonlyMap<StructureId, Garden>;
  byCell: ReadonlyMap<CellKey, Garden>;
}

export const gardens = defineFact<Gardens>('gardens', (f) => {
  const list = floorRegions(f, 'garden').map(
    (r): Garden => ({
      ...r,
      byWater: r.cells.some((c) => DIR4.some(([dx, dz]) => openWater(f, keyX(c) + dx, keyZ(c) + dz))),
    }),
  );
  const byCell = new Map<CellKey, Garden>();
  for (const g of list) for (const c of g.cells) byCell.set(c, g);
  return { list, byId: new Map(list.map((g) => [g.id, g])), byCell };
});
