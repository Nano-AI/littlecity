// U07 · tier 1 · Retaining wall.
//
// A terrain step of one level or more beside a street or a plaza (the street
// at the foot of the bank, or along its top) is faced with a stone retaining
// wall instead of raw earth: coursed stone, a coping, a pier where it stops,
// now and then a drain hole or a creeper hanging over it.
//
// Which bank edges get a wall, and how each piece's ends meet the terrain's
// rounded corners, is the bankWalls fact (so that rules running earlier keep
// the foot of the bank clear). This rule only places the pieces.
//
// Stability: a piece depends on the ground and the paving within a cell or
// two of it. Its drain and creeper are seeded by its own cell and side.
//
// Reads: bankWalls. Claims: the low cell's edge slot on the bank's side.

import { opposite } from '@/core/grid';
import { defineRule, slot } from '@/resolve/engine/api';
import { DRESSING } from '@/style/dressing';
import { edgePos } from '../decoration/clearways.fact';
import { bankWalls, type BankWall } from './bank-walls.fact';

export default defineRule<BankWall>({
  id: 'U07.retaining-wall',
  part: 'urban',
  tier: 1,
  priority: 930,
  about: 'Reads: bankWalls (terrain steps beside paths and plazas, carved steps, corner radii). Claims: the edge slot at the foot of each piece.',
  find: ({ facts }) => bankWalls(facts).list.map((w) => ({ anchor: w.low, key: w.dir, data: w })),
  claims: (c) => [slot.floor(c.anchor, edgePos(c.data.dir))],
  apply(c, out, { rand }) {
    const w = c.data;
    const face = opposite(w.dir);
    out.prop({
      type: 'retaining-wall',
      at: { cell: w.low, pos: edgePos(w.dir), face },
      params: {
        height: w.rise,
        from: w.from,
        to: w.to,
        r0: Math.round(w.r0 * 1000) / 1000,
        r1: Math.round(w.r1 * 1000) / 1000,
        creeper: rand('creeper') < DRESSING.wallCreeper ? 1 : 0,
        drain: rand('drain') < DRESSING.wallDrain ? 1 : 0,
        look: Math.floor(rand('look') * 1000),
        face,
      },
    });
  },
});
