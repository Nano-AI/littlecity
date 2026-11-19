// L21 · tier 1 · Population. Each house structure houses ceil(cells ÷ 2)
// residents, filled in `seq` order (a structure's id is its lowest seq) until
// the town cap is reached. Each resident has a seeded look and a home.
//
// The cap here is the desktop one (PEOPLE.cap, 60). Town logic is pure and
// does not know the device: on a phone-sized viewport the crowd
// (src/life/people) walks only the first PEOPLE.capPhone of them, which is
// again the seq order.
//
// A resident stands at the home's front door socket in the plan; the crowd
// takes it from there.
//
// One reading of the catalogue to know about: a house whose door opens onto
// nothing walkable (over the sea, onto a pitched roof) still has its people,
// who light its windows, but they can never come out, so they do not count
// toward the cap. They are `resident/indoors`: never drawn. Otherwise a town
// whose first houses stand at the water's edge would have a full census and
// empty streets. (They are capped too, at the same number, to bound the plan.)
//
// Ids are stable: a resident is `L21.population@<the cell of the house's
// founding block>:<house id>.<index>`, so a door that moves, or a house that
// grows, never turns its people into strangers.
//
// L28's share of children is rolled here, because being a child is part of
// who the resident is: never the first of a household.

import { hash, rand } from '@/core/rand';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { PEOPLE } from '@/style/people';
import { frontDoor, homes, navOf } from './people.lib';

type Data = { index: number; socket: string | null; indoors: boolean };

export default defineRule<Data>({
  id: 'L21.population',
  part: 'life',
  tier: 1,
  priority: 790,
  about: 'Reads: house structures in seq order, the walking graph (front doors). Emits: resident actors, ceil(cells ÷ 2) a house, up to the cap; resident/indoors for a house nobody can leave.',
  find(ctx) {
    const nav = navOf(ctx);
    const out: Candidate<Data>[] = [];
    let walkers = 0, indoors = 0;
    for (const s of homes(ctx)) {
      const want = Math.ceil(s.cells.length / Math.max(1, PEOPLE.cellsPerResident));
      const door = frontDoor(nav, s.id);
      const socket = door?.socket ?? null;
      // The founding block: the one whose seq is the structure's id.
      const anchor = s.cells.find((c) => ctx.facts.world.blocks.get(c)?.seq === s.id) ?? s.cells[0]!;
      for (let index = 0; index < want; index++) {
        if (door ? walkers >= PEOPLE.cap : indoors >= PEOPLE.cap) break;
        if (door) walkers++;
        else indoors++;
        out.push({ anchor, structure: s.id, key: `${s.id}.${index}`, data: { index, socket, indoors: !door } });
      }
      if (walkers >= PEOPLE.cap) break;
    }
    return out;
  },
  apply(c, out, ctx) {
    const home = c.structure!;
    const { index, socket, indoors } = c.data;
    const child = index > 0 && rand(ctx.seed, 'child', home, index) < PEOPLE.children;
    out.actor({
      type: 'resident',
      ...(indoors ? { variant: 'indoors' as const } : child ? { variant: 'child' as const } : {}),
      at: socket !== null ? { socket } : { cell: c.anchor, pos: 'c' },
      home,
      params: { index, look: hash(ctx.seed, 'resident', home, index) },
    });
  },
});
