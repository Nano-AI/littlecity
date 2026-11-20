// L14 · tier 2 · Sparrows: one per 6 cells on every street of length 6 or
// more, spread along it. They hop about the street and flit off when a
// block lands near (src/life/birds/characters.behaviour.ts).
//
// Where they are is each cell's own draw: the street is cut into 6 × 6
// tiles of the map, each tile's sparrow is on its own best-drawn cell, and
// the street keeps the best-drawn tiles' sparrows. So a change somewhere
// along a long street (a house built across it, a crater) moves only the
// sparrows near it; spaced by their place in the street's list, every
// sparrow past the change moved over a cell at once.

import { keyX, keyZ, type CellKey } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule } from '@/resolve/engine/api';
import { streets } from '@/resolve/facts/streets.fact';

const TILE = 6;

export default defineRule<undefined>({
  id: 'L14.sparrows',
  part: 'life',
  tier: 2,
  priority: 860,
  about: 'Reads: streets. Emits: a sparrow per 6 cells of every street of 6+ cells, spread along it (one to a 6 × 6 tile, each on its own drawn cell).',
  find({ facts }) {
    const out: { anchor: CellKey; key: string; data: undefined }[] = [];
    for (const st of streets(facts).list) {
      if (st.length < 6) continue;
      const n = Math.floor(st.length / 6);
      const draw = (c: CellKey): number => hash(0x5aa7, c) >>> 0;
      // Each tile's best-drawn cell, then the street's best-drawn tiles; any cell at all if it runs short.
      const best = new Map<number, CellKey>();
      for (const c of st.cells) {
        const t = Math.floor(keyX(c) / TILE) * 64 + Math.floor(keyZ(c) / TILE);
        const had = best.get(t);
        if (had === undefined || draw(c) < draw(had)) best.set(t, c);
      }
      const picks = [...best.values()].sort((a, b) => draw(a) - draw(b) || a - b).slice(0, n);
      if (picks.length < n) {
        const taken = new Set(picks);
        for (const c of [...st.cells].sort((a, b) => draw(a) - draw(b) || a - b)) {
          if (picks.length >= n) break;
          if (!taken.has(c)) picks.push(c);
        }
      }
      for (const c of picks) out.push({ anchor: c, key: 's', data: undefined });
    }
    return out;
  },
  apply(c, out) {
    out.actor({ type: 'small-bird', variant: 'sparrow', at: { cell: c.anchor, pos: 'c' } });
  },
});
