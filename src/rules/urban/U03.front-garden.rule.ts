// U03 · tier 1 · Front garden.
//
// Exactly one cell of bare grass between a house's main door and a street
// becomes a front garden: a low picket fence along the street with a gate in
// line with the door, a fence down each open flank back to the house, and a
// flower bed either side of the short walk (the walk itself is J08's trail).
// The flowers are the house's own colour, the same as its window boxes.
//
// Which cells are front gardens is decided by the landUse fact, so that the
// decoration rules that run earlier leave them alone.
//
// Reads: landUse.frontGardens. Claims: every floor slot of the garden cell
// except its centre (the walk).

import { opposite, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot } from '@/resolve/engine/api';
import type { CellPos } from '@/resolve/plan';
import { edgePos } from '../decoration/clearways.fact';
import { landUse, type FrontGarden } from './land-use.fact';

const AROUND: readonly CellPos[] = ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'];

export default defineRule<FrontGarden>({
  id: 'U03.front-garden',
  part: 'urban',
  tier: 1,
  priority: 970,
  about: 'Reads: landUse (front gardens: main doors, the grass cell before them, the street beyond). Claims: the eight outer floor slots of the garden cell.',
  find: ({ facts }) => landUse(facts).frontGardens.map((g) => ({ anchor: g.cell, structure: g.house, data: g })),
  claims: (c) => AROUND.map((p) => slot.floor(c.anchor, p)),
  apply(c, out, ctx) {
    const g = c.data;
    const cell = g.cell;
    const look = Math.floor(ctx.rand('look') * 1000);
    const minus = ((g.dir + 3) % 4) as Dir4, plus = ((g.dir + 1) % 4) as Dir4;
    // The street fence, with its gate. It draws the corner posts.
    out.prop({ type: 'garden-fence', variant: 'gate', at: { cell, pos: edgePos(g.dir), face: opposite(g.dir) }, params: { from: 1, to: 1, look } });
    // The flanks: from the street corner (no post: the street fence drew it) back into the house wall.
    // A flank piece's own +X is a quarter turn on from its side, so the street end is its −X end on
    // the +X flank and its +X end on the −X flank.
    if (g.closed[1]) out.prop({ type: 'garden-fence', variant: 'picket', at: { cell, pos: edgePos(plus), face: opposite(plus) }, params: { from: 0, to: 2, look: look + 1 } });
    if (g.closed[0]) out.prop({ type: 'garden-fence', variant: 'picket', at: { cell, pos: edgePos(minus), face: opposite(minus) }, params: { from: 2, to: 0, look: look + 2 } });
    // A bed either side of the walk, running the way the walk does.
    const house = ctx.plan.structures.get(g.house);
    const flowers = hash(house?.seed ?? 1, 'flowers') % 5;
    const along = g.dir === 1 || g.dir === 3 ? 0 : 1;
    for (const [i, side] of [minus, plus].entries()) {
      out.prop({ type: 'flower-bed', variant: 'border', at: { cell, pos: edgePos(side), face: 2 }, params: { flowers, along, look: look + 3 + i } });
    }
  },
});
