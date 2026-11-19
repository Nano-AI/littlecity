// U06 · tier 2 · Town edge.
//
// Where the town stops, it does not stop dead.
//
//   A street's dead end that faces wild grass frays into a dirt trail for
//   two or three cells, narrowing as it goes, with a signpost at the last
//   paving (the townEdge fact says which ends; D01 keeps its lamp out of the
//   trail's mouth).
//
//   The outward-facing rear wall of a house on the town's edge (a ground
//   storey wall with no door, facing bare grass with no street, plaza or
//   garden in sight and two clear cells of grass beyond it) gets a woodpile
//   against it or a vegetable plot beside it, for DRESSING.edgeYard of such
//   walls.
//
// Stability: a trail depends on its dead end and the three cells ahead; a
// wall's roll is seeded by its own cell and side.
//
// Reads: townEdge, facades, doors, wildGrass, landUse, clearways.
// Claims: the centre slot of each trail cell, the signpost's corner slot,
// the slot of each woodpile and plot.

import { neighbor, NO_CELL, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { facades } from '@/resolve/facts/facades.fact';
import { wildGrass } from '@/resolve/facts/grass.fact';
import { leftovers } from '@/resolve/facts/leftovers.fact';
import { DRESSING } from '@/style/dressing';
import { clearways, cornerPos, edgePos } from '../decoration/clearways.fact';
import { lucky } from '../decoration/lib';
import { landUse } from './land-use.fact';
import { claimsOf, emit, placer, type Placed } from './plots';
import { townEdge } from './town-edge.fact';

const RULE = 'U06.town-edge';

export default defineRule<Placed[]>({
  id: RULE,
  part: 'urban',
  tier: 2,
  priority: 940,
  about: 'Reads: townEdge (dead ends facing wild grass), facades, door features, wildGrass, landUse, clearways. Claims: the centre slot of each trail cell, the signpost’s slot, the slot of each woodpile and plot.',
  find({ facts, seed, plan }) {
    const clear = clearways(facts);
    const out: Candidate<Placed[]>[] = [];
    const free = (c: CellKey, pos: Parameters<typeof clear.free>[1]): boolean => clear.free(c, pos);

    for (const e of townEdge(facts).list) {
      const p = placer(free);
      const look = hash(seed, RULE, 'trail', e.end) % 1000;
      e.cells.forEach((cell, step) => p.put({ type: 'dirt-trail', cell, pos: 'c', face: 2, params: { dir: e.dir, step, steps: e.cells.length, look: look + step } })); // look − step is the same for the whole trail
      // The signpost: on a far corner of the last paved cell, beside the trail's mouth.
      const sides = [((e.dir + 1) % 4) as Dir4, ((e.dir + 3) % 4) as Dir4];
      const first = hash(seed, RULE, 'side', e.end) % 2;
      for (const side of [sides[first]!, sides[1 - first]!]) {
        if (p.put({ type: 'signpost', cell: e.end, pos: cornerPos(e.dir, side), face: opposite(e.dir), params: { arms: 2 + (look % 2), look } })) break;
      }
      if (p.items.length) out.push({ anchor: e.end, key: 'trail', data: p.items });
    }

    // Rear walls on the edge of town.
    const grass = wildGrass(facts);
    const uses = landUse(facts);
    const left = leftovers(facts);
    const doors = new Set<number>();
    for (const f of plan.features) if (f.type === 'door' && f.cell !== undefined && f.dir !== undefined) doors.add(f.cell * 4 + f.dir);
    const wild = (c: CellKey): boolean => c !== NO_CELL && grass.has(c) && !uses.byCell.has(c) && !left.byCell.has(c);
    for (const fc of facades(facts).list) {
      if (fc.kind !== 'house' || fc.storey !== 1 || fc.drop !== 0 || fc.faces !== 'ground') continue;
      if (fc.street !== undefined || fc.plaza !== undefined || fc.garden !== undefined || doors.has(fc.cell * 4 + fc.dir)) continue;
      const c1 = neighbor(fc.cell, fc.dir);
      const c2 = c1 === NO_CELL ? NO_CELL : neighbor(c1, fc.dir);
      const c3 = c2 === NO_CELL ? NO_CELL : neighbor(c2, fc.dir);
      if (!wild(c1) || !wild(c2) || !wild(c3)) continue;
      if (!lucky(seed, RULE, fc.cell, fc.dir, DRESSING.edgeYard)) continue;
      const p = placer(free);
      const look = hash(seed, RULE, 'yard', fc.cell, fc.dir) % 1000;
      const back = opposite(fc.dir);
      if (look % 2 === 0) p.put({ type: 'woodpile', cell: c1, pos: edgePos(back), face: fc.dir, params: { look } });
      else p.put({ type: 'veg-patch', cell: c1, pos: 'c', face: 2, params: { look } });
      if (p.items.length) out.push({ anchor: fc.cell, structure: fc.structure, key: `wall${fc.dir}`, data: p.items });
    }
    return out;
  },
  claims: (c) => claimsOf(c.data),
  apply: (c, out) => emit(out, c.data),
});
