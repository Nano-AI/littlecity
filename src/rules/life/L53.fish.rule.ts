// L53 · tier 2 · The catch comes in (with discovery LF-07). Each fisher's
// spot on a dock (L23's `fisher` workplace) is a post `fish|catch`; the
// nearest one or two fish stalls (R-S01) and fish shops (shop:fish) within
// FISH_REACH that can be walked to are posts `fish|sell|stall` (at the
// counter) or `fish|sell|door`. A fisher with nowhere to sell gets no catch
// post. src/life/town/chains/fish.ts runs it.

import { defineRule, type Candidate } from '@/resolve/engine/api';
import { navOf, steps } from './people.lib';
import { byNearness, doorPlace, joined, stallPlace, type Place } from './town.lib';

/** The farthest (grid steps) the catch is carried. */
export const FISH_REACH = 20;

interface Data extends Place {
  role: 'catch' | 'sell';
  ref: string;
}

export default defineRule<Data>({
  id: 'L53.fish',
  part: 'life',
  tier: 2,
  priority: 470,
  townWide: true,
  about: 'Reads: L23 fisher workplaces, fish stalls, fish shops, the walking graph. Emits: errand sockets fish|catch and fish|sell.',
  find(ctx) {
    const nav = navOf(ctx);
    if (!nav) return [];
    const { facts, plan } = ctx;
    const catches = (ctx.dressing?.sockets ?? []).filter((s) => s.type === 'workplace' && (s.name ?? '').startsWith('fisher|') && s.structure !== undefined && s.dir !== undefined);
    const sells: (Place & { ref: string })[] = [];
    for (const s of [...facts.structures.values()].sort((a, b) => a.id - b.id)) {
      const role = plan.roles.get(s.id)?.role;
      if (role === 'fish-stall') {
        const at = stallPlace(ctx, nav, s.id);
        if (at) sells.push({ ...at, ref: 'stall' });
      } else if (role === 'shop' && plan.tags.get(s.id)?.has('shop:fish')) {
        const at = doorPlace(nav, s.id);
        if (at) sells.push({ ...at, ref: 'door' });
      }
    }
    const out: Candidate<Data>[] = [];
    const used = new Set<string>();
    for (const c of catches) {
      const near = byNearness(c.cell, sells.filter((s) => joined(nav, s.cell, c.cell) && steps(s.cell, c.cell) <= FISH_REACH)).slice(0, 2);
      if (near.length === 0) continue;
      out.push({ anchor: c.cell, key: `catch:${c.structure}`, data: { cell: c.cell, dir: c.dir!, structure: c.structure!, role: 'catch', ref: String(c.structure) } });
      for (const s of near) {
        const k = `sell:${s.structure}`;
        if (used.has(k)) continue;
        used.add(k);
        out.push({ anchor: s.cell, key: k, data: { ...s, role: 'sell' } });
      }
    }
    return out;
  },
  apply(c, out) {
    const d = c.data;
    out.socket({ type: 'errand', cell: c.anchor, dir: d.dir, structure: d.structure, name: `fish|${d.role}|${d.ref}` });
  },
});
