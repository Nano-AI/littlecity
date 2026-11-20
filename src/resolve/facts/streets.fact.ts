// Streets: connected path cells (design section 10, "Regions").

import { E, keyX, keyZ, N, S, W, type CellKey, type Dir4 } from '@/core/grid';
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
  /**
   * One cell per real junction: a place the street leaves in 3 or more
   * directions that stay apart for at least JUNCTION_REACH cells. A cell in a
   * 2- or 3-wide street has 3 path neighbours but is not a junction; where a
   * wide street meets another, the several cells that qualify are merged into
   * one (the one with the most branches, then the most neighbours, then the
   * lowest key), and no two junctions of a street lie within JUNCTION_REACH
   * steps of each other. Ascending by cell.
   */
  junctions: readonly CellKey[];
  /** For each junction: the distinct directions its branches leave in (ascending). */
  branches: ReadonlyMap<CellKey, readonly Dir4[]>;
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
  const { junctions, branches } = junctionsOf(r.cells, links);
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
  return { ...r, length: r.area, junctions, branches, deadEnds, segments, links };
}

/** How far a branch must run (in steps along the street) to count. Wider than any street. */
export const JUNCTION_REACH = 3;

type Links = ReadonlyMap<CellKey, readonly { cell: CellKey; dir: Dir4 }[]>;

/**
 * The real junctions of a street. For each cell with 3+ path neighbours, walk
 * the street out to JUNCTION_REACH steps and count the separate groups of
 * cells found at that distance (joined only through cells as far or farther):
 * each group is a way out. Across a wide street the far kerb is reached in
 * under JUNCTION_REACH steps, so it is no way out; a short spur to a door is
 * none either.
 */
function junctionsOf(cells: readonly CellKey[], links: Links): { junctions: CellKey[]; branches: Map<CellKey, Dir4[]> } {
  const R = JUNCTION_REACH;
  const has = (a: CellKey, d: number): boolean => links.get(a)!.some((l) => l.dir === d);
  const across = (a: CellKey, b: CellKey, d: Dir4): boolean => {
    const p = (d + 1) % 4, q = (d + 3) % 4;
    return has(a, p) && has(a, q) && has(b, p) && has(b, q);
  };
  const found: { cell: CellKey; dirs: Dir4[]; ways: number; links: number; near: Set<CellKey> }[] = [];
  for (const c of cells) {
    const n = links.get(c)!.length;
    if (n < 3) continue;
    // Distances out to R + 1. A step across a wide street's width (both cells run on along the
    // street both ways) is free: the far kerb is the same place.
    const dist = new Map<CellKey, number>([[c, 0]]);
    const deque: CellKey[] = [c];
    while (deque.length) {
      const a = deque.shift()!;
      const da = dist.get(a)!;
      for (const l of links.get(a)!) {
        const w = across(a, l.cell, l.dir) ? 0 : 1;
        const dl = da + w;
        if (dl > R + 1 || dl >= (dist.get(l.cell) ?? Infinity)) continue;
        dist.set(l.cell, dl);
        if (w === 0) deque.unshift(l.cell);
        else deque.push(l.cell);
      }
    }
    // Group the cells at R and R + 1, joined through each other.
    const group = new Map<CellKey, number>();
    const sums: [number, number][] = [];
    for (const [a, d] of dist) {
      if (d !== R || group.has(a)) continue;
      const g = sums.length;
      const sum: [number, number] = [0, 0];
      sums.push(sum);
      const stack = [a];
      group.set(a, g);
      while (stack.length) {
        const b = stack.pop()!;
        if (dist.get(b) === R) {
          sum[0] += keyX(b) - keyX(c);
          sum[1] += keyZ(b) - keyZ(c);
        }
        for (const l of links.get(b)!) {
          const dl = dist.get(l.cell);
          if (dl === undefined || dl < R || group.has(l.cell)) continue;
          group.set(l.cell, g);
          stack.push(l.cell);
        }
      }
    }
    if (sums.length < 3) continue;
    // A branch leaves from this cell: the street runs straight on that way for two cells at least
    // (a cell beside a spur, or across a wide street from it, is not its junction).
    const straight = (d: Dir4): number => {
      let n = 0;
      for (let cur: CellKey | undefined = c; n < 2; n++) {
        cur = links.get(cur)!.find((l) => l.dir === d)?.cell;
        if (cur === undefined) break;
      }
      return n;
    };
    const dirs = [...new Set(sums.map(([dx, dz]): Dir4 => (Math.abs(dx) >= Math.abs(dz) ? (dx >= 0 ? E : W) : dz >= 0 ? S : N)))]
      .filter((d) => straight(d) >= 2)
      .sort((a, b) => a - b);
    if (dirs.length < 3) continue;
    const near = new Set<CellKey>();
    for (const [a, d] of dist) if (d <= R) near.add(a);
    found.push({ cell: c, dirs, ways: sums.length, links: n, near });
  }
  // Keep the best of each knot of candidates: most ways out, then most neighbours, then lowest key.
  found.sort((a, b) => b.ways - a.ways || b.links - a.links || a.cell - b.cell);
  const kept: typeof found = [];
  for (const j of found) if (!kept.some((k) => k.near.has(j.cell))) kept.push(j);
  kept.sort((a, b) => a.cell - b.cell);
  return { junctions: kept.map((j) => j.cell), branches: new Map(kept.map((j) => [j.cell, j.dirs])) };
}
