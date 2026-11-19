// Per-structure information (design section 10, "Per structure"): storeys,
// footprint, bounding box and the structures it touches.

import { above, below, columnIndex, keyX, keyY, keyZ, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { isFloorKind, type StructureKind } from '@/core/kinds';
import type { StructureId } from '../plan';
import { defineFact, type Facts } from './api';
import { contentKeys, regionKey, RegionMemo, registerMemo } from './content-keys.fact';
import { boxOf, DIRS, type Box } from './lib';

export interface Touch {
  id: StructureId;
  kind: StructureKind;
  /** The sides of this structure it touches at the same level (any member cell). */
  sides: readonly Dir4[];
  /** It sits directly on top of one of this structure's cells. */
  above: boolean;
  /** One of this structure's cells sits directly on it. */
  below: boolean;
}

export interface StructureInfo {
  id: StructureId;
  kind: StructureKind;
  cells: readonly CellKey[];
  /** Lowest and highest level of its cells. */
  minY: number;
  maxY: number;
  /** maxY − minY + 1. For a tower, lighthouse, pillar or windmill this is its height. */
  storeys: number;
  /** Distinct columns it occupies. */
  footprint: number;
  /** Columns (columnIndex) occupied on each level, keyed by level. */
  footprintByLevel: ReadonlyMap<number, readonly number[]>;
  /** Columns occupied on its lowest level. */
  groundFootprint: number;
  box: Box;
  /** Block structures sharing a face with it (sides, above, below), by id ascending. */
  touches: readonly Touch[];
}

// An entry reads the structure's own cells and their six neighbours: the
// columns within 1 of it (see content-keys.fact.ts).
const memo = registerMemo(new RegionMemo<StructureInfo>());
const REACH = 1;

/** Every block structure (not floor regions or edge-only runs), by id. */
export const structureInfo = defineFact<ReadonlyMap<StructureId, StructureInfo>>('structureInfo', (f) => {
  const out = new Map<StructureId, StructureInfo>();
  const keys = contentKeys(f);
  const k = regionKey();
  memo.begin();
  for (const s of f.structures.values()) {
    if (!s.cells.length || isFloorKind(s.kind)) continue;
    keys.around(s.cells, REACH, k);
    let info = memo.get(s.id, k);
    if (!info) memo.put(s.id, k, (info = infoOf(f, s.id)));
    out.set(s.id, info);
  }
  return out;
});

function infoOf(f: Facts, id: StructureId): StructureInfo {
  const s = f.structures.get(id)!;
  const byLevel = new Map<number, number[]>();
  const columns = new Set<number>();
  const touches = new Map<StructureId, { sides: Set<Dir4>; above: boolean; below: boolean }>();
  const touch = (n: CellKey): { sides: Set<Dir4>; above: boolean; below: boolean } | null => {
    if (n === NO_CELL) return null;
    const other = f.structureAt.get(n);
    if (other === undefined || other === s.id) return null;
    let t = touches.get(other);
    if (!t) touches.set(other, (t = { sides: new Set(), above: false, below: false }));
    return t;
  };
  for (const c of s.cells) {
    const col = columnIndex(keyX(c), keyZ(c));
    columns.add(col);
    const list = byLevel.get(keyY(c));
    if (list) list.push(col);
    else byLevel.set(keyY(c), [col]);
    for (const d of DIRS) touch(neighbor(c, d))?.sides.add(d);
    const up = touch(above(c));
    if (up) up.above = true;
    const down = touch(below(c));
    if (down) down.below = true;
  }
  const box = boxOf(s.cells);
  return {
    id: s.id,
    kind: s.kind,
    cells: s.cells,
    minY: box.y0,
    maxY: box.y1,
    storeys: box.y1 - box.y0 + 1,
    footprint: columns.size,
    footprintByLevel: byLevel,
    groundFootprint: byLevel.get(box.y0)!.length,
    box,
    touches: [...touches]
      .sort((a, b) => a[0] - b[0])
      .map(([id, t]) => ({ id, kind: f.structures.get(id)!.kind, sides: [...t.sides].sort(), above: t.above, below: t.below })),
  };
}
