// Alleys: 1-wide outdoor corridors at least 2 long with structures on both
// sides (design section 10).

import { E, N, neighbor, NO_CELL, S, W, type CellKey } from '@/core/grid';
import { KINDS } from '@/core/kinds';
import type { StructureId } from '../plan';
import { FACTS } from '@/style/facts';
import { defineFact, type Facts } from './api';
import { standable } from './lib';

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

function wallAt(f: Facts, c: CellKey): StructureId | undefined {
  if (c === NO_CELL) return undefined;
  const k = f.kinds.get(c);
  if (k === undefined || !(KINDS[k].solid || KINDS[k].building)) return undefined;
  return f.structureAt.get(c);
}

export const alleys = defineFact<Alleys>('alleys', (f) => {
  const list: Alley[] = [];
  const byCell = new Map<CellKey, Alley>();
  // A corridor cell along x has blocks N and S but not both E and W (else it is a pocket, not a corridor).
  const along = (c: CellKey, axis: 'x' | 'z'): boolean => {
    if (!standable(f, c)) return false;
    const [a, b, c1, c2] = axis === 'x' ? [N, S, E, W] : [E, W, N, S];
    if (wallAt(f, neighbor(c, a)) === undefined || wallAt(f, neighbor(c, b)) === undefined) return false;
    return wallAt(f, neighbor(c, c1)) === undefined || wallAt(f, neighbor(c, c2)) === undefined;
  };
  const candidates = new Set<CellKey>();
  for (const [c, k] of f.kinds) {
    if (!KINDS[k].solid && !KINDS[k].building) continue;
    for (const d of [N, E, S, W]) {
      const n = neighbor(c, d);
      if (n !== NO_CELL) candidates.add(n);
    }
  }
  const sorted = [...candidates].sort((a, b) => a - b);
  for (const axis of ['x', 'z'] as const) {
    const fwd = axis === 'x' ? E : S;
    const back = axis === 'x' ? W : N;
    for (const c of sorted) {
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
