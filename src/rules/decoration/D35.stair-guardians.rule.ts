// D35 · tier 3 · Guardians at the head of the stair (discovery round 1, DC-03).
//
// Monumental stairs are flanked. A flight of grand steps (R-M04) three or
// more wide gets a pair of guardians at its head, on the landing just above
// the two outer top steps, looking down the stair: stone lions, or urns (a
// seeded choice per flight). At its foot, a pair of tall lamps on the ground
// just beyond the two outer bottom steps.
// Must not: a flight narrower than three (the explorer's rule: it would be
// all lion and no stair); a landing that is not standable or not free (a
// battlement, a door, a stair head: the clearways say); the walking line of
// the stair (the guardians and lamps stand in the outer corners).
//
// Stability: the choice is seeded by the flight's first step.
//
// Reads: flights (broad-steps features), clearways. Claims: the corner slot
// of each guardian and lamp.

import { neighbor, NO_CELL, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { standable } from '@/resolve/facts/lib';
import type { CellPos } from '@/resolve/plan';
import { clearways, cornerPos } from './clearways.fact';
import { flights } from './flights.fact';

const RULE = 'D35.stair-guardians';

interface Piece {
  type: 'guardian' | 'lamp';
  cell: CellKey;
  pos: CellPos;
  face: Dir4;
  mirror: 0 | 1;
}

export default defineRule<{ pieces: Piece[]; urn: boolean }>({
  id: RULE,
  part: 'decoration',
  tier: 3,
  priority: 650,
  about: 'Reads: flights of grand steps 3+ wide, clearways. Claims: the outer corner slot of each guardian at the head and each lamp at the foot.',
  find({ facts, seed }) {
    const clear = clearways(facts);
    const out: Candidate<{ pieces: Piece[]; urn: boolean }>[] = [];
    for (const f of flights(facts).list) {
      if (f.width < 3 || f.top.length < 3) continue;
      const down = f.dir, up = opposite(down);
      const pieces: Piece[] = [];
      // The two ends of a row, with the side each is on (outward, across the flight).
      const ends = (row: readonly CellKey[]): [CellKey, Dir4][] => {
        const left = ((down + 1) % 4) as Dir4, right = ((down + 3) % 4) as Dir4;
        // Rows are ordered by ascending x (or z); work out which side the first one is on.
        const first = row[0]!, second = row[1]!;
        const firstSide = neighbor(first, left) === second ? right : left;
        return [[first, firstSide], [row[row.length - 1]!, opposite(firstSide)]];
      };
      ends(f.top).forEach(([t, side], i) => {
        // The landing above the top step: the first standable cell over the column uphill of it (level
        // with the top step, or a step above it).
        const n = neighbor(t, up);
        if (n === NO_CELL) return;
        const landing = [n + (1 << 12), n + (2 << 12)].find((c) => standable(facts, c));
        if (landing === undefined) return;
        const pos = cornerPos(down, side);
        if (clear.free(landing, pos)) pieces.push({ type: 'guardian', cell: landing, pos, face: down, mirror: i as 0 | 1 });
      });
      ends(f.bottom).forEach(([b, side], i) => {
        const foot = neighbor(b, down);
        if (foot === NO_CELL) return;
        const pos = cornerPos(up, side);
        if (clear.free(foot, pos) && clear.headroom(foot, pos)) pieces.push({ type: 'lamp', cell: foot, pos, face: down, mirror: i as 0 | 1 });
      });
      if (pieces.length) out.push({ anchor: f.cells[0]!, data: { pieces, urn: hash(seed, RULE, 'urn', f.cells[0]!) % 3 === 0 } });
    }
    return out;
  },
  claims: (c) => c.data.pieces.map((p) => slot.floor(p.cell, p.pos)),
  apply(c, out, { rand }) {
    for (const p of c.data.pieces) {
      if (p.type === 'guardian') {
        out.prop({ type: 'guardian', variant: c.data.urn ? 'urn' : 'lion', at: { cell: p.cell, pos: p.pos, face: p.face }, params: { mirror: p.mirror, look: Math.floor(rand('look', p.cell) * 1000) } });
      } else {
        const lamp = out.prop({ type: 'lamp', variant: 'post', at: { cell: p.cell, pos: p.pos }, params: { look: Math.floor(rand('lamp', p.cell) * 1000) } });
        out.socket({ type: 'lamp-head', owner: lamp, cell: p.cell });
      }
    }
  },
});
