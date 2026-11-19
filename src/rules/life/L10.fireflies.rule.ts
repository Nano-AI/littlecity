// L10 · Night dressing, the fireflies: over every garden region,
// clamp(cells ÷ 2, 2, 8) of them, spread over its cells; and one by every
// grove tree and willow. src/life/dusk/firefly.behaviour.ts brings them
// out at dusk. (Bunting, lanterns, stars and the moon are the rest of L10:
// the lamp system lights any lantern prop; the page draws the stars.)

import type { CellKey } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { gardens } from '@/resolve/facts/gardens.fact';
import type { CellPos } from '@/resolve/plan';

const SPOTS: readonly CellPos[] = ['ne', 'sw', 'se', 'nw', 'c'];
const TREES = new Set(['grove-tree', 'willow']);

export default defineRule<{ index: number }>({
  id: 'L10.fireflies',
  part: 'life',
  tier: 2,
  priority: 900,
  about: 'Reads: garden regions, tree roles. Emits: firefly actors over gardens (cells ÷ 2, 2 to 8) and one by each grove tree and willow.',
  find({ facts, plan, seed }) {
    const out: { anchor: CellKey; key: string; data: { index: number } }[] = [];
    for (const g of gardens(facts).list) {
      const n = Math.min(8, Math.max(2, Math.floor(g.cells.length / 2)));
      for (let i = 0; i < n; i++) {
        // Spread evenly through the region's cells (they are in ascending order), a different start per town.
        const cell = g.cells[(Math.floor((i * g.cells.length) / n) + ((seed >>> 0) % g.cells.length)) % g.cells.length]!;
        out.push({ anchor: cell, key: `g${g.id}:${i}`, data: { index: i } });
      }
    }
    for (const s of plan.structures.values()) {
      if (s.kind !== 'tree' || !TREES.has(plan.roles.get(s.id)?.role ?? '') || s.cells.length === 0) continue;
      out.push({ anchor: s.cells[0]!, key: `t${s.id}`, data: { index: 0 } });
    }
    return out;
  },
  apply(c, out, ctx) {
    out.actor({ type: 'firefly', at: { cell: c.anchor, pos: SPOTS[Math.floor(ctx.rand('spot') * SPOTS.length)]! }, params: { index: c.data.index } });
  },
});
