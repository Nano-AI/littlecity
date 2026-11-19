// R-T01 · Steeple. A tower paired with a chapel by R-H01 (which gives the
// tower its role) gets an open belfry with a bell on its top storey; J13 adds
// the spire. If no chapel rule has claimed it, a tower of height ≥ 3 that
// touches a house of 2+ cells (beside it, or standing on it) is taken as a
// steeple here, on the same test R-H01 uses.

import { above, below, neighbor, NO_CELL, type Dir4 } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import type { ShapePlan, Structure, StructureId } from '@/resolve/plan';

function touchesHouse(s: Structure, plan: ShapePlan): boolean {
  const isHouse = (c: number): boolean => {
    if (c === NO_CELL || plan.kinds.get(c) !== 'house') return false;
    const h = plan.structures.get(plan.structureAt.get(c)!);
    return h !== undefined && h.cells.length >= 2;
  };
  if (isHouse(below(s.cells[0]!))) return true;
  for (const cell of s.cells) for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) if (isHouse(neighbor(cell, d))) return true;
  return false;
}

export default defineRule<{ tower: StructureId; paired: boolean }>({
  id: 'R-T01.steeple',
  part: 'roles',
  tier: 1,
  priority: 8990,
  about:
    'Reads: towers with the role steeple (from R-H01), or unclaimed towers of height 3+ touching a house of 2+ cells. ' +
    'Emits: role steeple if not yet set; a belfry on the top cell (socket bell) when nothing stands on it.',
  find({ plan }) {
    const out = [];
    for (const s of plan.structures.values()) {
      if (s.kind !== 'tower') continue;
      const role = plan.roles.get(s.id)?.role;
      if (role === 'steeple') out.push({ anchor: s.cells[0]!, data: { tower: s.id, paired: true } });
      else if (role === undefined && s.cells.length >= 3 && touchesHouse(s, plan)) {
        out.push({ anchor: s.cells[0]!, structure: s.id, data: { tower: s.id, paired: false } });
      }
    }
    return out;
  },
  apply(c, out, { plan }) {
    const s = plan.structures.get(c.data.tower)!;
    if (!c.data.paired) out.role(s.id, 'steeple');
    const top = s.cells[s.cells.length - 1]!;
    if (plan.kinds.has(above(top))) return;
    const belfry = out.feature({ type: 'belfry', structure: s.id, cell: top });
    out.socket({ type: 'bell', owner: belfry, cell: top, structure: s.id });
  },
});
