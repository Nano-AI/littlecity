// U15 · tier 2 · Village green (discovery round 1, UF-02).
//
// The open grass a ring of houses looks across is the village's green. The
// landUse fact finds it: grass with no other use that two or more houses'
// ground-storey fronts or sides look straight across (within 5 cells), in
// one connected patch of 9 to 100 cells (less one-wide tendrils) holding a full 3 × 3, looked across
// from two opposite sides, by 4 or more houses in all, with a street
// touching it, and no square (a plaza with a full 3 × 3) within 4. A cell
// between two houses (a gap in a row) is not part of it.
// What must NOT be a green: a garden or wheat (a floor, not grass), a
// fenced field, a front garden, a back yard or pocket park (they are spoken
// for first), the grass in front of one row of houses (one row looks across
// it, not two), a square's lawn.
//
// Dressing:
//   a mown sward on every cell, lighter than the meadow, mown in stripes,
//   with a worn edge where the green ends;
//   the maypole on the cell nearest the green's middle that stands clear of
//   any tree, its ribbons pegged in a ring (an 'activity'/'dance' socket);
//   a ring bench round each tree standing on or at the edge of the green
//   (four 'seat' sockets);
//   the village sign on the edge cell nearest the green's first street.
//
// Stability: everything is seeded by the green's own cells.
//
// Reads: landUse.greens, clearways, tree structures. Claims: the maypole's
// and the sign's slots, each ring bench's tree; the sward claims nothing.

import { keyX, keyY, keyZ, neighbor, NO_CELL, type CellKey } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { DIRS } from '@/resolve/facts/lib';
import type { Slot } from '@/resolve/plan';
import { clearways, edgePos } from '../decoration/clearways.fact';
import { landUse } from './land-use.fact';
import { claimsOf, emit, placer, type Placed } from './plots';

const RULE = 'U15.village-green';

export default defineRule<{ items: Placed[]; trees: CellKey[] }>({
  id: RULE,
  part: 'urban',
  tier: 2,
  priority: 850,
  about: 'Reads: landUse (greens: open grass a ring of 4+ houses looks across, touching a street, no square near), clearways, trees. Claims: the maypole’s and the sign’s slots and each ring-benched tree; the sward claims nothing.',
  find({ facts, seed }) {
    const clear = clearways(facts);
    const out: Candidate<{ items: Placed[]; trees: CellKey[] }>[] = [];
    for (const green of landUse(facts).greens) {
      const set = new Set(green.cells);
      const p = placer((c, pos) => clear.free(c, pos));
      const look = (k: string, c: CellKey): number => hash(seed, RULE, k, c) % 1000;
      // The sward, every cell, at its north-west corner slot (see the part).
      for (const c of green.cells) {
        let mask = 0;
        for (const d of DIRS) if (set.has(neighbor(c, d))) mask |= 1 << d;
        p.put({ type: 'sward', cell: c, pos: 'nw', face: 2, claim: false, params: { mask, stripe: (keyX(c) % 2) as 0 | 1, level: keyY(c) } });
      }
      // Trees on or beside the green.
      const trees: CellKey[] = [];
      for (const c of green.cells) {
        for (const d of DIRS) {
          const n = neighbor(c, d);
          if (n !== NO_CELL && facts.kinds.get(n) === 'tree' && !trees.includes(n)) trees.push(n);
        }
      }
      trees.sort((a, b) => a - b);
      const near = (c: CellKey, k: number): boolean => trees.some((t) => Math.abs(keyX(t) - keyX(c)) + Math.abs(keyZ(t) - keyZ(c)) < k);
      // The maypole: nearest the middle, not beside a tree.
      const mx = green.cells.reduce((a, c) => a + keyX(c), 0) / green.cells.length;
      const mz = green.cells.reduce((a, c) => a + keyZ(c), 0) / green.cells.length;
      const middle = [...green.cells].filter((c) => !near(c, 2)).sort((a, b) => Math.hypot(keyX(a) - mx, keyZ(a) - mz) - Math.hypot(keyX(b) - mx, keyZ(b) - mz) || a - b);
      for (const c of middle) if (p.put({ type: 'maypole', cell: c, pos: 'c', activities: ['dance'], params: { look: look('maypole', c) } })) break;
      // The ring benches.
      for (const t of trees) p.put({ type: 'ring-bench', cell: t, pos: 'c', face: 2, claim: false, seats: 4, params: { look: look('bench', t) } });
      // The village sign: the first edge cell with a street beside it.
      sign: for (const c of green.cells) {
        for (const d of DIRS) {
          if (facts.world.floors.get(neighbor(c, d)) !== 'path') continue;
          if (p.put({ type: 'village-sign', cell: c, pos: edgePos(d), face: d, params: { look: look('sign', c) } })) break sign;
        }
      }
      out.push({ anchor: green.cells[0]!, data: { items: p.items, trees } });
    }
    return out;
  },
  claims: (c): Slot[] => [...claimsOf(c.data.items), ...c.data.trees.map((t) => slot.custom(RULE, 'ring', t))],
  apply: (c, out) => emit(out, c.data.items),
});

