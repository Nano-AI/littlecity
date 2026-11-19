// R-A01 · Stone bridge. An arch structure with a valid span (anchored at both
// ends, at most `spanMax` long) over water: a slightly humped deck line and
// parapets (tag 'deck:humped', drawn by the generator), and a 'bridge-end'
// at each end of the span for D20's lamps.

import type { Dir4 } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import type { StructureId } from '@/resolve/plan';
import { AUTO } from '@/style/auto';
import { archRuns, type ArchRun } from '../joinery/J15.arch-runs.fact';

/** The runs of a structure that hold a valid span over water. */
function bridgeRuns(runs: readonly ArchRun[]): ArchRun[] {
  return runs.filter((r) => r.stretches.some((st) => st.anchoredLo && st.anchoredHi && st.overWater && st.to - st.from + 1 <= AUTO.spanMax));
}

export default defineRule<{ id: StructureId }>({
  id: 'R-A01.stone-bridge',
  part: 'roles',
  tier: 1,
  priority: 6990,
  about:
    'Reads: arch runs (J15.arch-runs): a stretch anchored at both ends, at most spanMax long, with open water under it. ' +
    'Emits: role stone-bridge, tag deck:humped, a bridge-end (socket bridge-end) at each end of each bridging run.',
  find({ facts, plan }) {
    const out = [];
    for (const [id, runs] of archRuns(facts).byStructure) {
      if (bridgeRuns(runs).length) out.push({ anchor: plan.structures.get(id)!.cells[0]!, structure: id, data: { id } });
    }
    return out;
  },
  apply(c, out, { facts }) {
    const id = c.data.id;
    out.role(id, 'stone-bridge');
    out.tag(id, 'deck:humped');
    for (const run of bridgeRuns(archRuns(facts).byStructure.get(id)!)) {
      const low: Dir4 = run.axis === 'x' ? 3 : 0, high: Dir4 = run.axis === 'x' ? 1 : 2;
      const ends: [number, Dir4][] = [
        [run.cells[0]!, low],
        [run.cells[run.cells.length - 1]!, high],
      ];
      for (const [cell, dir] of ends) {
        const end = out.feature({ type: 'bridge-end', structure: id, cell, dir });
        out.socket({ type: 'bridge-end', owner: end, cell, dir, structure: id });
      }
    }
  },
});
