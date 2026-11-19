// L14 · tier 2 · Sparrows: one per 6 cells on every street of length 6 or
// more, spread along it. They hop about the street and flit off when a
// block lands near (src/life/birds/characters.behaviour.ts).

import type { CellKey } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { streets } from '@/resolve/facts/streets.fact';

export default defineRule<undefined>({
  id: 'L14.sparrows',
  part: 'life',
  tier: 2,
  priority: 860,
  about: 'Reads: streets. Emits: a sparrow per 6 cells of every street of 6+ cells, spread along it.',
  find({ facts }) {
    const out: { anchor: CellKey; key: string; data: undefined }[] = [];
    for (const st of streets(facts).list) {
      if (st.length < 6) continue;
      const n = Math.floor(st.length / 6);
      for (let i = 0; i < n; i++) out.push({ anchor: st.cells[Math.floor(((i + 0.5) * st.cells.length) / n)]!, key: `s${i}`, data: undefined });
    }
    return out;
  },
  apply(c, out) {
    out.actor({ type: 'small-bird', variant: 'sparrow', at: { cell: c.anchor, pos: 'c' } });
  },
});
