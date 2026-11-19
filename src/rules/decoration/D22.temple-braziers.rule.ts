// D22 · tier 3 · Temple braziers. A temple (R-M01) has a front: one of the
// two ends its pediments face (the south or east one if it has one, the way
// the town is usually seen). On the ground just in front of that end's steps
// stand two braziers, one in front of each outer corner of the front, burning.
//
// Stability: depends on the temple's own pediment features and the ground
// in front of them.
//
// Reads: pediment features (R-M01), terrain heights, clearways. Claims: the
// floor slot of each brazier.

import { DIR4, key, keyX, keyZ, neighbor, opposite, turn, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import type { Feature, StructureId } from '@/resolve/plan';
import { clearways } from './clearways.fact';
import { heightAt } from './lib';

const RULE = 'D22.temple-braziers';

export default defineRule<{ cell: CellKey; dir: Dir4 }>({
  id: RULE,
  part: 'decoration',
  tier: 3,
  priority: 780,
  about: 'Reads: pediment features of temples, terrain heights, clearways. Claims: the floor slot of each brazier.',
  find({ facts, plan }) {
    const clear = clearways(facts);
    const ends = new Map<StructureId, Feature[]>();
    for (const f of plan.features) {
      if (f.type !== 'pediment' || f.cell === undefined || f.dir === undefined) continue;
      if (plan.roles.get(f.structure)?.role !== 'temple') continue;
      const list = ends.get(f.structure) ?? [];
      list.push(f);
      ends.set(f.structure, list);
    }
    const out: Candidate<{ cell: CellKey; dir: Dir4 }>[] = [];
    for (const [id, list] of ends) {
      const front = [...list].sort((a, b) => rank(b.dir as Dir4) - rank(a.dir as Dir4) || (a.cell ?? 0) - (b.cell ?? 0))[0]!;
      const d = front.dir as Dir4;
      // The cells along this end of the temple, at its own level.
      const along = turn(d, 1);
      const row: CellKey[] = [front.cell!];
      for (const side of [along, opposite(along)]) {
        for (let c = neighbor(front.cell!, side); facts.structureAt.get(c) === id; c = neighbor(c, side)) row.push(c);
      }
      row.sort((a, b) => a - b);
      for (const c of [row[0]!, row[row.length - 1]!]) {
        const x = keyX(c) + DIR4[d]![0], z = keyZ(c) + DIR4[d]![1];
        const h = heightAt(facts, x, z);
        if (h <= 0) continue;
        const ground = key(x, h, z);
        // The cell's centre: the temple's steps reach a good way into the cell in front.
        if (!clear.free(ground, 'c') || !clear.headroom(ground, 'c')) continue;
        out.push({ anchor: ground, structure: id, key: 'brazier', data: { cell: ground, dir: d } });
      }
    }
    return out;
  },
  claims: (c) => [slot.floor(c.data.cell, 'c')],
  apply(c, out, ctx) {
    const b = out.prop({ type: 'brazier', at: { cell: c.data.cell, pos: 'c', face: c.data.dir }, params: { look: hash(ctx.seed, RULE, c.anchor) % 1000 } });
    out.socket({ type: 'lamp-head', owner: b, cell: c.data.cell, structure: c.structure });
  },
});

/** South first, then east, then the others: the end the town is usually seen from. */
function rank(d: Dir4): number {
  return d === 2 ? 3 : d === 1 ? 2 : d === 3 ? 1 : 0;
}
