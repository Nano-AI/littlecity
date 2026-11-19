// What a castle's marble carries, shared by the keep (R-M03) and the
// gatehouse (R-M02): battlements along every exposed edge of a walkable top,
// and openings in the walls.

import { above, columnIndex, keyX, keyY, keyZ, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { KINDS } from '@/core/kinds';
import type { RuleOut } from '@/resolve/engine/api';
import type { ShapePlan, Structure } from '@/resolve/plan';

/** A side of a cell is open wall: nothing of this structure, no ground and no other solid block beside it. */
export function exposedSides(s: Structure, plan: ShapePlan): (cell: CellKey, d: Dir4) => boolean {
  const mine = new Set(s.cells);
  return (cell, d) => {
    const n = neighbor(cell, d);
    if (n === NO_CELL) return true;
    if (mine.has(n)) return false;
    const kind = plan.kinds.get(n);
    if (plan.terrain.height[columnIndex(keyX(n), keyZ(n))]! > keyY(cell)) return false;
    return !(kind !== undefined && KINDS[kind].solid);
  };
}

/** Battlements on every exposed edge of every top that can be walked on (not on `skip`, the rows of a stair). */
export function battlements(s: Structure, plan: ShapePlan, out: RuleOut, skip: ReadonlySet<CellKey> = new Set()): void {
  const exposed = exposedSides(s, plan);
  for (const cell of s.cells) {
    if (skip.has(cell) || plan.kinds.has(above(cell))) continue;
    for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
      if (exposed(cell, d)) out.feature({ type: 'battlement', structure: s.id, cell, dir: d });
    }
  }
}

/**
 * One opening to every two cells of exposed wall on each storey, staggered
 * from storey to storey: a glazed round-headed window on a top storey (light
 * at night), an arrow slit below.
 */
export function wallOpenings(s: Structure, plan: ShapePlan, out: RuleOut, skip: ReadonlySet<CellKey> = new Set()): void {
  const exposed = exposedSides(s, plan);
  const mine = new Set(s.cells);
  for (const cell of s.cells) {
    if (skip.has(cell)) continue;
    for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
      if (!exposed(cell, d)) continue;
      const along = d === 0 || d === 2 ? keyX(cell) : keyZ(cell);
      if ((along + keyY(cell)) % 2 !== 0) continue;
      if (mine.has(above(cell))) out.feature({ type: 'arrow-slit', structure: s.id, cell, dir: d });
      else {
        const w = out.feature({ type: 'window', variant: 'arched', structure: s.id, cell, dir: d });
        out.socket({ type: 'window', owner: w, cell, dir: d, structure: s.id });
      }
    }
  }
}
