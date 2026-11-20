// The shape R-M04 looks for, shared with R-M03 (a keep leaves its stair alone):
// which cells of a marble structure are rows of a broad flight of steps.

import { above, columnIndex, keyX, keyY, keyZ, neighbor, NO_CELL, opposite, turn, type CellKey, type Dir4 } from '@/core/grid';
import type { ShapePlan, Structure } from '@/resolve/plan';

export interface Step {
  cell: CellKey;
  /** Downhill. */
  dir: Dir4;
}

const memo = new WeakMap<ReadonlyMap<CellKey, unknown>, WeakMap<Structure, Step[]>>();

/**
 * The cells of a marble structure to cut into steps, or [] if it holds no flight of 3+ rows, 2+ wide.
 * Worked out once per structure per resolve: it reads only the structure, the resolved kinds (a new map
 * each resolve) and the terrain, and four role rules and a decoration rule ask.
 */
export function grandSteps(s: Structure, plan: ShapePlan): Step[] {
  let byStructure = memo.get(plan.kinds);
  if (!byStructure) memo.set(plan.kinds, (byStructure = new WeakMap()));
  let steps = byStructure.get(s);
  if (!steps) byStructure.set(s, (steps = findSteps(s, plan)));
  return steps;
}

function findSteps(s: Structure, plan: ShapePlan): Step[] {
  // Top cell per column.
  const top = new Map<number, CellKey>();
  for (const c of s.cells) {
    const col = columnIndex(keyX(c), keyZ(c));
    const t = top.get(col);
    if (t === undefined || keyY(c) > keyY(t)) top.set(col, c);
  }
  const topAt = (cell: CellKey): CellKey | undefined => (cell === NO_CELL ? undefined : top.get(columnIndex(keyX(cell), keyZ(cell))));
  const level = (cell: CellKey | undefined): number => (cell === undefined ? -99 : keyY(cell));
  const ground = (cell: CellKey): number => plan.terrain.height[columnIndex(keyX(cell), keyZ(cell))]!;

  /** A column is a step climbing toward `up` if the column below it is one level lower (or the ground is). */
  const isStep = (c: CellKey, up: Dir4): boolean => {
    if (plan.kinds.has(above(c))) return false;
    const down = neighbor(c, opposite(up));
    if (down === NO_CELL) return false;
    const lower = topAt(down);
    if (lower !== undefined) return level(lower) === keyY(c) - 1 && !plan.kinds.has(above(lower));
    return !plan.kinds.has(down) && ground(down) === keyY(c); // the bottom row: off the ground
  };
  const out: Step[] = [];
  for (const c of top.values()) {
    for (let up = 0 as Dir4; up < 4; up = (up + 1) as Dir4) {
      if (!isStep(c, up)) continue;
      // Rows in this flight: down to the ground and up as far as each row is one higher.
      let rows = 1;
      for (let d = topAt(neighbor(c, opposite(up))); d !== undefined && level(d) === keyY(c) - rows && rows < 40; d = topAt(neighbor(d, opposite(up)))) rows++;
      const upper = topAt(neighbor(c, up));
      let climb = 0;
      for (let u = upper; u !== undefined && level(u) === keyY(c) + climb + 1 && isStep(u, up) && climb < 40; u = topAt(neighbor(u, up))) climb++;
      if (rows + climb < 3) continue;
      // Two or more wide: a neighbour across the flight is the same step.
      const wide = [turn(up, 1), turn(up, 3)].some((side) => {
        const n = topAt(neighbor(c, side));
        return n !== undefined && level(n) === keyY(c) && isStep(n, up);
      });
      if (!wide) continue;
      // It must lead somewhere: a higher step, or a platform at its own top level.
      if (upper === undefined || level(upper) < keyY(c)) continue;
      out.push({ cell: c, dir: opposite(up) });
      break;
    }
  }
  return out.sort((a, b) => a.cell - b.cell);
}

/** How many columns a structure stands on. */
export function columnCount(s: Structure): number {
  return new Set(s.cells.map((c) => columnIndex(keyX(c), keyZ(c)))).size;
}
