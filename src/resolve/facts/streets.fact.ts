// Streets: connected path cells (design section 10, "Regions").

import { E, S, type CellKey, type Dir4 } from '@/core/grid';
import type { StructureId } from '../plan';
import { defineFact, type Facts } from './api';
import { FloorRegionMemo, floorRegions, regionNeighbours, type FloorRegion } from './regions';

export interface StreetSegment {
  /** 'x' runs east–west, 'z' runs north–south. */
  axis: 'x' | 'z';
  /** In order along the axis (west to east, or north to south). */
  cells: readonly CellKey[];
  length: number;
}

export interface Street extends FloorRegion {
  /** Number of path cells. */
  length: number;
  /** Cells with 3 or 4 path neighbours. */
  junctions: readonly CellKey[];
  /** Cells with at most 1 path neighbour (a lone cell is a dead end). */
  deadEnds: readonly CellKey[];
  /** Maximal straight runs of 2+ connected cells along x or z. */
  segments: readonly StreetSegment[];
  /** Path neighbours of each cell, with the side they lie on. */
  links: ReadonlyMap<CellKey, readonly { cell: CellKey; dir: Dir4 }[]>;
}

export interface Streets {
  list: readonly Street[];
  byId: ReadonlyMap<StructureId, Street>;
  /** The street a path cell belongs to. */
  byCell: ReadonlyMap<CellKey, Street>;
  /** Total path cells in town. */
  totalLength: number;
}

// A street reads its own cells and the terrain and floors beside them.
const memo = new FloorRegionMemo<Street>(1);

export const streets = defineFact<Streets>('streets', (f) => {
  const list: Street[] = [];
  const byCell = new Map<CellKey, Street>();
  memo.begin();
  for (const r of floorRegions(f, 'path')) {
    const street = memo.get(f, r, () => streetOf(f, r));
    list.push(street);
    for (const c of r.cells) byCell.set(c, street);
  }
  return { list, byId: new Map(list.map((s) => [s.id, s])), byCell, totalLength: list.reduce((n, s) => n + s.length, 0) };
});

function streetOf(f: Facts, r: FloorRegion): Street {
  const links = new Map<CellKey, { cell: CellKey; dir: Dir4 }[]>();
  for (const c of r.cells) links.set(c, regionNeighbours(f, c));
  const junctions = r.cells.filter((c) => links.get(c)!.length >= 3);
  const deadEnds = r.cells.filter((c) => links.get(c)!.length <= 1);
  const segments: StreetSegment[] = [];
  for (const [dir, axis] of [[E, 'x'], [S, 'z']] as const) {
    const back = dir === E ? 3 : 0;
    for (const c of r.cells) {
      // Start only where the run cannot extend backwards.
      if (links.get(c)!.some((l) => l.dir === back)) continue;
      const run = [c];
      for (let cur = c; ; ) {
        const next = links.get(cur)!.find((l) => l.dir === dir);
        if (!next) break;
        run.push(next.cell);
        cur = next.cell;
      }
      if (run.length >= 2) segments.push({ axis, cells: run, length: run.length });
    }
  }
  return { ...r, length: r.area, junctions, deadEnds, segments, links };
}
