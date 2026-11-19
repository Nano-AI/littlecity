// U05 · tier 2 · Street trees.
//
// A straight street segment of DRESSING.treeStreet cells or more with a
// grass verge along one side gets a row of small trees on that verge, one
// every DRESSING.treeEvery cells. The side with the longer verge is planted
// (the west or north side on a tie), and only if at least four of its cells
// are verge. The trees are props, not blocks: the player cannot build on
// them and they never count as a grove.
//
// A tree stands in the middle of its verge cell, never in front of a door,
// under an awning, in a garden, a yard, a park or a field, beside a block
// tree (the player's own planting comes first), on a trail, or right beside
// a lamp, a signpost or a flagpole (three poles in a row are clutter).
//
// Stability: which cells are planted is a fixed lattice of the map (the
// cell's coordinate along the street), so growing the street keeps every
// tree where it was.
//
// Reads: streets (segments), verges, landUse, clearways. Claims: the centre
// slot of the verge cell.

import { keyX, keyZ, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { DIRS } from '@/resolve/facts/lib';
import { streets } from '@/resolve/facts/streets.fact';
import { verges } from '@/resolve/facts/verges.fact';
import { DRESSING } from '@/style/dressing';
import { clearways } from '../decoration/clearways.fact';
import { landUse } from './land-use.fact';

const RULE = 'U05.street-trees';

export default defineRule({
  id: RULE,
  part: 'urban',
  tier: 2,
  priority: 950,
  about: 'Reads: streets (straight segments), verges, landUse, clearways. Claims: the centre slot of each planted verge cell.',
  find({ facts, dressing }) {
    const clear = clearways(facts);
    // Cells that already hold a lamp or a signpost: a tree keeps a cell's distance from them.
    const poles = new Set<CellKey>();
    for (const p of dressing?.props ?? []) if ((p.type === 'lamp' || p.type === 'signpost' || p.type === 'flag') && 'cell' in p.at) poles.add(p.at.cell);
    const verge = verges(facts);
    const uses = landUse(facts);
    const every = Math.max(2, Math.round(DRESSING.treeEvery));
    const out: Candidate[] = [];
    const seen = new Set<CellKey>();
    for (const street of streets(facts).list) {
      for (const seg of street.segments) {
        if (seg.length < DRESSING.treeStreet) continue;
        const sides: [Dir4, Dir4] = seg.axis === 'x' ? [0, 2] : [3, 1];
        const rows = sides.map((d) =>
          seg.cells
            .map((c) => neighbor(c, d))
            .filter((v) => v !== NO_CELL && verge.byCell.has(v) && !verge.byCell.get(v)!.fenced && !uses.byCell.has(v)),
        );
        const row = rows[1]!.length > rows[0]!.length ? rows[1]! : rows[0]!;
        if (row.length < 4) continue;
        for (const v of row) {
          const along = seg.axis === 'x' ? keyX(v) : keyZ(v);
          if (along % every !== 0 || seen.has(v)) continue;
          if (!clear.free(v, 'c') || clear.doorFronts.has(v) || !clear.headroom(v, 'c')) continue;
          // Not crown to crown with a tree the player planted, and not hard against a building.
          if (DIRS.some((d) => facts.kinds.has(neighbor(v, d)) || poles.has(neighbor(v, d)))) continue;
          seen.add(v);
          out.push({ anchor: v });
        }
      }
    }
    return out;
  },
  claims: (c) => [slot.floor(c.anchor, 'c')],
  apply(c, out, ctx) {
    out.prop({ type: 'street-tree', at: { cell: c.anchor, pos: 'c', face: 2 }, params: { look: hash(ctx.seed, RULE, c.anchor) % 1000 } });
  },
});
