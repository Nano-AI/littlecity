// D27 · tier 3 · Post.
//
//   a mailbox    for DEPTH.mailbox of the houses whose main door opens
//                straight onto a street: on a post beside the door, at the
//                house-side corner of the next street cell along
//   a pillar box one red pillar box on every street of DEPTH.postboxStreet
//                cells or more: at a corner of the cell nearest the street's
//                middle, against a wall if one can be found
//
// Corners of a path cell are never on its walking line (that is where lamps
// stand), so neither blocks the way; a lamp that took the corner first keeps it.
//
// Stability: a mailbox roll is the door's own; the pillar box depends on its
// street's cells.
//
// Reads: main doors, streets, clearways. Claims: the corner slot each stands on.

import { neighbor, NO_CELL, opposite, turn, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { streets } from '@/resolve/facts/streets.fact';
import type { CellPos } from '@/resolve/plan';
import { DEPTH } from '@/style/depth';
import { clearways, cornerPos } from './clearways.fact';
import { lucky } from './lib';

const RULE = 'D27.post';
const CORNERS: readonly CellPos[] = ['ne', 'se', 'sw', 'nw'];

export default defineRule<{ type: 'mailbox' | 'postbox'; cell: CellKey; pos: CellPos; face: Dir4 }>({
  id: RULE,
  part: 'decoration',
  tier: 3,
  priority: 730,
  about: 'Reads: main doors opening onto a street, streets (length, cells), clearways. Claims: the corner slot of each mailbox and pillar box.',
  find({ facts, plan, seed }) {
    const clear = clearways(facts);
    const out: Candidate<{ type: 'mailbox' | 'postbox'; cell: CellKey; pos: CellPos; face: Dir4 }>[] = [];
    for (const f of plan.features) {
      if (f.type !== 'door' || f.cell === undefined || f.dir === undefined || (f.params as { main?: number } | undefined)?.main !== 1) continue;
      if (facts.structures.get(f.structure)?.kind !== 'house') continue;
      const front = neighbor(f.cell, f.dir as Dir4);
      if (front === NO_CELL || facts.world.floors.get(front) !== 'path') continue;
      if (!lucky(seed, RULE, f.cell, 'mailbox', DEPTH.mailbox)) continue;
      // Beside the door: the house-side corner of the next street cell along, nearest the door.
      const d = f.dir as Dir4;
      for (const lateral of [turn(d, 1), turn(d, -1)] as Dir4[]) {
        const n = neighbor(front, lateral);
        if (n === NO_CELL || facts.world.floors.get(n) !== 'path') continue;
        const pos = cornerPos(opposite(d), opposite(lateral));
        if (!clear.free(n, pos) || !clear.headroom(n, pos) || clear.doorFronts.has(n)) continue;
        out.push({ anchor: front, key: `mailbox${d}`, data: { type: 'mailbox', cell: n, pos, face: d } });
        break;
      }
    }
    const min = Math.round(DEPTH.postboxStreet);
    for (const street of streets(facts).list) {
      if (street.length < min) continue;
      const mid = street.cells[Math.floor(street.cells.length / 2)]!;
      const mx = mid & 63, mz = (mid >> 6) & 63;
      const order = [...street.cells].sort((a, b) => Math.abs((a & 63) - mx) + Math.abs(((a >> 6) & 63) - mz) - (Math.abs((b & 63) - mx) + Math.abs(((b >> 6) & 63) - mz)) || a - b);
      let pick: { cell: CellKey; pos: CellPos } | null = null;
      for (const wall of [true, false]) {
        for (const c of order.slice(0, 8)) {
          const pos = CORNERS.find((p) => clear.free(c, p) && clear.headroom(c, p) && (!wall || clear.againstWall(c, p)) && !clear.doorFronts.has(c));
          if (pos) {
            pick = { cell: c, pos };
            break;
          }
        }
        if (pick) break;
      }
      if (pick) out.push({ anchor: street.cells[0]!, key: 'postbox', data: { type: 'postbox', cell: pick.cell, pos: pick.pos, face: 2 } });
    }
    return out;
  },
  claims: (c) => [slot.floor(c.data.cell, c.data.pos)],
  apply(c, out, ctx) {
    const d = c.data;
    if (d.type === 'mailbox') out.prop({ type: 'mailbox', at: { cell: d.cell, pos: d.pos, face: d.face }, params: { look: Math.floor(ctx.rand('look') * 1000) } });
    else out.prop({ type: 'postbox', at: { cell: d.cell, pos: d.pos, face: d.face } });
  },
});
