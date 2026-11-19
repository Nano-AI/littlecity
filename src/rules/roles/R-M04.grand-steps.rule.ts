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

import { above, keyX, keyY, keyZ, neighbor, NO_CELL, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import type { StructureId } from '@/resolve/plan';
import { grandSteps } from './R-M04.steps';

export default defineRule<{ id: StructureId }>({
  id: 'R-M04.grand-steps',
  part: 'roles',
  tier: 2,
  priority: 5960,
  about:
    'Reads: marble structures whose columns step up one level per row for 3+ rows, 2+ wide. Emits: broad-steps on the top cell of each row that leads on (socket seat); a door where the flight runs up to a wall of the mass; role grand-steps if the structure has none.',
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
    const mine = new Set(s.cells);
    const heads: { cell: CellKey; dir: Dir4 }[] = [];
    for (const step of grandSteps(s, plan)) {
      const f = out.feature({ type: 'broad-steps', structure: s.id, cell: step.cell, dir: step.dir });
      out.socket({ type: 'seat', owner: f, cell: step.cell, dir: step.dir, structure: s.id });
      // Where the flight runs up to a wall of the same mass, that wall is where its door goes.
      const up = neighbor(step.cell, opposite(step.dir));
      const wall = up === NO_CELL ? NO_CELL : above(up);
      if (wall !== NO_CELL && mine.has(wall) && mine.has(above(wall)) && !mine.has(above(step.cell))) heads.push({ cell: wall, dir: step.dir }); // a wall two storeys or more above the steps, not the next step up
    }
    // One door per wall the steps arrive at: in the middle of the row.
    const rows = new Map<string, { cell: CellKey; dir: Dir4 }[]>();
    for (const h of heads) {
      const row = `${h.dir}:${keyY(h.cell)}:${h.dir === 0 || h.dir === 2 ? keyZ(h.cell) : keyX(h.cell)}`;
      const list = rows.get(row);
      if (list) list.push(h);
      else rows.set(row, [h]);
    }
    for (const list of rows.values()) {
      const h = list[Math.floor((list.length - 1) / 2)]!;
      const door = out.feature({ type: 'door', variant: 'plain', structure: s.id, cell: h.cell, dir: h.dir });
      out.socket({ type: 'door', owner: door, cell: h.cell, dir: h.dir, structure: s.id });
    }
  },
});
