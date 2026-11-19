// Floor regions as the facts see them (shared by streets, plazas, gardens).
// Not a fact file. A region is one floor structure: its cells are connected
// side by side at one level, or one level apart where both lie on terrain.

import { columnIndex, keyX, keyY, keyZ, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import type { FloorKind } from '@/core/kinds';
import type { StructureId } from '../plan';
import type { Facts } from './api';
import { boxOf, DIRS, edgeCellsOf, largestSquare, type Box } from './lib';

/** The cells of the same floor region next to `cell`, with the side each lies on. */
export function regionNeighbours(f: Facts, cell: CellKey): { cell: CellKey; dir: Dir4 }[] {
  const id = f.floorAt.get(cell);
  if (id === undefined) return [];
  const out: { cell: CellKey; dir: Dir4 }[] = [];
  const onTerrain = (c: CellKey): boolean => keyY(c) === f.terrain.height[columnIndex(keyX(c), keyZ(c))];
  for (const d of DIRS) {
    const n = neighbor(cell, d);
    if (n === NO_CELL) continue;
    if (f.floorAt.get(n) === id) {
      out.push({ cell: n, dir: d });
      continue;
    }
    if (!onTerrain(cell)) continue;
    for (const dy of [1, -1]) {
      const m = n + dy * (1 << 12);
      const y = keyY(n) + dy;
      if (y >= 0 && y < 32 && f.floorAt.get(m) === id && onTerrain(m)) out.push({ cell: m, dir: d });
    }
  }
  return out;
}

export interface FloorRegion {
  /** The floor structure's id. */
  id: StructureId;
  kind: FloorKind;
  cells: readonly CellKey[];
  /** Number of cells. */
  area: number;
  box: Box;
  /** Cells with a side neighbour (same level) outside the region. */
  edgeCells: readonly CellKey[];
  /** The largest k with a full k × k square of the region at one level. */
  largestSquare: number;
}

export function floorRegions(f: Facts, kind: FloorKind): FloorRegion[] {
  const out: FloorRegion[] = [];
  for (const s of f.structures.values()) {
    if (s.kind !== kind) continue;
    out.push({ id: s.id, kind, cells: s.cells, area: s.cells.length, box: boxOf(s.cells), edgeCells: edgeCellsOf(s.cells), largestSquare: largestSquare(s.cells) });
  }
  return out.sort((a, b) => a.id - b.id);
}
