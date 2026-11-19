// D08 · tier 2 · Café tables.
//
// A café (a shop tagged 'shop:cafe' by R-H07) with two or more free floor
// cells in front of it sets tables out: up to four, each with a striped
// parasol and two chairs, one to a cell.
//
// "In front" is the paving outside a ground-storey wall of the café that
// faces a street or a square. On a square the terrace is two cells deep and
// a table stands in the middle of its cell; on a street it stands on the far
// kerb of the one cell, so the walking line runs between the café and its
// tables. Never in front of a door, on a
// stair foot or where anything else already stands.
//
// The parasols are the café's awning colour. Each table owns two 'seat'
// sockets.
//
// Reads: tags (shop:cafe), facades, clearways. Claims: the table's floor
// slot, and one table per cell.

import { neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { facades } from '@/resolve/facts/facades.fact';
import type { CellPos } from '@/resolve/plan';
import { clearways, edgePos } from './clearways.fact';

const RULE = 'D08.cafe-tables';
const MAX_TABLES = 4;

export default defineRule<{ pos: CellPos }>({
  id: RULE,
  part: 'decoration',
  tier: 2,
  priority: 920,
  about: 'Reads: shop:cafe tags, facades (street or plaza right outside), clearways. Claims: the floor slot of each table and its cell.',
  find({ facts, plan }) {
    const clear = clearways(facts);
    const all = facades(facts);
    const out: Candidate<{ pos: CellPos }>[] = [];
    for (const [id, tags] of plan.tags) {
      if (!tags.has('shop:cafe')) continue;
      const spots: { cell: CellKey; pos: CellPos }[] = [];
      const seen = new Set<CellKey>();
      for (const fc of all.byStructure.get(id) ?? []) {
        if (fc.storey !== 1 || fc.drop !== 0 || (fc.street !== 1 && fc.plaza !== 1)) continue;
        const first = neighbor(fc.cell, fc.dir);
        if (first === NO_CELL) continue;
        // On a square the terrace is two cells deep; on a street it is the far kerb of the one cell.
        const second = fc.plaza === 1 ? neighbor(first, fc.dir) : NO_CELL;
        for (const cell of [first, second]) {
          if (cell === NO_CELL || seen.has(cell) || clear.doorFronts.has(cell) || clear.stairEnds.has(cell)) continue;
          if (fc.plaza === 1 && facts.world.floors.get(cell) !== 'plaza') continue;
          seen.add(cell);
          const pos: CellPos = fc.plaza === 1 ? 'c' : edgePos(fc.dir as Dir4);
          if (clear.free(cell, pos) && clear.headroom(cell, pos)) spots.push({ cell, pos });
        }
      }
      if (spots.length < 2) continue;
      for (const s of spots.sort((a, b) => a.cell - b.cell).slice(0, MAX_TABLES)) out.push({ anchor: s.cell, structure: id, data: { pos: s.pos } });
    }
    return out;
  },
  claims: (c) => [slot.floor(c.anchor, c.data.pos), slot.custom(RULE, c.anchor)],
  apply(c, out, ctx) {
    const s = c.structure === undefined ? undefined : ctx.plan.structures.get(c.structure);
    const table = out.prop({ type: 'cafe-table', at: { cell: c.anchor, pos: c.data.pos }, params: { color: hash(s?.seed ?? 1, 'awning') % 5, look: hash(ctx.seed, RULE, c.anchor) % 1000 } });
    for (const n of [0, 1]) out.socket({ type: 'seat', owner: table, name: `seat-${n}`, cell: c.anchor });
  },
});
