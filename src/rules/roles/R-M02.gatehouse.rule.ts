// R-M02 · Gatehouse. Marble touching one end of a gateway arch (R-A04)
// whose other end also touches marble or a wall: the arch gets a portcullis
// with a lantern either side of it (one 'portcullis' feature on the arch,
// drawn by the arch generator), and the marble takes the role.

import { edgeOf, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import type { ShapePlan, StructureId } from '@/resolve/plan';
import { archRuns, type ArchRun } from '../joinery/J15.arch-runs.fact';

interface Gate {
  marble: StructureId;
  arch: StructureId;
  cells: readonly CellKey[];
}

function closes(plan: ShapePlan, from: CellKey, d: Dir4): 'marble' | 'wall' | null {
  const n = neighbor(from, d);
  const kind = n === NO_CELL ? undefined : plan.kinds.get(n);
  if (kind === 'marble') return 'marble';
  const e = edgeOf(from, d);
  if (kind === 'wall' || (e !== NO_CELL && plan.world.edges.get(e) === 'wall')) return 'wall';
  return null;
}

function gatesOf(plan: ShapePlan, run: ArchRun): Gate[] {
  if (plan.roles.get(run.structure)?.role !== 'gateway') return [];
  const lowDir: Dir4 = run.axis === 'x' ? 3 : 0, highDir: Dir4 = run.axis === 'x' ? 1 : 2;
  const first = run.cells[0]!, last = run.cells[run.cells.length - 1]!;
  const lo = closes(plan, first, lowDir), hi = closes(plan, last, highDir);
  if (!lo || !hi) return [];
  const out: Gate[] = [];
  const add = (cell: CellKey, d: Dir4): void => {
    const id = plan.structureAt.get(neighbor(cell, d));
    if (id !== undefined && !out.some((g) => g.marble === id)) out.push({ marble: id, arch: run.structure, cells: run.cells });
  };
  if (lo === 'marble') add(first, lowDir);
  if (hi === 'marble') add(last, highDir);
  return out;
}

export default defineRule<Gate>({
  id: 'R-M02.gatehouse',
  part: 'roles',
  tier: 2,
  priority: 5980,
  about:
    'Reads: gateway arches (role from R-A04) and what closes each end of their span: marble, wall pieces or wall edges. ' +
    'Emits: role gatehouse on the marble; one portcullis on each cell of the arch.',
  find({ plan, facts }) {
    const out = [];
    for (const run of archRuns(facts).runs) {
      for (const g of gatesOf(plan, run)) out.push({ anchor: plan.structures.get(g.marble)!.cells[0]!, structure: g.marble, key: g.arch, data: g });
    }
    return out;
  },
  apply(c, out, { plan }) {
    out.role(c.data.marble, 'gatehouse');
    for (const cell of c.data.cells) {
      if (plan.features.some((f) => f.type === 'portcullis' && f.cell === cell)) continue;
      out.feature({ type: 'portcullis', structure: c.data.arch, cell });
    }
  },
});
