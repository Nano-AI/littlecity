// L33 · tier 3 · Cats: one per 5 house structures, at most 6, each on the
// doorstep of a house. Which houses keep a cat is each house's own draw (a
// hash of its main door), not its place in a list, so a cat stays at its
// house whatever is built, wrecked or mended elsewhere in town (taken by
// position in a list, one house more or less anywhere moved every cat in
// town to another doorstep at once). src/life/small/cat.behaviour.ts naps it
// in the sun by day and sits it up to watch the evening.

import type { CellKey } from '@/core/grid';
import { hashString } from '@/core/rand';
import { defineRule } from '@/resolve/engine/api';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';

export const CATS_MAX = 6;

export default defineRule<{ socket: string }>({
  id: 'L33.cats',
  part: 'life',
  tier: 3,
  priority: 670,
  townWide: true,
  about: 'Reads: house door sockets. Emits: a cat on the doorsteps of one house in five (each house’s own draw), at most 6.',
  find({ facts, plan }) {
    const doors = new Map<number, { id: string; cell: CellKey }>();
    for (const s of socketsOfType(facts, 'door')) {
      if (s.structure === undefined || plan.structures.get(s.structure)?.kind !== 'house') continue;
      const had = doors.get(s.structure);
      if (!had || s.cell < had.cell || (s.cell === had.cell && s.id < had.id)) doors.set(s.structure, { id: s.id, cell: s.cell });
    }
    const list = [...doors.values()].map((d) => ({ ...d, draw: hashString(d.id) >>> 0 })).sort((a, b) => a.draw - b.draw || (a.id < b.id ? -1 : 1));
    const n = Math.min(CATS_MAX, Math.floor(list.length / 5));
    return list.slice(0, n).map((d) => ({ anchor: d.cell, key: d.id, data: { socket: d.id } }));
  },
  apply(c, out, ctx) {
    out.actor({ type: 'cat', at: { socket: c.data.socket }, params: { look: Math.floor(ctx.rand('look') * 5) } });
  },
});
