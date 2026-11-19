// R-M04 · Grand steps. Marble forming three or more rows, each one level
// higher than the last and two or more wide, is a broad stair: the top cell
// of each row is cut into steps ('broad-steps', dir = downhill), and people
// may sit on them (a 'seat' socket per cell).
//
// A row is cut only if it leads somewhere: the row above it is a higher
// step, or a platform at the level it climbs to. The top row of a bare
// flight is left as a landing.
//
// The steps are cut whatever the structure's role: a keep or a quay with a
// stair built into it keeps its role (R-M03 leaves a mass that is mostly
// stair to this rule). A structure with no role yet becomes 'grand-steps'.

import { defineRule } from '@/resolve/engine/api';
import type { StructureId } from '@/resolve/plan';
import { grandSteps } from './R-M04.steps';

export default defineRule<{ id: StructureId }>({
  id: 'R-M04.grand-steps',
  part: 'roles',
  tier: 2,
  priority: 5960,
  about:
    'Reads: marble structures whose columns step up one level per row for 3+ rows, 2+ wide. Emits: broad-steps on the top cell of each row that leads on (socket seat); role grand-steps if the structure has none.',
  find({ plan }) {
    const out = [];
    for (const s of plan.structures.values()) {
      if (s.kind === 'marble' && s.cells.length >= 6 && grandSteps(s, plan).length) out.push({ anchor: s.cells[0]!, data: { id: s.id } });
    }
    return out;
  },
  apply(c, out, { plan }) {
    const s = plan.structures.get(c.data.id)!;
    if (!plan.roles.has(s.id)) out.role(s.id, 'grand-steps');
    for (const step of grandSteps(s, plan)) {
      const f = out.feature({ type: 'broad-steps', structure: s.id, cell: step.cell, dir: step.dir });
      out.socket({ type: 'seat', owner: f, cell: step.cell, dir: step.dir, structure: s.id });
    }
  },
});
