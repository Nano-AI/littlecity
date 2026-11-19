// L27 · tier 1 · Displaced. If a resident's cell is built over they hop to
// the nearest walkable cell. If their home is erased they walk off the map
// edge of the nearest floor, or fade if there is none. New homes fill by
// residents arriving on foot from the nearest dock or beach.
//
// The hopping, leaving and arriving are the crowd's (src/life/people). This
// rule marks the two kinds of place they need:
//
//   arrival   per home: the dock or beach cell nearest its front door that
//             has a route to it. Newcomers come ashore there and walk home.
//             A home with no route to the water gets none: its people are
//             simply there.
//   way-out   where somebody whose home is gone leaves the town: every dock
//             cell at the water's edge, every beach cell at the water's
//             edge (thinned out), and the dead end of every street.

import { above, columnIndex, keyX, keyZ, type CellKey } from '@/core/grid';
import { hash } from '@/core/rand';
import { MAT } from '@/core/world';
import { defineRule, type Candidate, type RuleContext } from '@/resolve/engine/api';
import { streets } from '@/resolve/facts/streets.fact';
import { waterfront } from '@/resolve/facts/waterfront.fact';
import type { NavGraph, StructureId } from '@/resolve/plan';
import { frontDoor, homes, navOf, steps } from './people.lib';

type Data = { type: 'arrival'; home: StructureId } | { type: 'way-out' };

/** Graph cells at the water's edge where a boat could put somebody ashore: dock decks first, then beach. */
export function landings(ctx: RuleContext, nav: NavGraph): { cell: CellKey; dock: boolean }[] {
  const out: { cell: CellKey; dock: boolean }[] = [];
  for (const cell of waterfront(ctx.facts).cells) {
    const n = nav.nodeAt.get(cell);
    if (n === undefined) continue;
    const surface = nav.nodes[n]!.surface;
    const sand = ctx.facts.terrain.material[columnIndex(keyX(cell), keyZ(cell))] === MAT.sand;
    if (surface === 'deck' || sand || surface === 'sand') out.push({ cell, dock: surface === 'deck' });
  }
  return out;
}

export default defineRule<Data>({
  id: 'L27.displaced',
  part: 'life',
  tier: 1,
  priority: 730,
  about: 'Reads: the walking graph, the waterfront, street dead ends, front doors. Emits: an arrival socket per home that the water can reach; way-out sockets.',
  find(ctx) {
    const nav = navOf(ctx);
    if (!nav) return [];
    const out: Candidate<Data>[] = [];
    const shore = landings(ctx, nav);
    for (const s of homes(ctx)) {
      const door = frontDoor(nav, s.id);
      if (!door) continue;
      const from = nav.nodes[door.node]!.cell;
      let best: CellKey | null = null;
      let bestScore = Infinity;
      for (const l of shore) {
        if (nav.part[nav.nodeAt.get(l.cell)!] !== nav.part[door.node]) continue;
        // A dock is where boats land; a beach will do if it is much nearer.
        const score = steps(from, l.cell) + (l.dock ? 0 : 6);
        if (score < bestScore || (score === bestScore && best !== null && l.cell < best)) {
          bestScore = score;
          best = l.cell;
        }
      }
      if (best !== null) out.push({ anchor: best, key: `home${s.id}`, structure: s.id, data: { type: 'arrival', home: s.id } });
    }
    const outs = new Set<CellKey>();
    for (const l of shore) if (l.dock || hash(ctx.seed, 'way-out', l.cell) % 5 === 0) outs.add(l.cell);
    for (const street of streets(ctx.facts).list) {
      for (const c of street.deadEnds) {
        if (nav.nodeAt.has(c)) outs.add(c);
        else if (nav.nodeAt.has(above(c))) outs.add(above(c));
      }
    }
    for (const cell of [...outs].sort((a, b) => a - b)) out.push({ anchor: cell, key: 'out', data: { type: 'way-out' } });
    return out;
  },
  apply(c, out) {
    if (c.data.type === 'arrival') out.socket({ type: 'arrival', cell: c.anchor, structure: c.data.home });
    else out.socket({ type: 'way-out', cell: c.anchor });
  },
});
