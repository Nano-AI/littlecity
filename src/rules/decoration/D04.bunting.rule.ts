// D04 · tier 2 · Bunting.
//
//   Across a street: a straight street segment of three cells or more with
//   buildings hard against it on both sides that are two storeys or more.
//   Half of such segments (DRESSING.bunting, rolled once for the segment's
//   first cell) are hung with strings of little flags from wall to wall at
//   the upper storey, on every second cell.
//
//   Round a square that has a market stall on it: always, from lamp to lamp
//   along its sides (between the heads of D02's corner lamps), with small
//   bulbs between the flags that glow at night (L10).
//
// A string across a street takes the air between its two walls, so D05
// (laundry) never hangs a line through it; laundry never crosses a plaza.
//
// Reads: streets (segments), occupancy, plazas, the lamps D02 placed.
// Claims: the air between the two wall faces, or the line between two lamps.

import { key, keyX, keyY, keyZ, neighbor, NO_CELL, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { occupancy } from '@/resolve/facts/occupancy.fact';
import { plazas } from '@/resolve/facts/plazas.fact';
import { streets } from '@/resolve/facts/streets.fact';
import type { Slot } from '@/resolve/plan';
import { DRESSING } from '@/style/dressing';
import { airSlot } from './D05.laundry-line.rule';
import { lucky, onGround } from './lib';

const RULE = 'D04.bunting';
const LEVEL = 1 << 12;

type Bunting = { kind: 'street'; from: CellKey; to: CellKey; dir: Dir4; claim: Slot } | { kind: 'square'; a: string; b: string; claim: Slot };

export default defineRule<Bunting>({
  id: RULE,
  part: 'decoration',
  tier: 2,
  priority: 960,
  about: 'Reads: streets (straight segments), occupancy (houses on both sides at storey 2), plazas with a stall, D02’s lamps. Claims: the air between two wall faces, or the line between two lamp heads.',
  find({ facts, seed, dressing }) {
    const out: Candidate<Bunting>[] = [];
    const occ = occupancy(facts);
    const house = (c: CellKey): boolean => c !== NO_CELL && occ.kindAt(c) === 'house';
    for (const street of streets(facts).list) {
      for (const seg of street.segments) {
        if (seg.length < 3 || !lucky(seed, RULE, seg.cells[0]!, seg.axis, DRESSING.bunting)) continue;
        // The street runs along x: its walls are north and south. Along z: west and east.
        const [a, b]: [Dir4, Dir4] = seg.axis === 'x' ? [0, 2] : [3, 1];
        for (const c of seg.cells) {
          if (!onGround(facts, c)) continue;
          const along = seg.axis === 'x' ? keyX(c) : keyZ(c);
          if (along % 2 !== 0) continue;
          const wa = neighbor(c, a), wb = neighbor(c, b);
          if (wa === NO_CELL || wb === NO_CELL) continue;
          // Two storeys on both sides, and the string hangs from the upper one.
          if (!house(wa) || !house(wb) || !house(wa + LEVEL) || !house(wb + LEVEL) || occ.kind[c + LEVEL]) continue;
          out.push({ anchor: c, key: seg.axis, data: { kind: 'street', from: wa + LEVEL, to: wb + LEVEL, dir: b, claim: airSlot(wa + LEVEL, b) } });
        }
      }
    }
    // Squares with a stall: from corner lamp to corner lamp.
    const lamps = (dressing?.props ?? []).filter((p) => p.rule === 'D02.square-lamps' && p.variant === 'post' && 'cell' in p.at);
    for (const plaza of plazas(facts).list) {
      if (!plaza.square || !plaza.cells.some((c) => facts.kinds.get(c) === 'stall')) continue;
      const inside = new Set(plaza.cells);
      const mine = lamps.filter((p) => 'cell' in p.at && inside.has(p.at.cell)).map((p) => ({ id: p.id, cell: (p.at as { cell: CellKey }).cell }));
      for (const p of mine) {
        for (const q of mine) {
          if (p.cell >= q.cell || keyY(p.cell) !== keyY(q.cell)) continue;
          const sameRow = keyZ(p.cell) === keyZ(q.cell), sameCol = keyX(p.cell) === keyX(q.cell);
          if (sameRow === sameCol) continue;
          const gap = sameRow ? keyX(q.cell) - keyX(p.cell) : keyZ(q.cell) - keyZ(p.cell);
          if (gap < 2 || gap > 7) continue;
          // Along an edge of the square: every cell between them is plaza, with open ground on one side.
          let edge = true;
          for (let k = 1; k < gap; k++) {
            const c = sameRow ? key(keyX(p.cell) + k, keyY(p.cell), keyZ(p.cell)) : key(keyX(p.cell), keyY(p.cell), keyZ(p.cell) + k);
            if (!inside.has(c) || mine.some((m) => m.cell === c)) edge = false;
          }
          if (!edge) continue;
          const sa = `${p.id}/lamp-head`, sb = `${q.id}/lamp-head`;
          out.push({ anchor: p.cell, key: `sq${q.cell}`, data: { kind: 'square', a: sa, b: sb, claim: slot.line(sa, sb) } });
        }
      }
    }
    return out;
  },
  claims: (c) => [c.data.claim],
  apply(c, out, ctx) {
    const look = hash(ctx.seed, RULE, 'look') % 1000; // one set of colours for the whole town's bunting
    const d = c.data;
    if (d.kind === 'street') {
      const from = out.socket({ type: 'line-anchor', cell: d.from, dir: d.dir, structure: ctx.plan.structureAt.get(d.from) });
      const to = out.socket({ type: 'line-anchor', cell: d.to, dir: opposite(d.dir), structure: ctx.plan.structureAt.get(d.to) });
      // Hung a little above the middle of the storey, wall to wall.
      out.prop({ type: 'bunting', at: { from, to }, params: { look, drop: -0.18 } });
    } else {
      // L10: a square's strings carry small bulbs, which glow softly at night.
      out.prop({ type: 'bunting', at: { from: d.a, to: d.b }, params: { look, drop: 0.03, bulbs: 1 } });
    }
  },
});
