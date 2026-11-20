// Orchards (discovery round 1, RC-04): trees planted on a grid. Nobody
// plants a wild grove in rows, so trees standing in a lattice of spacing 2
// are an orchard.
//
// Reads only the shape-stage base (kinds, terrain, floors), so a roles rule
// may read it too: R-P01 (tree species) could make every orchard tree a
// fruit tree (see docs/swarm/requests/disc1-fill.md). U18 dresses it.
//
// A lattice tree: a tree block on the ground (its terrain top), on grass or a
// garden (not a plaza, not sand), with another such tree exactly 2 cells away
// along x or z on the same level, and no tree right beside it (1 away along x
// or z). Lattice trees 2 apart along x or z, or diagonally (2, 2), belong to
// one orchard. An orchard has ORCHARD_MIN or more trees and holds at least
// one full 2 × 2 of the lattice (four trees at the corners of a square of
// side 2).
//
// `cells`: the ground cells of the orchard's bounding box (its trees' span),
// for dressing: the grass between the rows.

import { columnIndex, keyX, keyY, keyZ, type CellKey } from '@/core/grid';
import { MAT } from '@/core/world';
import { defineFact } from '@/resolve/facts/api';

/** The fewest lattice trees that make an orchard. */
export const ORCHARD_MIN = 6;

export interface Orchard {
  /** Its trees' cells, ascending. */
  trees: readonly CellKey[];
  /** The ground cells of the box the trees span (trees included), ascending. */
  cells: readonly CellKey[];
}

export interface Orchards {
  list: readonly Orchard[];
  /** The orchard a tree cell belongs to. */
  byTree: ReadonlyMap<CellKey, Orchard>;
}

export const orchards = defineFact<Orchards>('orchards', (f) => {
  const ground = (x: number, z: number): number => (x < 0 || z < 0 || x > 47 || z > 47 ? -1 : f.terrain.height[columnIndex(x, z)]!);
  const grassy = (c: CellKey): boolean => {
    const floor = f.world.floors.get(c);
    if (floor === 'plaza' || floor === 'path') return false;
    return f.terrain.material[columnIndex(keyX(c), keyZ(c))] !== MAT.sand;
  };
  const trees = new Set<CellKey>();
  for (const [c, kind] of f.kinds) if (kind === 'tree' && keyY(c) === ground(keyX(c), keyZ(c)) && grassy(c)) trees.add(c);
  const at = (c: CellKey, dx: number, dz: number): CellKey => c + dx + dz * 64;
  const lattice = new Set<CellKey>();
  for (const t of trees) {
    const beside = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => f.kinds.get(at(t, dx!, dz!)) === 'tree');
    if (beside) continue;
    if ([[2, 0], [-2, 0], [0, 2], [0, -2]].some(([dx, dz]) => trees.has(at(t, dx!, dz!)))) lattice.add(t);
  }
  const list: Orchard[] = [];
  const byTree = new Map<CellKey, Orchard>();
  const seen = new Set<CellKey>();
  for (const start of [...lattice].sort((a, b) => a - b)) {
    if (seen.has(start)) continue;
    const group: CellKey[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const t = stack.pop()!;
      group.push(t);
      for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [2, -2], [-2, 2], [-2, -2]] as const) {
        const n = at(t, dx, dz);
        if (lattice.has(n) && !seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    if (group.length < ORCHARD_MIN) continue;
    const g = new Set(group);
    if (!group.some((t) => g.has(at(t, 2, 0)) && g.has(at(t, 0, 2)) && g.has(at(t, 2, 2)))) continue;
    group.sort((a, b) => a - b);
    const xs = group.map(keyX), zs = group.map(keyZ);
    const cells: CellKey[] = [];
    for (let z = Math.min(...zs); z <= Math.max(...zs); z++) {
      for (let x = Math.min(...xs); x <= Math.max(...xs); x++) {
        const h = ground(x, z);
        if (h > 0) cells.push(x | (z << 6) | (h << 12));
      }
    }
    const orchard: Orchard = { trees: group, cells: cells.sort((a, b) => a - b) };
    list.push(orchard);
    for (const t of group) byTree.set(t, orchard);
  }
  return { list, byTree };
});
