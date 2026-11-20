// L60 · tier 2 · Washing day. Every laundry line (D05) gets a post
// `laundry|line|<prop id>`: the walkable cell under its first anchor (the
// street the line hangs over), facing the line; `structure` is the house the
// first anchor is on, whose people do the washing. src/life/town/chains/
// laundry.ts carries the wash out, hangs it, and takes it in at dusk or rain.

import { DIR4, key, keyX, keyY, keyZ } from '@/core/grid';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { navOf } from './people.lib';
import type { Place } from './town.lib';

export default defineRule<Place & { prop: string }>({
  id: 'L60.laundry',
  part: 'life',
  tier: 2,
  priority: 400,
  townWide: true,
  about: 'Reads: laundry lines (D05) and their anchors, the walking graph. Emits: an errand socket laundry|line under each line.',
  find(ctx) {
    const nav = navOf(ctx);
    if (!nav || !ctx.dressing) return [];
    const sockets = new Map([...ctx.plan.sockets, ...ctx.dressing.sockets].map((s) => [s.id, s]));
    const out: Candidate<Place & { prop: string }>[] = [];
    for (const p of ctx.dressing.props) {
      if (p.type !== 'laundry-line' || !('from' in p.at)) continue;
      const a = sockets.get(p.at.from);
      if (!a || a.dir === undefined) continue;
      const house = ctx.facts.structureAt.get(a.cell);
      if (house === undefined) continue;
      // Out from the wall under the line, down to whatever the street's level is.
      const [dx, dz] = DIR4[a.dir]!;
      let cell: number | null = null;
      for (let y = keyY(a.cell); y >= Math.max(0, keyY(a.cell) - 3) && cell === null; y--) {
        const c = key(keyX(a.cell) + dx, y, keyZ(a.cell) + dz);
        if (nav.nodeAt.has(c)) cell = c;
      }
      if (cell === null) continue;
      out.push({ anchor: cell, key: p.id, data: { cell, dir: ((a.dir + 2) % 4) as Place['dir'], structure: house, prop: p.id } });
    }
    return out;
  },
  apply(c, out) {
    const d = c.data;
    out.socket({ id: `L60.laundry@${d.prop}`, type: 'errand', cell: c.anchor, dir: d.dir, structure: d.structure, name: `laundry|line|${d.prop}` });
  },
});
