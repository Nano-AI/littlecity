// A worked example of a fact, and a real one: town-wide counts.
// The Logic owner adds the rest of the core facts beside it, one file each:
// cellInfo, facades, roofRegions, streets, plazas, gardens, courtyards,
// alleys, shelteredWater, wildGrass, leftovers, verges, distToWater,
// distToFloor (design section 10, "Facts").

import { keyY } from '@/core/grid';
import type { StructureKind } from '@/core/kinds';
import { defineFact } from './api';

export interface TownFacts {
  /** Number of structures of each kind. */
  structuresByKind: ReadonlyMap<StructureKind, number>;
  /** Number of block cells of each resolved kind. */
  cellsByKind: ReadonlyMap<StructureKind, number>;
  /** Highest level any block occupies, or −1 in an empty town. */
  topLevel: number;
  /** Total blocks placed. */
  blocks: number;
}

export const townFacts = defineFact<TownFacts>('townFacts', (f) => {
  const structuresByKind = new Map<StructureKind, number>();
  const cellsByKind = new Map<StructureKind, number>();
  let topLevel = -1;
  for (const s of f.structures.values()) structuresByKind.set(s.kind, (structuresByKind.get(s.kind) ?? 0) + 1);
  for (const [cell, kind] of f.kinds) {
    cellsByKind.set(kind, (cellsByKind.get(kind) ?? 0) + 1);
    topLevel = Math.max(topLevel, keyY(cell));
  }
  return { structuresByKind, cellsByKind, topLevel, blocks: f.kinds.size };
});
