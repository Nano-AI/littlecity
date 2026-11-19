// R-A02 · Sky bridge. A valid span at level 2 or higher anchored on houses
// at both ends, where both houses rise at least one storey above it: a
// covered timber gallery with a window in each bay, in the colour of the
// house it starts from (tag 'deck:covered', one 'covered-gallery' per cell).
// The doors into both houses are J26's. (Between two roofs it stays a plain
// stone bridge: a gallery there would have no wall to run into.)

import { above, keyY, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import type { ShapePlan } from '@/resolve/plan';
import { AUTO } from '@/style/auto';
import { archRuns, type ArchRun } from '../joinery/J15.arch-runs.fact';

/** The house cell a run is anchored on at each end, if the whole run is one span between two houses. */
function houseEnds(plan: ShapePlan, run: ArchRun): [CellKey, CellKey] | null {
  const n = run.cells.length;
  const st = run.stretches[0];
  if (run.stretches.length !== 1 || !st || st.from !== 0 || st.to !== n - 1 || !st.anchoredLo || !st.anchoredHi || n > AUTO.spanMax) return null;
  if (keyY(run.cells[0]!) < 2) return null;
  const low: Dir4 = run.axis === 'x' ? 3 : 0, high: Dir4 = run.axis === 'x' ? 1 : 2;
  const a = neighbor(run.cells[0]!, low), b = neighbor(run.cells[n - 1]!, high);
  if (a === NO_CELL || b === NO_CELL || plan.kinds.get(a) !== 'house' || plan.kinds.get(b) !== 'house') return null;
  // The gallery stands on the deck, one level up: both houses must have a wall there for it to run into.
  if (plan.kinds.get(above(a)) !== 'house' || plan.kinds.get(above(b)) !== 'house') return null;
  if (run.cells.some((c) => plan.kinds.has(above(c)))) return null;
  return [a, b];
}

export default defineRule({
  id: 'R-A02.sky-bridge',
  part: 'roles',
  tier: 2,
  priority: 6980,
  about:
    'Reads: arch runs that are one valid span at y ≥ 2 between two houses, with nothing on them. Emits: role sky-bridge, tag deck:covered, a covered-gallery per cell (param color = the first house\'s).',
  find({ plan, facts }) {
    const out = [];
    for (const [id, runs] of archRuns(facts).byStructure) {
      if (runs.some((r) => houseEnds(plan, r))) out.push({ anchor: plan.structures.get(id)!.cells[0]!, structure: id });
    }
    return out;
  },
  apply(c, out, { plan, facts }) {
    const id = c.structure!;
    out.role(id, 'sky-bridge');
    out.tag(id, 'deck:covered');
    for (const run of archRuns(facts).byStructure.get(id)!) {
      const ends = houseEnds(plan, run);
      if (!ends) continue;
      const color = plan.world.blocks.get(ends[0])?.color ?? 0;
      for (const cell of run.cells) out.feature({ type: 'covered-gallery', structure: id, cell, params: { color } });
    }
  },
});
