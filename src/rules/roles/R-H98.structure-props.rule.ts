// R-H98 · tier 2 · Structure props. The loose things the roles of
// discovery round 1 promise, which belong to a role rather than to any
// general decoration rule (as R-H99 does for the older house roles):
//
//   theatre (R-M09)   a painted backdrop with two masks at the back of the
//                     stage, facing the seats; a brazier at each end of it
//
// A decoration-stage rule (props exist only there), kept with the role rules
// it serves. Priority 896: just before R-H99, and before the general
// doorstep dressing (D11), so these get their floor slots first.

import { keyX, keyZ, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import type { Anchor } from '@/resolve/plan';
import { theatreOf } from './R-M09.theatre.rule';

type Variant = 'backdrop' | 'brazier';
interface Data {
  variant: Variant;
  at: Anchor;
  claim: string;
}

export default defineRule<Data>({
  id: 'R-H98.structure-props',
  part: 'decoration',
  tier: 2,
  priority: 896,
  about: 'Reads: the roles of discovery round 1 (theatre). Emits: structure-prop props. Claims: the floor slots they stand on.',
  find(ctx) {
    const { plan } = ctx;
    const out: Candidate<Data>[] = [];
    const add = (anchor: CellKey, structure: number, key: string, variant: Variant, at: Anchor, claim: string): void => {
      out.push({ anchor, structure, key, data: { variant, at, claim } });
    };
    for (const [id, { role }] of plan.roles) {
      if (role === 'theatre') {
        const t = theatreOf(plan.structures.get(id)!, plan);
        if (!t) continue;
        // The back of the stage: the row farthest from the seats, its middle cell and its two ends.
        const along = (c: CellKey): number => (t.facing === 0 || t.facing === 2 ? keyZ(c) : keyX(c)) * (t.facing === 0 || t.facing === 3 ? -1 : 1);
        const far = Math.max(...t.stage.map(along));
        const row = t.stage.filter((c) => along(c) === far).sort((a, b) => a - b);
        const face = opposite(t.facing) as Dir4;
        const mid = row[Math.floor((row.length - 1) / 2)]!;
        add(mid, id, 'backdrop', 'backdrop', { cell: mid, pos: 'c', face }, slot.floor(mid, 'c'));
        if (row.length >= 3) {
          for (const end of [row[0]!, row[row.length - 1]!]) add(end, id, `brazier${end}`, 'brazier', { cell: end, pos: 'c', face }, slot.floor(end, 'c'));
        }
      }
    }
    return out;
  },
  claims: (c) => [c.data.claim],
  apply(c, out) {
    out.prop({ type: 'structure-prop', variant: c.data.variant, at: c.data.at });
  },
});
