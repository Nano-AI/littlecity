// Alleys: 1-wide outdoor corridors at least 2 long with structures on both
// sides (design section 10).

import { E, N, neighbor, NO_CELL, S, W, type CellKey } from '@/core/grid';
import type { StructureId } from '../plan';
import { FACTS } from '@/style/facts';
import { defineFact } from './api';
import { BULKY, occupancy, SOLID } from './occupancy.fact';

export interface Alley {
  /** 'x': the corridor runs east–west (structures on its N and S sides); 'z': north–south (E and W). */
  axis: 'x' | 'z';
  /** In order along the axis. */
  cells: readonly CellKey[];
  length: number;
  /** Distinct structures along each side: N or W first, then S or E. */
  sides: readonly [readonly StructureId[], readonly StructureId[]];
}

export interface Alleys {
  list: readonly Alley[];
  byCell: ReadonlyMap<CellKey, Alley>;
}

export const alleys = defineFact<Alleys>('alleys', (f) => {
  const occ = occupancy(f);
  /** The structure of a block (solid, or a windmill) in the cell, else undefined. Terrain is not a structure. */
  const wallAt = (_f: unknown, c: CellKey): StructureId | undefined =>
    c !== NO_CELL && occ.kind[c] && occ.flags[c]! & BULKY ? occ.structure[c]! : undefined;
  /** Standable: on terrain top or a solid block top, and nothing solid in it. */
  const standable = (c: CellKey): boolean => {
    if (c === NO_CELL || occ.flags[c]! & SOLID) return false;
    return c >> 12 > 0 && (occ.flags[c - (1 << 12)]! & SOLID) !== 0;
  };
  const list: Alley[] = [];
  const byCell = new Map<CellKey, Alley>();
  // A corridor cell along x has blocks N and S but not both E and W (else it is a pocket, not a corridor).
  const along = (c: CellKey, axis: 'x' | 'z'): boolean => {
    if (!standable(c)) return false;
    const [a, b, c1, c2] = axis === 'x' ? [N, S, E, W] : [E, W, N, S];
    if (wallAt(f, neighbor(c, a)) === undefined || wallAt(f, neighbor(c, b)) === undefined) return false;
    return wallAt(f, neighbor(c, c1)) === undefined || wallAt(f, neighbor(c, c2)) === undefined;
  };
  // Candidates: a free cell with a block on both sides across the axis (N and S for 'x', W and E for 'z').
  const candidates = { x: [] as CellKey[], z: [] as CellKey[] };
  const bulky = (c: CellKey): boolean => c !== NO_CELL && (occ.flags[c]! & BULKY) !== 0 && occ.kind[c] !== 0;
  for (const c of f.kinds.keys()) {
    if (!bulky(c)) continue;
    const s1 = neighbor(c, S);
    if (s1 !== NO_CELL && !bulky(s1) && bulky(neighbor(s1, S))) candidates.x.push(s1);
    const e1 = neighbor(c, E);
    if (e1 !== NO_CELL && !bulky(e1) && bulky(neighbor(e1, E))) candidates.z.push(e1);
  }
  for (const axis of ['x', 'z'] as const) {
    const fwd = axis === 'x' ? E : S;
    const back = axis === 'x' ? W : N;
    for (const c of candidates[axis].sort((a, b) => a - b)) {
      if (!along(c, axis) || along(neighbor(c, back), axis)) continue;
      const cells = [c];
      for (let n = neighbor(c, fwd); n !== NO_CELL && along(n, axis); n = neighbor(n, fwd)) cells.push(n);
      if (cells.length < FACTS.alleyMin) continue;
      const [a, b] = axis === 'x' ? [N, S] : [W, E];
      const side = (d: 0 | 1 | 2 | 3): StructureId[] => [...new Set(cells.map((x) => wallAt(f, neighbor(x, d))!))].sort((p, q) => p - q);
      const alley: Alley = { axis, cells, length: cells.length, sides: [side(a), side(b)] };
      list.push(alley);
      for (const x of cells) if (!byCell.has(x)) byCell.set(x, alley);
    }
  }
  list.sort((a, b) => a.cells[0]! - b.cells[0]! || (a.axis < b.axis ? -1 : 1));
  return { list, byCell };
});
