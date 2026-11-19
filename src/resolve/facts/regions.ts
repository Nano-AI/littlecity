// Floor regions as the facts see them (shared by streets, plazas, gardens).
// Not a fact file. A region is one floor structure: its cells are connected
// side by side at one level, or one level apart where both lie on terrain.

import { columnIndex, keyX, keyY, keyZ, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import type { FloorKind } from '@/core/kinds';
import type { StructureId } from '../plan';
import type { Facts } from './api';
import { contentKeys, regionKey, RegionMemo, registerMemo, type RegionKey } from './content-keys.fact';
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

// A region's entry depends on its own cells only: the floors (and their
// region ids) in its bounding columns.
const memo = registerMemo(new RegionMemo<FloorRegion>());
let memoFacts: Facts | null = null;

export function floorRegions(f: Facts, kind: FloorKind): FloorRegion[] {
  // One memo generation per resolve, though three facts (streets, plazas, gardens) call this.
  if (memoFacts !== f) {
    memoFacts = f;
    memo.begin();
  }
  const keys = contentKeys(f);
  const k = regionKey();
  const out: FloorRegion[] = [];
  for (const s of f.structures.values()) {
    if (s.kind !== kind) continue;
    keys.around(s.cells, 0, k);
    let r = memo.get(s.id, k);
    if (!r || r.kind !== kind) {
      r = { id: s.id, kind, cells: s.cells, area: s.cells.length, box: boxOf(s.cells), edgeCells: edgeCellsOf(s.cells), largestSquare: largestSquare(s.cells) };
      memo.put(s.id, k, r);
    }
    out.push(r);
  }
  return out.sort((a, b) => a.id - b.id);
}

/** Per-region values kept across resolves by the content around each region (streets, gardens). */
export class FloorRegionMemo<V> {
  private memo = registerMemo(new RegionMemo<V>());
  private k: RegionKey = regionKey();
  constructor(private readonly reach: number) {}
  begin(): void {
    this.memo.begin();
  }
  get(f: Facts, r: FloorRegion, make: () => V): V {
    contentKeys(f).around(r.cells, this.reach, this.k);
    let v = this.memo.get(r.id, this.k);
    if (v === undefined) this.memo.put(r.id, this.k, (v = make()));
    return v;
  }
}
