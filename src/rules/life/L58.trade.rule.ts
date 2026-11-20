// L58 · tier 2 · Trade from the quay. A town with a quay (R-D01) has places
// that take what the ships land: up to TRADE_DESTS shops, inns and market
// stalls within TRADE_REACH steps of a quay that can be walked to from it,
// nearest first. Posts `trade|to|door` outside a shop's or inn's door, and
// `trade|to|stall` in front of a market stall. src/life/town/chains/trade.ts
// sends carters with handcarts from the goods piled on the quay (the
// harbour's piles, L38–L40) to them.

import { above, NO_CELL } from '@/core/grid';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { navOf, steps } from './people.lib';
import { byNearness, doorPlace, joined, stallPlace, type Place } from './town.lib';

export const TRADE_REACH = 24;
export const TRADE_DESTS = 5;

export default defineRule<Place & { ref: string }>({
  id: 'L58.trade',
  part: 'life',
  tier: 2,
  priority: 420,
  townWide: true,
  about: 'Reads: quays, shops, inns, market stalls, the walking graph. Emits: errand sockets trade|to at the places that take landed goods.',
  find(ctx) {
    const nav = navOf(ctx);
    if (!nav) return [];
    const { facts, plan } = ctx;
    const all = [...facts.structures.values()].sort((a, b) => a.id - b.id);
    // Where people stand on the quays: the cells above their blocks.
    const from = all.filter((s) => plan.roles.get(s.id)?.role === 'quay').flatMap((s) => s.cells.map((c) => above(c)).filter((c) => c !== NO_CELL && nav.nodeAt.has(c)));
    if (from.length === 0) return [];
    const dests: (Place & { ref: string })[] = [];
    for (const s of all) {
      const role = plan.roles.get(s.id)?.role;
      let at: Place | null = null;
      let ref = 'door';
      if (role === 'market-stall') {
        at = stallPlace(ctx, nav, s.id);
        ref = 'stall';
      } else if (role === 'shop' || role === 'inn') at = doorPlace(nav, s.id);
      if (!at) continue;
      const near = from.reduce((best, c) => Math.min(best, steps(c, at!.cell)), Infinity);
      if (near > TRADE_REACH || !joined(nav, at.cell, from[0]!)) continue;
      dests.push({ ...at, ref });
    }
    const out: Candidate<Place & { ref: string }>[] = [];
    for (const d of byNearness(from[0]!, dests).slice(0, TRADE_DESTS)) out.push({ anchor: d.cell, key: `to:${d.structure}`, data: d });
    return out;
  },
  apply(c, out) {
    const d = c.data;
    out.socket({ id: `L58.trade@${c.anchor}:${String(c.key)}`, type: 'errand', cell: c.anchor, dir: d.dir, structure: d.structure, name: `trade|to|${d.ref}` });
  },
});

