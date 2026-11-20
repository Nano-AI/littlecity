// D32 · tier 3 · Under the trees.
//
//   a swing      on DEPTH.swing of the broad-crowned trees standing in or
//                beside a garden, a park, a courtyard or a back yard: hung
//                from a low branch over the open side of the tree
//   a hammock    between two broad-crowned trees two cells apart with an
//                empty cell between them, DEPTH.hammock of such pairs
//   a picnic     a blanket and a basket on the grass of DEPTH.picnic of the
//                parks (a park lawn, or a field with trees in it)
//
// Palms, pines, cypresses and bushes carry neither swing nor hammock. None
// of these stands on a walking line.
//
// Stability: each roll is seeded by the tree's (or the pair's west or north
// tree's, or the park's first) cell.
//
// Reads: tree structures and their roles, gardens and their roles, landUse,
// clearways. Claims: the slot each stands on.

import { DIR4, key, keyX, keyY, keyZ, neighbor, NO_CELL, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { gardens } from '@/resolve/facts/gardens.fact';
import { DIRS } from '@/resolve/facts/lib';
import type { CellPos } from '@/resolve/plan';
import { DEPTH } from '@/style/depth';
import { landUse } from '../urban/land-use.fact';
import { orchards } from '../urban/orchards.fact';
import { clearways, edgePos } from './clearways.fact';
import { lucky } from './lib';

const RULE = 'D32.under-the-trees';
const BROAD = new Set(['round-tree', 'fruit-tree', 'grove-tree', 'willow']);

interface Thing {
  type: 'swing' | 'hammock' | 'picnic';
  cell: CellKey;
  pos: CellPos;
  face: Dir4;
}

export default defineRule<Thing>({
  id: RULE,
  part: 'decoration',
  tier: 3,
  priority: 680,
  about: 'Reads: trees and their roles, gardens and their roles, landUse (courtyards, yards, parks, fields), clearways. Claims: the slot of each swing, hammock and picnic.',
  find({ facts, plan, seed }) {
    const clear = clearways(facts);
    const uses = landUse(facts);
    const out: Candidate<Thing>[] = [];
    const broad = new Set<CellKey>();
    for (const s of facts.structures.values()) {
      if (s.kind !== 'tree' || !BROAD.has(plan.roles.get(s.id)?.role ?? '')) continue;
      // A tree's lowest cell is the one standing on the ground.
      let foot = s.cells[0]!;
      for (const c of s.cells) if (keyY(c) < keyY(foot)) foot = c;
      broad.add(foot);
    }
    const planted = orchards(facts);
    const homely = (c: CellKey): boolean => {
      if (c === NO_CELL) return false;
      const use = uses.byCell.get(c)?.use;
      return facts.world.floors.get(c) === 'garden' || use === 'courtyard' || use === 'back-yard' || use === 'pocket-park' || use === 'field';
    };
    for (const t of [...broad].sort((a, b) => a - b)) {
      // A swing: over an open side of a tree in or beside somewhere people sit.
      if ((homely(t) || DIRS.some((d) => homely(neighbor(t, d)))) && lucky(seed, RULE, t, 'swing', DEPTH.swing)) {
        const d = DIRS.find((e) => {
          const n = neighbor(t, e);
          return n !== NO_CELL && !facts.kinds.has(n) && !clear.walked(t, edgePos(e)) && clear.free(n, edgePos(opposite(e)));
        });
        if (d !== undefined) out.push({ anchor: t, key: 'swing', data: { type: 'swing', cell: t, pos: 'c', face: d } });
      }
      // A hammock: to a tree two cells east or south, the cell between them empty. Not in an orchard
      // (U18: its rows are worked, with ladders and baskets; a hammock between every pair is a camp).
      for (const d of [1, 2] as Dir4[]) {
        if (planted.byTree.has(t)) break;
        const [dx, dz] = DIR4[d]!;
        const other = key(keyX(t) + 2 * dx, keyY(t), keyZ(t) + 2 * dz);
        const mid = key(keyX(t) + dx, keyY(t), keyZ(t) + dz);
        if (!broad.has(other) || !clear.free(mid, 'c') || clear.walked(mid, edgePos(d)) || clear.walked(mid, edgePos(opposite(d)))) continue;
        if (!lucky(seed, RULE, t, `hammock${d}`, DEPTH.hammock)) continue;
        out.push({ anchor: mid, key: 'hammock', data: { type: 'hammock', cell: mid, pos: 'c', face: d === 1 ? 2 : 1 } });
      }
    }
    // Picnics in parks.
    const parks: (readonly CellKey[])[] = [];
    for (const g of gardens(facts).list) if (plan.roles.get(g.id)?.role === 'park-lawn') parks.push(g.cells);
    for (const f of uses.fields) if (f.kind === 'park') parks.push(f.cells);
    for (const cells of parks) {
      const first = cells[0]!;
      if (!lucky(seed, RULE, first, 'picnic', DEPTH.picnic)) continue;
      const spot = [...cells].sort((a, b) => hash(seed, RULE, 'p', a) - hash(seed, RULE, 'p', b) || a - b).find((c) => clear.free(c, 'c') && !DIRS.some((d) => facts.kinds.has(neighbor(c, d))));
      if (spot !== undefined) out.push({ anchor: spot, key: 'picnic', data: { type: 'picnic', cell: spot, pos: 'c', face: 2 } });
    }
    return out;
  },
  claims: (c) => (c.data.type === 'swing' ? [slot.custom(RULE, 'swing', c.data.cell), slot.floor(neighbor(c.data.cell, c.data.face), edgePos(opposite(c.data.face)))] : [slot.floor(c.data.cell, c.data.pos)]),
  apply(c, out, ctx) {
    const d = c.data;
    const look = Math.floor(ctx.rand('look') * 1000);
    const id = out.prop({ type: d.type, at: { cell: d.cell, pos: d.pos, face: d.face }, params: { look } });
    if (d.type !== 'picnic') out.socket({ type: 'seat', owner: id, name: d.type === 'swing' ? 'seat' : 'seat-0', cell: d.cell, dir: d.face });
  },
});
