// L35 · tier 3 · Insects: butterflies over gardens by day (1 + cells ÷ 8 per
// garden region, at most 3), and bees by flower boxes and flower beds (one
// by each with chance 0.35, at most 10 in town, nearest the lowest cell
// first). src/life/small/insect.behaviour.ts flies them; they are out only
// by day.

import type { CellKey } from '@/core/grid';
import { rand } from '@/core/rand';
import { defineRule } from '@/resolve/engine/api';
import { gardens } from '@/resolve/facts/gardens.fact';
import { socketById } from '@/resolve/facts/plan-index.fact';
import type { Anchor } from '@/resolve/plan';

const BEES = 10;

type Data = { kind: 'butterfly' | 'bee'; at: Anchor };

export default defineRule<Data>({
  id: 'L35.insects',
  part: 'life',
  tier: 3,
  priority: 650,
  about: 'Reads: garden regions, flower-box and flower-bed props. Emits: butterflies over gardens, bees by flowers (day only).',
  find({ facts, dressing, seed }) {
    const out: { anchor: CellKey; key: string; data: Data }[] = [];
    for (const g of gardens(facts).list) {
      const n = Math.min(3, 1 + Math.floor(g.cells.length / 8));
      for (let i = 0; i < n; i++) {
        const cell = g.cells[Math.floor(((i + 0.5) * g.cells.length) / n)]!;
        out.push({ anchor: cell, key: `g${g.id}:${i}`, data: { kind: 'butterfly', at: { cell, pos: 'c' } } });
      }
    }
    let bees = 0;
    const flowers = (dressing?.props ?? []).filter((p) => p.type === 'flower-box' || p.type === 'flower-bed');
    for (const p of flowers) {
      if (bees >= BEES || rand(seed, 'L35', 'bee', p.id) >= 0.35) continue;
      const anchor = 'cell' in p.at ? p.at.cell : 'socket' in p.at ? socketById(facts, p.at.socket)?.cell : undefined;
      if (anchor === undefined) continue;
      out.push({ anchor, key: `b${p.id}`, data: { kind: 'bee', at: p.at } });
      bees++;
    }
    return out;
  },
  apply(c, out, ctx) {
    out.actor({ type: 'insect', variant: c.data.kind, at: c.data.at, params: { look: Math.floor(ctx.rand('look') * 4) } });
  },
});
