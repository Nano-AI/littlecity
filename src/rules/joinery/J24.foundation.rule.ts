// J24 · tier 1 · Foundation. A house cell standing on the ground, with lower
// ground (or water) on some side, gets a stone plinth on that side down to
// it. Against a cliff (terrain rising beside the cell) that side gets no
// base trim at all.
import { below, neighbor, NO_CELL, type Dir4 } from '@/core/grid';
import { defineRule, findEach } from '@/resolve/engine/api';
import { inTerrain, solid } from '@/resolve/facts/lib';
import { houseFacts } from './houses.fact';
import { houseStructures } from './houses.lib';

export default defineRule<{ dir: Dir4; depth: number }>({
  id: 'J24.foundation',
  part: 'joinery',
  tier: 1,
  priority: 760,
  about: 'Reads: terrain under and beside each ground cell of a house. Emits: foundation/plinth (with depth) and foundation/cliff features per cell side.',
  local: 1, // reads only the cells beside and under the house's own (RuleDef.local)
  localReplay: false, // apply only emits what find chose
  ...findEach(houseStructures, (ctx, s) => {
    const hf = houseFacts(ctx.facts);
    const out = [];
    for (const cell of s.cells) {
      if (!inTerrain(ctx.facts, below(cell))) continue; // only cells that stand on the ground
      for (let dir = 0 as Dir4; dir < 4; dir = (dir + 1) as Dir4) {
        const n = neighbor(cell, dir);
        if (n === NO_CELL || ctx.facts.structureAt.get(n) === s.id) continue;
        if (inTerrain(ctx.facts, n)) out.push({ anchor: cell, structure: s.id, key: dir, data: { dir, depth: 0 } });
        else if (!solid(ctx.facts, n)) {
          const depth = hf.dropOutside(cell, dir);
          if (depth >= 1) out.push({ anchor: cell, structure: s.id, key: dir, data: { dir, depth } });
        }
      }
    }
    return out;
  }),
  apply(c, out) {
    const { dir, depth } = c.data;
    if (depth === 0) out.feature({ type: 'foundation', structure: c.structure!, cell: c.anchor, dir, variant: 'cliff' });
    else out.feature({ type: 'foundation', structure: c.structure!, cell: c.anchor, dir, variant: 'plinth', params: { depth } });
  },
});
