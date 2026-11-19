// L28 · tier 3 · Children. 15% of residents are small and run (L21 rolls
// who; the crowd makes them quick). When windy they fly kites from the
// viewpoint or a square; they chase pigeons.
//
// This rule marks where they play with `haunt-play` sockets, which only
// children choose:
//
//   name 'kite'     one cell of every square (a plaza holding a 3 × 3) and
//                   every viewpoint. A child there flies a kite while the
//                   wind is up, and just stands about when it drops.
//   name 'pigeons'  the cell of every pigeon (L12's actors). A child runs
//                   there and on to the next; the `personPassed` event the
//                   crowd emits as they arrive is what sends the birds up.

import type { CellKey } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { plazas } from '@/resolve/facts/plazas.fact';
import { viewpoints } from './L22.day-plans.rule';
import { navOf } from './people.lib';

type Data = { name: 'kite' | 'pigeons' };

export default defineRule<Data>({
  id: 'L28.children',
  part: 'life',
  tier: 3,
  priority: 720,
  about: 'Reads: plazas with a 3 × 3 square, viewpoints, pigeon actors, the walking graph. Emits: haunt-play sockets for kites and for chasing pigeons.',
  find(ctx) {
    const nav = navOf(ctx);
    if (!nav) return [];
    const out: Candidate<Data>[] = [];
    const taken = new Set<CellKey>();
    const add = (cell: CellKey, name: Data['name']): void => {
      if (!nav.nodeAt.has(cell) || taken.has(cell)) return;
      taken.add(cell);
      out.push({ anchor: cell, key: name, data: { name } });
    };
    for (const p of plazas(ctx.facts).list) {
      if (!p.square) continue;
      // An open cell of the square: not on its rim, nothing standing in it.
      const rim = new Set(p.edgeCells);
      const inner = p.cells.filter((c) => !rim.has(c) && nav.nodeAt.has(c) && !ctx.facts.kinds.has(c));
      const cells = (inner.length > 0 ? inner : p.cells.filter((c) => nav.nodeAt.has(c))).sort((a, b) => hash(ctx.seed, 'kite', a) - hash(ctx.seed, 'kite', b) || a - b);
      if (cells[0] !== undefined) add(cells[0], 'kite');
    }
    for (const v of viewpoints(ctx, nav)) add(v.cell, 'kite');
    for (const a of ctx.dressing?.actors ?? []) {
      if (a.type === 'pigeon' && a.at && 'cell' in a.at) add(a.at.cell, 'pigeons');
    }
    return out;
  },
  apply(c, out) {
    out.socket({ type: 'haunt-play', cell: c.anchor, name: c.data.name });
  },
});
