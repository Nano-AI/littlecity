// L67 · tier 2 · Carol singers. A town of 6 houses or more → a round of up
// to CAROLS.doors front doors (`carol|door|<order>` on each doorstep, facing
// the door): from the house nearest the town's heart, each next the nearest
// not yet sung to, all in the part of the walking graph round the heart.
// src/life/town/chains/carols.ts holds the singing.

import { opposite, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { CAROLS } from '@/style/scenes';
import { frontDoor, homes, navOf, steps } from './people.lib';
import { heartOf } from './town.lib';

type Data = { order: number; dir: Dir4; structure: number };

export default defineRule<Data>({
  id: 'L67.carols',
  part: 'life',
  tier: 2,
  priority: 400,
  townWide: true,
  about: 'Reads: houses and their front doors, the walking graph, the heart. Emits: errand sockets carol|door on a round of doorsteps.',
  find(ctx) {
    const nav = navOf(ctx);
    if (!nav) return [];
    const doors = homes(ctx)
      .map((h) => ({ h, d: frontDoor(nav, h.id) }))
      .filter((x): x is { h: typeof x.h; d: NonNullable<typeof x.d> } => x.d !== null && x.d.dir !== undefined)
      .map((x) => ({ structure: x.h.id, cell: nav.nodes[x.d.node]!.cell, dir: opposite(x.d.dir!) as Dir4, part: nav.part[x.d.node]! }));
    if (doors.length < 6) return [];
    const heart = heartOf(ctx) ?? doors[0]!.cell;
    const parts = new Map<number, number>();
    for (const d of doors) parts.set(d.part, (parts.get(d.part) ?? 0) + 1);
    const main = [...parts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0];
    const left = doors.filter((d) => d.part === main);
    const round: typeof left = [];
    let at: CellKey = heart;
    while (round.length < Math.round(CAROLS.doors) && left.length > 0) {
      left.sort((a, b) => steps(a.cell, at) - steps(b.cell, at) || a.cell - b.cell);
      const next = left.shift()!;
      // Two houses sharing a doorstep are sung to once.
      if (round.some((r) => r.cell === next.cell)) continue;
      round.push(next);
      at = next.cell;
    }
    if (round.length < 3) return [];
    return round.map((d, order) => ({ anchor: d.cell, key: `door${order}`, structure: d.structure, data: { order, dir: d.dir, structure: d.structure } })) satisfies Candidate<Data>[];
  },
  apply(c, out) {
    out.socket({ id: `L67.carols@${c.anchor}:${String(c.key)}`, type: 'errand', cell: c.anchor, dir: c.data.dir, structure: c.data.structure, name: `carol|door|${c.data.order}` });
  },
});
