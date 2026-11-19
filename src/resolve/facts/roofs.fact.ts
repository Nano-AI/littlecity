// Roof regions (catalogue J01, J04): per structure, the connected patches of
// its top cells at one level. Feature.region is the index into a
// structure's list here.

import { above, keyY, neighbor, NO_CELL, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { KINDS, type StructureKind } from '@/core/kinds';
import type { StructureId } from '../plan';
import { defineFact } from './api';
import { boxOf, DIRS, type Box } from './lib';

/** The kinds that get roof regions: the building kinds. */
export const ROOF_KINDS: ReadonlySet<StructureKind> = new Set(['house', 'tower', 'lighthouse', 'marble', 'windmill']);

export interface RoofRegion {
  structure: StructureId;
  /** Index within the structure's regions: by level, then lowest cell. */
  index: number;
  /** The level of the cells under the roof; the roof sits on their top, at level + 1. */
  level: number;
  /** Top cells, ascending: the cell above is not part of the structure (see `pierced` for those under another structure). */
  cells: readonly CellKey[];
  box: Box;
  /** Extent along x and along z, in cells. */
  width: number;
  depth: number;
  /** The longer axis, or null when square. */
  longAxis: 'x' | 'z' | null;
  /** cells.length === width × depth. */
  rectangular: boolean;
  /** Sides where a taller part of the same structure rises beside the region (for lean-tos). */
  againstTaller: readonly Dir4[];
  /** Cells in the region with another structure's solid block directly above (a tower rising through). */
  pierced: readonly CellKey[];
  /** Floors lying on the roof (cells at level + 1). */
  floors: readonly CellKey[];
  /** Pieces standing on the roof (cells at level + 1 holding a non-solid block). */
  pieces: readonly CellKey[];
  /** Stairs blocks beside the region at its level whose flight climbs onto it. */
  stairsOnto: readonly CellKey[];
}

export interface RoofRegions {
  list: readonly RoofRegion[];
  byStructure: ReadonlyMap<StructureId, readonly RoofRegion[]>;
  /** The region a top cell belongs to. */
  byCell: ReadonlyMap<CellKey, RoofRegion>;
}

export const roofRegions = defineFact<RoofRegions>('roofRegions', (f) => {
  const list: RoofRegion[] = [];
  const byStructure = new Map<StructureId, RoofRegion[]>();
  const byCell = new Map<CellKey, RoofRegion>();
  const ids = [...f.structures.keys()].sort((a, b) => a - b);
  for (const id of ids) {
    const s = f.structures.get(id)!;
    if (!ROOF_KINDS.has(s.kind) || !s.cells.length) continue;
    const members = new Set(s.cells);
    const tops = new Set<CellKey>();
    const pierced = new Set<CellKey>();
    for (const c of s.cells) {
      const up = above(c);
      if (up !== NO_CELL && members.has(up)) continue;
      const k = up === NO_CELL ? undefined : f.kinds.get(up);
      tops.add(c);
      if (k !== undefined && KINDS[k].solid) pierced.add(c);
    }
    const seen = new Set<CellKey>();
    const regions: RoofRegion[] = [];
    for (const start of [...tops].sort((a, b) => a - b)) {
      if (seen.has(start)) continue;
      const cells: CellKey[] = [];
      const stack = [start];
      seen.add(start);
      while (stack.length) {
        const c = stack.pop()!;
        cells.push(c);
        for (const d of DIRS) {
          const n = neighbor(c, d);
          if (n !== NO_CELL && tops.has(n) && !seen.has(n)) {
            seen.add(n);
            stack.push(n);
          }
        }
      }
      cells.sort((a, b) => a - b);
      const box = boxOf(cells);
      const width = box.x1 - box.x0 + 1;
      const depth = box.z1 - box.z0 + 1;
      const level = keyY(start);
      const taller = new Set<Dir4>();
      const stairs = new Set<CellKey>();
      const floors: CellKey[] = [];
      const pieces: CellKey[] = [];
      for (const c of cells) {
        const up = above(c);
        if (up !== NO_CELL) {
          if (f.world.floors.has(up)) floors.push(up);
          const k = f.kinds.get(up);
          if (k !== undefined && !KINDS[k].solid) pieces.push(up);
        }
        for (const d of DIRS) {
          const n = neighbor(c, d);
          if (n === NO_CELL) continue;
          const nu = above(n);
          if (nu !== NO_CELL && members.has(nu)) taller.add(d);
          // A stairs block at this level beside the region, climbing towards it, lands on the roof.
          const b = f.world.blocks.get(n);
          if (b?.kind === 'stairs' && b.rot === opposite(d)) stairs.add(n);
        }
      }
      regions.push({
        structure: id,
        index: 0,
        level,
        cells,
        box,
        width,
        depth,
        longAxis: width > depth ? 'x' : depth > width ? 'z' : null,
        rectangular: cells.length === width * depth,
        againstTaller: [...taller].sort(),
        pierced: cells.filter((c) => pierced.has(c)),
        floors: floors.sort((a, b) => a - b),
        pieces: pieces.sort((a, b) => a - b),
        stairsOnto: [...stairs].sort((a, b) => a - b),
      });
    }
    regions.sort((a, b) => a.level - b.level || a.cells[0]! - b.cells[0]!);
    regions.forEach((r, i) => {
      r.index = i;
      for (const c of r.cells) byCell.set(c, r);
    });
    list.push(...regions);
    byStructure.set(id, regions);
  }
  return { list, byStructure, byCell };
});
