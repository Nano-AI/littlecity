// D30 · tier 3 · Stair pots. A flight of stairs that climbs along a wall (a
// solid block or the bank beside it, on one side) has flower pots standing
// on some of its steps against that wall: DEPTH.stairPots of such stairs
// cells, two or three pots each, on seeded steps. The walking side stays
// clear: the pots stand in the strip of tread by the wall.
//
// Stability: each stairs cell's roll and steps are its own.
//
// Reads: stairs blocks (their facing), occupancy (solid sides), terrain.
// Claims: the stairs cell's own slot for the pots.

import { neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { occupancy, SOLID, TERRAIN } from '@/resolve/facts/occupancy.fact';
import { DEPTH } from '@/style/depth';
import { STAIRS } from '@/style/edges';
import { lucky } from './lib';

const RULE = 'D30.stair-pots';

export default defineRule<{ cell: CellKey; rot: Dir4; side: number; steps: number }>({
  id: RULE,
  part: 'decoration',
  tier: 3,
  priority: 700,
  about: 'Reads: stairs blocks and their facing, solid blocks or banks beside them. Claims: a slot of the stairs cell for its pots.',
  find({ facts, seed }) {
    const occ = occupancy(facts);
    const out: Candidate<{ cell: CellKey; rot: Dir4; side: number; steps: number }>[] = [];
    const n = Math.max(2, Math.round(STAIRS.steps));
    for (const [cell, kind] of facts.kinds) {
      if (kind !== 'stairs') continue;
      const rot = ((facts.world.blocks.get(cell)?.rot ?? 0) & 3) as Dir4;
      // The prop's +X (side 1) is toward (rot + 3) % 4; side −1 toward (rot + 1) % 4.
      const solidAt = (d: Dir4): boolean => {
        const nb = neighbor(cell, d);
        return nb !== NO_CELL && (occ.flags[nb]! & (SOLID | TERRAIN)) !== 0 && occ.kindAt(nb) !== 'stairs';
      };
      const plus = solidAt(((rot + 3) % 4) as Dir4), minus = solidAt(((rot + 1) % 4) as Dir4);
      if (plus === minus) continue; // open on both sides, or a cutting between two walls
      if (!lucky(seed, RULE, cell, 'pots', DEPTH.stairPots)) continue;
      // All the steps but one (and never the top one, which meets the landing).
      const skip = hash(seed, RULE, cell, 'skip') % (n - 1);
      let steps = 0;
      for (let i = 0; i < n - 1; i++) if (i !== skip || n - 1 <= 2) steps |= 1 << i;
      out.push({ anchor: cell, key: 'pots', data: { cell, rot, side: plus ? 1 : -1, steps } });
    }
    return out;
  },
  claims: (c) => [slot.custom(RULE, c.data.cell)],
  apply(c, out, ctx) {
    const d = c.data;
    out.prop({ type: 'stair-pots', at: { cell: d.cell, pos: 'c', face: d.rot }, params: { side: d.side, steps: d.steps, look: Math.floor(ctx.rand('look') * 1000) } });
  },
});
