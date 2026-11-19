// L32 · tier 2 · Stranded. A resident whose home links to no floor stays
// within 2 cells of the door: sits on the step, tends a pot.
//
// "Links to no floor": no path, plaza or garden cell can be reached from the
// front door (the walking graph's connected part holds no floor). For each
// such home this rule marks the cells its people may use with `haunt-stoop`
// sockets: the cell at the door (they sit on the step there, facing out) and
// up to three more within two links of it. The crowd keeps a stranded
// household to these.

import { opposite, type CellKey } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { otherEnd } from '@/resolve/nav';
import type { StructureId } from '@/resolve/plan';
import { PEOPLE } from '@/style/people';
import { frontDoor, homes, navOf, toward } from './people.lib';

type Data = { home: StructureId; step: boolean; door: CellKey };
const SPOTS = 3;

export default defineRule<Data>({
  id: 'L32.stranded',
  part: 'life',
  tier: 2,
  priority: 680,
  about: 'Reads: the walking graph (connected parts, floors), front doors. Emits: haunt-stoop sockets within two links of the door of each home that reaches no floor.',
  find(ctx) {
    const nav = navOf(ctx);
    if (!nav) return [];
    const out: Candidate<Data>[] = [];
    for (const s of homes(ctx)) {
      const door = frontDoor(nav, s.id);
      if (!door || nav.partFloors[nav.part[door.node]!]! > 0) continue;
      const doorCell = nav.nodes[door.node]!.cell;
      out.push({ anchor: doorCell, key: `step${s.id}`, structure: s.id, data: { home: s.id, step: true, door: door.cell } });
      // Out to two links from the door, never through a building.
      const depth = new Map<number, number>([[door.node, 0]]);
      const queue = [door.node];
      for (let i = 0; i < queue.length; i++) {
        const n = queue[i]!;
        const d = depth.get(n)!;
        if (d >= PEOPLE.strandedReach) continue;
        for (let k = nav.linkStart[n]!; k < nav.linkStart[n + 1]!; k++) {
          const link = nav.links[nav.linkOf[k]!]!;
          const o = otherEnd(link, n);
          if (link.via === 'interior' || depth.has(o)) continue;
          depth.set(o, d + 1);
          queue.push(o);
        }
      }
      const near = queue
        .slice(1)
        .filter((n) => nav.nodes[n]!.rot === undefined && nav.nodes[n]!.passage === undefined)
        .sort((a, b) => hash(ctx.seed, 'stoop', s.id, nav.nodes[a]!.cell) - hash(ctx.seed, 'stoop', s.id, nav.nodes[b]!.cell))
        .slice(0, SPOTS);
      for (const n of near) out.push({ anchor: nav.nodes[n]!.cell, key: `pot${s.id}`, structure: s.id, data: { home: s.id, step: false, door: door.cell } });
    }
    return out;
  },
  apply(c, out) {
    const { home, step, door } = c.data;
    // On the step they face away from the house; by a pot they face it.
    const face = toward(c.anchor, door);
    out.socket({ type: 'haunt-stoop', cell: c.anchor, dir: step ? opposite(face) : face, structure: home, name: step ? 'step' : 'pot' });
  },
});
