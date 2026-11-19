// Leftovers (catalogue part U): a connected patch of bare grass bounded on
// every side by structures, floors, fences, walls, cliffs or water.

import { DIR4, key, keyX, keyY, keyZ, type CellKey } from '@/core/grid';
import type { StructureId } from '../plan';
import { defineFact } from './api';
import { wildGrass } from './grass.fact';
import { DIRS, edgeBetween, ground } from './lib';

export type LeftoverBound = 'structure' | 'floor' | 'fence' | 'wall' | 'cliff' | 'water';

export interface Leftover {
  /** Bare grass cells (see wildGrass), ascending. Side by side, or one terrain step apart, and not split by an edge piece. */
  cells: readonly CellKey[];
  area: number;
  /** What bounds it. */
  bounds: ReadonlySet<LeftoverBound>;
  /** Street (path) regions and plaza regions it touches. */
  streets: readonly StructureId[];
  plazas: readonly StructureId[];
  /** Block structures it touches. */
  structures: readonly StructureId[];
}

export interface Leftovers {
  list: readonly Leftover[];
  byCell: ReadonlyMap<CellKey, Leftover>;
}

export const leftovers = defineFact<Leftovers>('leftovers', (f) => {
  const grass = wildGrass(f);
  const list: Leftover[] = [];
  const byCell = new Map<CellKey, Leftover>();
  const seen = new Set<CellKey>();
  for (const start of grass.cells) {
    if (seen.has(start)) continue;
    const cells: CellKey[] = [];
    const bounds = new Set<LeftoverBound>();
    const streets = new Set<StructureId>();
    const plazas = new Set<StructureId>();
    const structures = new Set<StructureId>();
    let open = false;
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const c = stack.pop()!;
      cells.push(c);
      const x = keyX(c), y = keyY(c), z = keyZ(c);
      for (const d of DIRS) {
        const nx = x + DIR4[d]![0], nz = z + DIR4[d]![1];
        if (nx < 0 || nx > 47 || nz < 0 || nz > 47) {
          open = true;
          continue;
        }
        const edge = edgeBetween(f, c, d);
        if (edge) {
          bounds.add(edge);
          continue;
        }
        // Something standing at this level beside it.
        const same = key(nx, y, nz);
        const sameKind = f.kinds.get(same);
        if (sameKind !== undefined) {
          bounds.add(sameKind === 'fence' || sameKind === 'wall' ? sameKind : 'structure');
          structures.add(f.structureAt.get(same)!);
          continue;
        }
        const nh = ground(f, nx, nz);
        if (nh === 0) {
          bounds.add('water');
          continue;
        }
        if (Math.abs(nh - y) >= 2) {
          bounds.add('cliff');
          continue;
        }
        const g = key(nx, nh, nz);
        if (grass.has(g)) {
          if (!seen.has(g)) {
            seen.add(g);
            stack.push(g);
          }
          continue;
        }
        const k = f.kinds.get(g);
        if (k !== undefined) {
          bounds.add(k === 'fence' || k === 'wall' ? k : 'structure');
          structures.add(f.structureAt.get(g)!);
          continue;
        }
        const floor = f.world.floors.get(g);
        if (floor) {
          bounds.add('floor');
          if (floor === 'path') streets.add(f.floorAt.get(g)!);
          if (floor === 'plaza') plazas.add(f.floorAt.get(g)!);
          continue;
        }
        open = true; // bare sand or open ground of another kind
      }
    }
    if (open) continue;
    cells.sort((a, b) => a - b);
    const asc = (a: number, b: number): number => a - b;
    const patch: Leftover = {
      cells,
      area: cells.length,
      bounds,
      streets: [...streets].sort(asc),
      plazas: [...plazas].sort(asc),
      structures: [...structures].sort(asc),
    };
    list.push(patch);
    for (const c of cells) byCell.set(c, patch);
  }
  return { list, byCell };
});
