// Where trade happens (FX-02), for the inn (R-H06), the shop (R-H07) and the
// warehouse (R-H17). Not a rule file: two facts and a helper.
//
// Real towns have a high street, a few inns at the places travellers arrive,
// and streets of plain houses. Two facts give the house role rules that
// sense of place, both read only near the house:
//
//   arrivals    the places an inn belongs: each square (a plaza holding a
//               3 × 3), each end of a bridge over water, each gate (an arch
//               standing on a path between marble, wall or houses); a
//               bridge end or gate within 6 steps of a square is served by
//               the square's inn and is no place of its own. An inn
//               is the best house at one of these, so a town has as many
//               inns as it has such places, not one per street.
//   distToPlaza steps (4-way) from each column to the nearest plaza cell:
//               the shop rule's sense of the town centre.

import { columnIndex, keyX, keyZ, neighbor, NO_CELL, SIZE_X, SIZE_Z, type CellKey, type Dir4 } from '@/core/grid';
import { defineFact } from '@/resolve/facts/api';
import { columnDistance, type ColumnDistance } from '@/resolve/facts/lib';
import { plazas } from '@/resolve/facts/plazas.fact';
import type { StructureId } from '@/resolve/plan';
import { archRuns } from '../joinery/J15.arch-runs.fact';

export interface Arrival {
  /** Stable name of the place: 'sq<plaza id>', 'br<arch id>:<end>', 'gt<arch id>'. */
  key: string;
  kind: 'square' | 'bridge' | 'gate';
  /** For a square: its plaza region. */
  plaza?: StructureId;
  /** For a bridge end or a gate: the column it is at. */
  x?: number;
  z?: number;
}

/** How far (Chebyshev, in columns) a house may stand from a bridge end or a gate to be its inn. */
export const ARRIVAL_REACH = 3;
/** A bridge end or a gate this close (4-way steps) to a square has no inn of its own. */
const SERVED = 6;

export const arrivals = defineFact<readonly Arrival[]>('arrivals', (f) => {
  const out: Arrival[] = [];
  const squareAt = new Set<number>();
  for (const p of plazas(f).list) {
    if (!p.square) continue;
    out.push({ key: `sq${p.id}`, kind: 'square', plaza: p.id });
    for (const c of p.cells) squareAt.add(columnIndex(keyX(c), keyZ(c)));
  }
  // A bridge end or a gate close by a square is served by the square's inn.
  const nearSquare = columnDistance((x, z) => squareAt.has(columnIndex(x, z)));
  const served = (x: number, z: number): boolean => nearSquare.at(x, z) <= SERVED;
  const runs = archRuns(f);
  for (const run of runs.runs) {
    const s = f.structures.get(run.structure)!;
    const over = run.stretches.some((st) => st.overWater && st.anchoredLo && st.anchoredHi);
    if (over) {
      // Each end: the land cell beyond the run's end cell.
      const ends: [CellKey, Dir4][] = run.axis === 'x' ? [[run.cells[0]!, 3], [run.cells[run.cells.length - 1]!, 1]] : [[run.cells[0]!, 0], [run.cells[run.cells.length - 1]!, 2]];
      ends.forEach(([cell, d], i) => {
        const n = neighbor(cell, d);
        if (n === NO_CELL || served(keyX(n), keyZ(n))) return;
        out.push({ key: `br${run.structure}:${i}`, kind: 'bridge', x: keyX(n), z: keyZ(n) });
      });
      continue;
    }
    // A gate: a small arch standing on a path (R-A04's shape) with something solid on both sides of its span.
    if (s.cells.length > 2 || !run.standing.every((v) => v) || !run.cells.some((c) => f.world.floors.get(c) === 'path')) continue;
    const lo = neighbor(run.cells[0]!, run.axis === 'x' ? 3 : 0), hi = neighbor(run.cells[run.cells.length - 1]!, run.axis === 'x' ? 1 : 2);
    const closed = (c: CellKey): boolean => {
      if (c === NO_CELL) return false;
      const k = f.kinds.get(c);
      return k === 'marble' || k === 'wall' || k === 'house' || k === 'tower';
    };
    if (closed(lo) && closed(hi) && !served(keyX(run.cells[0]!), keyZ(run.cells[0]!))) {
      const c = run.cells[0]!;
      out.push({ key: `gt${run.structure}`, kind: 'gate', x: keyX(c), z: keyZ(c) });
    }
  }
  return out;
});

/** Steps from each column to the nearest plaza cell (any level). */
export const distToPlaza = defineFact<ColumnDistance>('distToPlaza', (f) => {
  const has = new Uint8Array(SIZE_X * SIZE_Z);
  for (const p of plazas(f).list) for (const c of p.cells) has[columnIndex(keyX(c), keyZ(c))] = 1;
  return columnDistance((x, z) => has[columnIndex(x, z)] === 1);
});

/** Whether a column of the cells is within `r` (Chebyshev) of (x, z). */
export function within(cells: readonly CellKey[], x: number, z: number, r: number): boolean {
  return cells.some((c) => Math.max(Math.abs(keyX(c) - x), Math.abs(keyZ(c) - z)) <= r);
}
