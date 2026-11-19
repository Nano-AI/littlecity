// "Is this ground cell in a courtyard?", asked of one cell at a time.
//
// The `courtyards` fact answers it for the whole map (a flood over every
// ground cell, about 0.6 ms on the reference town). The Ground role rules
// only ask about the few cells under a garden or a fountain, and they run in
// the shape stage, which has 8 ms for everything, so they flood out from
// just those cells and stop the moment the yard leaks or grows too big. The
// definition is the fact's, line for line (src/resolve/facts/courtyards.fact.ts):
// connected terrain-top cells with no solid block, fence or wall piece in
// them, closed on every side by solid blocks, fence or wall pieces (cell or
// edge) or a cliff of two levels or more; a step of one, water or the map
// edge leaks; at most FACTS.courtyardMax cells.

import { keyX, keyY, keyZ, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { KINDS } from '@/core/kinds';
import type { Facts } from '@/resolve/facts/api';
import { DIRS, edgeBetween, ground } from '@/resolve/facts/lib';
import { FACTS } from '@/style/facts';

function yardCell(f: Facts, c: CellKey): boolean {
  if (c === NO_CELL || keyY(c) !== ground(f, keyX(c), keyZ(c)) || keyY(c) === 0) return false;
  const k = f.kinds.get(c);
  return k === undefined || (!KINDS[k].solid && k !== 'fence' && k !== 'wall');
}

function side(f: Facts, c: CellKey, d: Dir4): 'yard' | 'closed' | 'open' {
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

/**
 * The cells of the courtyard `start` lies in, or null if it is not in one.
 * `open` collects the cells found NOT to be in a courtyard, so asking about
 * the next cell of the same lawn costs nothing.
 */
export function yardAt(f: Facts, start: CellKey, open?: Set<CellKey>): CellKey[] | null {
  if (open?.has(start) || !yardCell(f, start)) return null;
  const cells = [start];
  const seen = new Set(cells);
  let enclosed = true;
  for (let i = 0; i < cells.length && enclosed; i++) {
    const c = cells[i]!;
    for (const d of DIRS) {
      const s = side(f, c, d);
      if (s === 'open') {
        enclosed = false;
        break;
      }
      if (s !== 'yard') continue;
      const n = neighbor(c, d);
      if (seen.has(n)) continue;
      seen.add(n);
      cells.push(n);
      if (cells.length > FACTS.courtyardMax) {
        enclosed = false;
        break;
      }
    }
  }
  if (enclosed) return cells;
  // Every cell reached belongs to the same leaking (or oversized) piece of ground.
  if (open) for (const c of cells) open.add(c);
  return null;
}
