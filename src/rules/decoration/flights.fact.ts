// Flights of grand steps (R-M04 'broad-steps' features), each as its rows:
// for D39 (guardians at the head, lamps at the foot) and U19 (the forecourt
// at the foot). Reads the finished shape plan: dressing-stage rules only.
//
// A flight is the step cells of one structure that share a downhill side and
// touch side by side. Its `bottom` row is the steps whose downhill neighbour
// is not a step of the flight; its `top` row those whose uphill neighbour is
// not. Rows are ordered across the flight (ascending x, or z). `width` is the
// bottom row's length.

import { keyX, keyZ, neighbor, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { defineFact } from '@/resolve/facts/api';
import { featuresOfType } from '@/resolve/facts/plan-index.fact';
import type { StructureId } from '@/resolve/plan';

export interface Flight {
  structure: StructureId;
  /** Downhill. */
  dir: Dir4;
  cells: readonly CellKey[];
  bottom: readonly CellKey[];
  top: readonly CellKey[];
  width: number;
}

export const flights = defineFact<{ list: readonly Flight[] }>('flights', (f) => {
  const steps = new Map<CellKey, { dir: Dir4; structure: StructureId }>();
  for (const ft of featuresOfType(f, 'broad-steps')) if (ft.cell !== undefined && ft.dir !== undefined) steps.set(ft.cell, { dir: ft.dir as Dir4, structure: ft.structure });
  const list: Flight[] = [];
  const seen = new Set<CellKey>();
  const across = (c: CellKey, d: Dir4): number => (d === 0 || d === 2 ? keyX(c) : keyZ(c));
  for (const start of [...steps.keys()].sort((a, b) => a - b)) {
    if (seen.has(start)) continue;
    const { dir, structure } = steps.get(start)!;
    const cells: CellKey[] = [];
    const stack = [start];
    seen.add(start);
    const same = (c: CellKey): boolean => steps.get(c)?.dir === dir && steps.get(c)?.structure === structure;
    while (stack.length) {
      const c = stack.pop()!;
      cells.push(c);
      // Neighbours across the flight (same level), and up and down it (a level apart).
      const cands = [((dir + 1) % 4) as Dir4, ((dir + 3) % 4) as Dir4].map((d) => neighbor(c, d));
      cands.push(neighbor(c, dir) - (1 << 12), neighbor(c, opposite(dir)) + (1 << 12));
      for (const n of cands) {
        if (n < 0 || seen.has(n) || !same(n)) continue;
        seen.add(n);
        stack.push(n);
      }
    }
    const set = new Set(cells);
    const bottom = cells.filter((c) => !set.has(neighbor(c, dir) - (1 << 12))).sort((a, b) => across(a, dir) - across(b, dir));
    const top = cells.filter((c) => !set.has(neighbor(c, opposite(dir)) + (1 << 12))).sort((a, b) => across(a, dir) - across(b, dir));
    list.push({ structure, dir, cells: cells.sort((a, b) => a - b), bottom, top, width: bottom.length });
  }
  return { list };
});
