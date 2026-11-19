// D06 · tier 2 · Hanging lanterns.
//
//   Under every gateway (an arch with the role 'gateway', R-A04): a lantern
//   hanging from the crown of the arch, always.
//
//   In an alley two cells long or more: for DRESSING.alleyLantern of alleys
//   (one roll per alley, seeded by its first cell), one lantern on an iron
//   bracket on a house wall at the middle of the alley.
//
// Sky bridges get theirs from D20. Each lantern owns a 'lamp-head' socket.
//
// Reads: arch-crown sockets and roles, alleys, occupancy. Claims: the arch's
// socket, or the wall face the bracket is fixed to.

import { neighbor, NO_CELL, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { alleys } from '@/resolve/facts/alleys.fact';
import { occupancy } from '@/resolve/facts/occupancy.fact';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';
import { DRESSING } from '@/style/dressing';
import { lucky } from './lib';

const RULE = 'D06.hanging-lanterns';

type Lantern = { socket: string } | { wall: CellKey; dir: Dir4 };

export default defineRule<Lantern>({
  id: RULE,
  part: 'decoration',
  tier: 2,
  priority: 940,
  about: 'Reads: arch-crown sockets of gateways, alleys, occupancy. Claims: the arch-crown socket, or the wall face a bracket is fixed to.',
  find({ facts, plan, seed }) {
    const out: Candidate<Lantern>[] = [];
    for (const s of socketsOfType(facts, 'arch-crown')) {
      if (s.structure !== undefined && plan.roles.get(s.structure)?.role === 'gateway') out.push({ anchor: s.cell, structure: s.structure, key: s.id, data: { socket: s.id } });
    }
    const occ = occupancy(facts);
    for (const alley of alleys(facts).list) {
      const first = alley.cells[0]!;
      if (alley.length < 2 || !lucky(seed, RULE, first, alley.axis, DRESSING.alleyLantern)) continue;
      const mid = alley.cells[Math.floor((alley.length - 1) / 2)]!;
      // Its walls are north and south of an east–west alley, west and east of a north–south one.
      const sides: Dir4[] = alley.axis === 'x' ? [0, 2] : [3, 1];
      const start = hash(seed, RULE, 'side', first) % 2;
      for (const d of [sides[start]!, sides[1 - start]!]) {
        const wall = neighbor(mid, d);
        if (wall === NO_CELL || occ.kindAt(wall) !== 'house') continue;
        out.push({ anchor: mid, structure: occ.structure[wall], key: alley.axis, data: { wall, dir: opposite(d) } });
        break;
      }
    }
    return out;
  },
  claims: (c) => ['socket' in c.data ? slot.socket(c.data.socket) : slot.custom(RULE, c.data.wall, c.data.dir)],
  apply(c, out) {
    const d = c.data;
    if ('socket' in d) {
      const lamp = out.prop({ type: 'hanging-lantern', at: { socket: d.socket } });
      out.socket({ type: 'lamp-head', owner: lamp, cell: c.anchor, structure: c.structure });
    } else {
      const mount = out.socket({ type: 'wall-mount', cell: d.wall, dir: d.dir, structure: c.structure });
      const lamp = out.prop({ type: 'hanging-lantern', variant: 'bracket', at: { socket: mount } });
      out.socket({ type: 'lamp-head', owner: lamp, cell: c.anchor, structure: c.structure });
    }
  },
});
