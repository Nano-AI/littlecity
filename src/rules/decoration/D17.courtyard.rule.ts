// D17 · tier 2 · Courtyard. A courtyard (landUse: 4 to 16 cells of bare
// ground, two or more across both ways, shut in by buildings alone) is
// cobbled from wall to wall, and its middle holds one thing: a well, or a
// small tree in a square of earth, by seed.
//
// The cobbles lie flat and stand on no slot (they share one ink id, so the
// court is one surface with a kerb only where it meets something else). The
// well or tree takes the centre slot of the cell nearest the court's middle
// that is clear (not in front of a door, not on a stair's foot).
//
// Stability: depends on the courtyard's own cells (the patch is decided by
// the leftover it is, which its walls enclose).
//
// Reads: landUse (courtyards), clearways. Claims: the centre slot of the
// middle cell.

import { keyX, keyZ, neighbor } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { DIRS } from '@/resolve/facts/lib';
import { landUse } from '../urban/land-use.fact';
import { emit, type Placed } from '../urban/plots';
import { clearways } from './clearways.fact';

const RULE = 'D17.courtyard';

export default defineRule<{ items: Placed[]; centre: number | null }>({
  id: RULE,
  part: 'decoration',
  tier: 2,
  priority: 830,
  about: 'Reads: landUse (courtyards), clearways. Claims: the centre slot of the cell nearest the middle (a well or a tree); the cobbles lie flat and claim nothing.',
  find({ facts, seed }) {
    const clear = clearways(facts);
    const out: Candidate<{ items: Placed[]; centre: number | null }>[] = [];
    for (const court of landUse(facts).courtyards) {
      const inside = new Set(court.cells);
      const items: Placed[] = [];
      for (const c of court.cells) {
        let mask = 0;
        for (const d of DIRS) if (inside.has(neighbor(c, d))) mask |= 1 << d;
        items.push({ type: 'cobbles', cell: c, pos: 'c', face: 2, params: { mask }, claim: false });
      }
      const mx = court.cells.reduce((a, c) => a + keyX(c), 0) / court.cells.length;
      const mz = court.cells.reduce((a, c) => a + keyZ(c), 0) / court.cells.length;
      const order = [...court.cells].sort((a, b) => Math.hypot(keyX(a) - mx, keyZ(a) - mz) - Math.hypot(keyX(b) - mx, keyZ(b) - mz) || a - b);
      const first = court.cells[0]!;
      const centre = order.find((c) => clear.free(c, 'c') && clear.headroom(c, 'c') && !clear.doorFronts.has(c)) ?? null;
      if (centre !== null) {
        const look = hash(seed, RULE, first) % 1000;
        items.push(hash(seed, RULE, 'what', first) % 2 === 0 ? { type: 'well', cell: centre, pos: 'c', params: { look } } : { type: 'street-tree', cell: centre, pos: 'c', face: 2, params: { look } });
      }
      out.push({ anchor: first, data: { items, centre } });
    }
    return out;
  },
  claims: (c) => (c.data.centre === null ? [] : [slot.floor(c.data.centre, 'c')]),
  apply: (c, out) => emit(out, c.data.items),
});
