// L52 · tier 2 · Water: residents fetch water. Every well, basin and tiered
// fountain (R-F01; not a birdbath) gets up to two posts beside it, facing it
// (`water|well|<role>`), on walkable cells. src/life/town/chains/water.ts
// sends a resident living within WATER_REACH of one to fill a bucket there
// now and then and carry it home.

import { defineRule, type Candidate } from '@/resolve/engine/api';
import { navOf } from './people.lib';
import { besidePlaces, type Place } from './town.lib';

/** The farthest (grid steps) from home a resident walks for water. */
export const WATER_REACH = 14;

const SOURCES = new Set(['well', 'basin', 'tiered-fountain']);

export default defineRule<Place & { role: string }>({
  id: 'L52.water',
  part: 'life',
  tier: 2,
  priority: 480,
  townWide: true,
  about: 'Reads: fountains (well, basin, tiered fountain), the walking graph. Emits: errand sockets water|well beside each, at most two.',
  find(ctx) {
    const nav = navOf(ctx);
    if (!nav) return [];
    const out: Candidate<Place & { role: string }>[] = [];
    for (const s of [...ctx.facts.structures.values()].sort((a, b) => a.id - b.id)) {
      const role = ctx.plan.roles.get(s.id)?.role;
      if (s.kind !== 'fountain' || !role || !SOURCES.has(role)) continue;
      besidePlaces(nav, s.cells, s.id, 2).forEach((p, i) => out.push({ anchor: p.cell, key: `${s.id}:${i}`, data: { ...p, role } }));
    }
    return out;
  },
  apply(c, out) {
    const d = c.data;
    out.socket({ id: `L52.water@${c.anchor}:${String(c.key)}`, type: 'errand', cell: c.anchor, dir: d.dir, structure: d.structure, name: `water|well|${d.role}` });
  },
});
