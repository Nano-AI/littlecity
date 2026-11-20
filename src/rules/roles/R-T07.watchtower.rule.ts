// R-T07 · Watchtower. The default tower role: a round stone tower with a cone
// roof and small windows spiralling a quarter turn per storey. J13 turns the
// role into the cap and the windows; the flag (p = 0.5) is D13's, on the
// cap's flag-mount socket.
//
// FX-10: where towers crowd (an Auto town clicks them by the dozen), only the
// first of a cluster keeps the cone. A tower with another tower of a lower id
// within 4 columns gets a seeded other look (tag watch:pyramid, a square
// body under a tiled pyramid; or watch:crenel, a square tower house with a
// crenellated top, as in San Gimignano), so a cluster reads as a town's towers, not a row of cones.

import { keyX, keyZ } from '@/core/grid';
import { rand } from '@/core/rand';
import { defineRule } from '@/resolve/engine/api';

/** How far (Chebyshev, in columns) another tower counts as standing near. */
const CROWD = 4;

export default defineRule<{ crowded: boolean; seed: number }>({
  id: 'R-T07.watchtower',
  part: 'roles',
  tier: 1,
  priority: 8930,
  about: 'Reads: tower structures with no role yet, other towers within 4. Emits: role watchtower; tag watch:pyramid or watch:crenel for all but the first of a crowd.',
  find({ plan }) {
    const out = [];
    const towers = [...plan.structures.values()].filter((s) => s.kind === 'tower' && s.cells.length > 0);
    for (const s of towers) {
      if (plan.roles.has(s.id)) continue;
      const x = keyX(s.cells[0]!), z = keyZ(s.cells[0]!);
      const crowded = towers.some((o) => o.id < s.id && Math.max(Math.abs(keyX(o.cells[0]!) - x), Math.abs(keyZ(o.cells[0]!) - z)) <= CROWD);
      out.push({ anchor: s.cells[0]!, structure: s.id, data: { crowded, seed: s.seed } });
    }
    return out;
  },
  apply(c, out) {
    out.role(c.structure!, 'watchtower');
    if (!c.data.crowded) return;
    const r = rand(c.data.seed, 'watch-look');
    if (r < 0.5) out.tag(c.structure!, 'watch:pyramid');
    else if (r < 0.85) out.tag(c.structure!, 'watch:crenel');
  },
});
