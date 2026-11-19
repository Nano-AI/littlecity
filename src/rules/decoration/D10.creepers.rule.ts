// D10 · tier 2 · Creepers.
//
// Ivy or a climbing rose up a house wall: on a ground-storey facade that
// looks onto a garden, or onto a courtyard, for DRESSING.creeper of such
// wall bays; and on the ground storey of a cliff house at the same rate. It
// grows from the ground up the corner of the bay, clear of the window, one
// storey high or two where the house has a second storey above that bay.
// Never on the bay with a door.
//
// Stability: each bay rolls for itself, seeded by its own cell and side.
//
// Reads: facades (garden in front, drop), courtyards, door features, roles,
// occupancy. Claims: the wall bay (one creeper to a bay).

import { neighbor, NO_CELL, opposite, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { courtyards } from '@/resolve/facts/courtyards.fact';
import { facades } from '@/resolve/facts/facades.fact';
import { standable } from '@/resolve/facts/lib';
import { DRESSING } from '@/style/dressing';
import { edgePos } from './clearways.fact';
import { lucky } from './lib';

const RULE = 'D10.creepers';

export default defineRule<{ dir: Dir4; storeys: number }>({
  id: RULE,
  part: 'decoration',
  tier: 2,
  priority: 900,
  about: 'Reads: facades (a garden or a courtyard in front), door features, roles, occupancy. Claims: the wall bay it climbs.',
  find({ facts, plan, seed }) {
    const yards = courtyards(facts);
    const doors = new Set<number>();
    for (const f of plan.features) if (f.type === 'door' && f.cell !== undefined && f.dir !== undefined) doors.add(f.cell * 4 + f.dir);
    const out: Candidate<{ dir: Dir4; storeys: number }>[] = [];
    for (const fc of facades(facts).list) {
      if (fc.kind !== 'house' || fc.storey !== 1 || fc.drop !== 0 || doors.has(fc.cell * 4 + fc.dir)) continue;
      const outside = neighbor(fc.cell, fc.dir);
      if (outside === NO_CELL || facts.kinds.has(outside) || !standable(facts, outside)) continue;
      const garden = fc.garden !== undefined && fc.garden <= 2;
      const cliffHouse = plan.roles.get(fc.structure)?.role === 'cliff-house';
      if (!garden && !yards.byCell.has(outside) && !cliffHouse) continue;
      if (!lucky(seed, RULE, fc.cell, fc.dir, DRESSING.creeper)) continue;
      // Two storeys where the same house rises above this bay.
      const up = fc.cell + (1 << 12);
      const storeys = facts.structureAt.get(up) === fc.structure && !facts.kinds.has(outside + (1 << 12)) ? 2 : 1;
      out.push({ anchor: outside, structure: fc.structure, key: fc.dir, data: { dir: fc.dir, storeys } });
    }
    return out;
  },
  claims: (c) => [slot.custom(RULE, c.anchor, c.data.dir)],
  apply(c, out, ctx) {
    const back = opposite(c.data.dir);
    out.prop({ type: 'creeper', at: { cell: c.anchor, pos: edgePos(back), face: c.data.dir }, params: { storeys: c.data.storeys, look: hash(ctx.seed, RULE, c.anchor, c.data.dir) % 1000, face: c.data.dir } });
  },
});
