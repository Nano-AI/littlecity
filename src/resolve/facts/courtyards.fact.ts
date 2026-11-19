// Courtyards: up to 16 connected empty ground cells fully enclosed by blocks,
// walls or cliffs (design section 10).

import { keyX, keyY, keyZ, neighbor, NO_CELL, type CellKey } from '@/core/grid';
import { KINDS } from '@/core/kinds';
import { FACTS } from '@/style/facts';
import { defineFact, type Facts } from './api';
import { DIRS, edgeBetween, ground, groundCell } from './lib';

export interface Courtyard {
  /** Ground cells, ascending. Each lies on the terrain top and holds no solid block, fence or wall. */
  cells: readonly CellKey[];
  area: number;
  /** The terrain level they lie at. */
  level: number;
  /** Cells holding nothing at all (no block, no floor). */
  empty: readonly CellKey[];
}

export interface Courtyards {
  list: readonly Courtyard[];
  byCell: ReadonlyMap<CellKey, Courtyard>;
}

/**
 * A courtyard cell: on the terrain top, no solid block, no fence or wall
 * piece (those are its boundary). Trees, fountains, stalls, stairs and
 * floors may stand in it.
 */
function yardCell(f: Facts, c: CellKey): boolean {
  if (c === NO_CELL || keyY(c) !== ground(f, keyX(c), keyZ(c)) || keyY(c) === 0) return false;
  const k = f.kinds.get(c);
  return k === undefined || (!KINDS[k].solid && k !== 'fence' && k !== 'wall');
}

/** What lies beside a yard cell on one side: 'yard' (same region), 'closed' (block, wall, cliff), or 'open'. */
function side(f: Facts, c: CellKey, d: 0 | 1 | 2 | 3): 'yard' | 'closed' | 'open' {
  if (edgeBetween(f, c, d)) return 'closed';
  const n = neighbor(c, d);
  if (n === NO_CELL) return 'open';
  const k = f.kinds.get(n);
  if (k !== undefined && (KINDS[k].solid || k === 'fence' || k === 'wall')) return 'closed';
  const y = keyY(c);
  const nh = ground(f, keyX(n), keyZ(n));
  if (nh === 0) return 'open'; // water
  if (Math.abs(nh - y) >= 2) return 'closed'; // a cliff up or down
  if (nh !== y) return 'open'; // a walkable step
  return yardCell(f, n) ? 'yard' : 'closed';
}

export const courtyards = defineFact<Courtyards>('courtyards', (f) => {
  const list: Courtyard[] = [];
  const byCell = new Map<CellKey, Courtyard>();
  const seen = new Set<CellKey>();
  const max = FACTS.courtyardMax;
  for (let i = 0; i < 48 * 48; i++) {
    const start = groundCell(f, i % 48, (i / 48) | 0);
    if (start === NO_CELL || seen.has(start) || !yardCell(f, start)) continue;
    // Flood the whole component (so it is visited once), noting whether it leaks.
    const cells: CellKey[] = [];
    let open = false;
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const c = stack.pop()!;
      cells.push(c);
      for (const d of DIRS) {
        const s = side(f, c, d);
        if (s === 'open') open = true;
        else if (s === 'yard') {
          const n = neighbor(c, d);
          if (!seen.has(n)) {
            seen.add(n);
            stack.push(n);
          }
        }
      }
    }
    if (open || cells.length > max) continue;
    cells.sort((a, b) => a - b);
    const yard: Courtyard = {
      cells,
      area: cells.length,
      level: keyY(start),
      empty: cells.filter((c) => !f.kinds.has(c) && !f.world.floors.has(c)),
    };
    list.push(yard);
    for (const c of cells) byCell.set(c, yard);
  }
  list.sort((a, b) => a.cells[0]! - b.cells[0]!);
  return { list, byCell };
});
