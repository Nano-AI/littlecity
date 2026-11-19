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
// takes it from there. A house with no door still has its people (they light
// its windows); they are placed in its lowest cell and never come out.
//
// L28's share of children is rolled here, because being a child is part of
// who the resident is: never the first of a household.

import { hash, rand } from '@/core/rand';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { PEOPLE } from '@/style/people';
import { frontDoor, homes, navOf } from './people.lib';

type Data = { index: number; socket: string | null };

export default defineRule<Data>({
  id: 'L21.population',
  part: 'life',
  tier: 1,
  priority: 790,
  about: 'Reads: house structures in seq order, the walking graph (front doors). Emits: resident actors, ceil(cells ÷ 2) a house, up to the cap.',
  find(ctx) {
    const nav = navOf(ctx);
    const out: Candidate<Data>[] = [];
    for (const s of homes(ctx)) {
      const want = Math.ceil(s.cells.length / Math.max(1, PEOPLE.cellsPerResident));
      const door = frontDoor(nav, s.id);
      const socket = door?.socket ?? ctx.plan.sockets.find((k) => k.type === 'door' && k.structure === s.id)?.id ?? null;
      for (let index = 0; index < want && out.length < PEOPLE.cap; index++) {
        out.push({ anchor: door?.cell ?? s.cells[0]!, structure: s.id, key: `${s.id}.${index}`, data: { index, socket } });
      }
      if (out.length >= PEOPLE.cap) break;
    }
    return out;
  },
  apply(c, out, ctx) {
    const home = c.structure!;
    const { index, socket } = c.data;
    const child = index > 0 && rand(ctx.seed, 'child', home, index) < PEOPLE.children;
    out.actor({
      type: 'resident',
      ...(child ? { variant: 'child' as const } : {}),
      at: socket !== null ? { socket } : { cell: c.anchor, pos: 'c' },
      home,
      params: { index, look: hash(ctx.seed, 'resident', home, index) },
    });
  },
});
