// Plazas: connected plaza cells. A square is a plaza containing a full 3 × 3.

import type { CellKey } from '@/core/grid';
import type { StructureId } from '../plan';
import { defineFact } from './api';
import { floorRegions, type FloorRegion } from './regions';

export interface Plaza extends FloorRegion {
  /** Contains a full 3 × 3 of plaza cells at one level (largestSquare ≥ 3). */
  square: boolean;
}

export interface Plazas {
  list: readonly Plaza[];
  byId: ReadonlyMap<StructureId, Plaza>;
  byCell: ReadonlyMap<CellKey, Plaza>;
}

export const plazas = defineFact<Plazas>('plazas', (f) => {
  const list = floorRegions(f, 'plaza').map((r): Plaza => ({ ...r, square: r.largestSquare >= 3 }));
  const byCell = new Map<CellKey, Plaza>();
  for (const p of list) for (const c of p.cells) byCell.set(c, p);
  return { list, byId: new Map(list.map((p) => [p.id, p])), byCell };
});
