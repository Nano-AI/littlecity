// L51 · tier 2 · Bread: the town's bread from the mill to the table. One
// bakery per town (the one nearest the town's heart): a shop tagged
// shop:bakery or given a baker (L23). Posts (`errand` sockets, name
// `bread|<role>|<ref>`):
//
//   bread|mill     outside the door of the windmill nearest the bakery (one
//                  that can be walked to from it): sacks of flour come out
//   bread|bakery   outside the bakery's door: the sacks are stacked there,
//                  the baker comes out with a tray
//   bread|sell     up to three places that sell the loaves, nearest first:
//                  market stalls (in front of the counter), the inn's door,
//                  a café's door (ref: 'stall' or 'door')
//
// Degrades: no bakery → any shop bakes (shops are few: R-H07); no shop → the
// inn (`bread|bakery|inn`); no inn → a market stall (`bread|bakery|stall`); no
// mill → the bakery bakes from its own flour (no mill post); nowhere to sell
// → the bakery sells from its door (`bread|sell|door` at the bakery).
// src/life/town/chains/bread.ts runs it.

import { defineRule, type Candidate } from '@/resolve/engine/api';
import type { StructureId } from '@/resolve/plan';
import { navOf, steps } from './people.lib';
import { byNearness, doorPlace, heartOf, joined, stallPlace, type Place } from './town.lib';

/** The farthest (in grid steps) a selling place may be from the bakery. */
export const BREAD_REACH = 22;

interface Data extends Place {
  role: 'mill' | 'bakery' | 'sell';
  ref: string;
}

export default defineRule<Data>({
  id: 'L51.bread',
  part: 'life',
  tier: 2,
  priority: 490,
  townWide: true,
  about: 'Reads: shops (shop:bakery, L23 bakers), inns, cafés, market stalls, windmills, the walking graph. Emits: errand sockets bread|mill, bread|bakery, bread|sell.',
  find(ctx) {
    const nav = navOf(ctx);
    if (!nav) return [];
    const { facts, plan } = ctx;
    const structures = [...facts.structures.values()].sort((a, b) => a.id - b.id);
    const role = (id: StructureId): string | undefined => plan.roles.get(id)?.role;
    // Bakeries: tagged, or given a baker by L23.
    const bakers = new Set<StructureId>();
    for (const s of ctx.dressing?.sockets ?? []) if (s.type === 'workplace' && (s.name ?? '').startsWith('baker|') && s.structure !== undefined) bakers.add(s.structure);
    // A shop that is a bakery by its sign first; else one L23 gave a baker.
    const bakeries: Place[] = [];
    // (Shops are few now, by place (R-H07): any shop at all bakes, before the town has to turn to its inn.)
    for (const want of [(id: StructureId) => plan.tags.get(id)?.has('shop:bakery') === true, (id: StructureId) => bakers.has(id), () => true]) {
      for (const s of structures) {
        if (role(s.id) !== 'shop' || !want(s.id)) continue;
        const at = doorPlace(nav, s.id);
        if (at) bakeries.push(at);
      }
      if (bakeries.length > 0) break;
    }
    let ref = '';
    if (bakeries.length === 0) {
      for (const s of structures) {
        if (role(s.id) !== 'inn') continue;
        const at = doorPlace(nav, s.id);
        if (at) bakeries.push(at);
      }
      ref = 'inn';
    }
    if (bakeries.length === 0) {
      // No shop and no inn: a market stall bakes (its loaves on its own counter).
      for (const s of structures) {
        if (role(s.id) !== 'market-stall') continue;
        const at = stallPlace(ctx, nav, s.id);
        if (at) bakeries.push(at);
      }
      ref = 'stall';
    }
    if (bakeries.length === 0) return [];
    const heart = heartOf(ctx) ?? bakeries[0]!.cell;
    const bakery = byNearness(heart, bakeries)[0]!;
    const out: Candidate<Data>[] = [{ anchor: bakery.cell, key: 'bakery', data: { ...bakery, role: 'bakery', ref } }];
    // The mill.
    const mills = structures.filter((s) => s.kind === 'windmill' || role(s.id) === 'watermill').map((s) => doorPlace(nav, s.id)).filter((p): p is Place => p !== null && joined(nav, p.cell, bakery.cell));
    const mill = byNearness(bakery.cell, mills)[0];
    if (mill) out.push({ anchor: mill.cell, key: 'mill', data: { ...mill, role: 'mill', ref: String(bakery.structure) } });
    // Where the loaves are sold.
    const sells: (Place & { ref: string })[] = [];
    for (const s of structures) {
      if (s.id === bakery.structure) continue;
      const r = role(s.id);
      let at: Place | null = null;
      let kind = 'door';
      if (r === 'market-stall') {
        at = stallPlace(ctx, nav, s.id);
        kind = 'stall';
      } else if (r === 'inn' || (r === 'shop' && plan.tags.get(s.id)?.has('shop:cafe'))) at = doorPlace(nav, s.id);
      if (!at || !joined(nav, at.cell, bakery.cell) || steps(at.cell, bakery.cell) > BREAD_REACH) continue;
      sells.push({ ...at, ref: kind });
    }
    byNearness(bakery.cell, sells);
    // A stall first if there is one (the loaves show on its counter), then the rest by nearness.
    const chosen = [...sells.filter((s) => s.ref === 'stall').slice(0, 2), ...sells.filter((s) => s.ref !== 'stall')].slice(0, 3);
    if (chosen.length === 0) chosen.push({ ...bakery, ref: 'door' });
    chosen.forEach((s, i) => out.push({ anchor: s.cell, key: `sell${i}`, data: { ...s, role: 'sell' } }));
    return out;
  },
  apply(c, out) {
    const d = c.data;
    out.socket({ id: `L51.bread@${c.anchor}:${String(c.key)}`, type: 'errand', cell: c.anchor, dir: d.dir, structure: d.structure, name: `bread|${d.role}|${d.ref}` });
  },
});
