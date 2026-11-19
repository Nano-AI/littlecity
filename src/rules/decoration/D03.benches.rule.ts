// D03 · tier 2 · Benches.
//
//   On a square (a plaza holding a full 3 × 3): one bench for about every
//   four cells of its edge, standing at the edge and facing in. Which edge
//   cells is a fixed lattice of the map, so paving one more cell moves no
//   bench. Never on a corner cell (the lamps stand there), never where a
//   street, a door or a stair comes onto the square, never under an awning.
//
//   At a street's dead end that looks out over water or a drop: a bench at
//   the very end, facing the view, for DRESSING.benchView of such ends (the
//   streetEnds fact; D01 stands that end's lamp to one side).
//
// Every bench owns two 'seat' sockets.
//
// Reads: plazas (edge cells), streetEnds, clearways. Claims: the bench's
// floor slot.

import { keyX, keyZ, neighbor, opposite, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { DIRS } from '@/resolve/facts/lib';
import { plazas } from '@/resolve/facts/plazas.fact';
import { clearways, edgePos } from './clearways.fact';
import { onGround } from './lib';
import { streetEnds } from './street-ends.fact';

const RULE = 'D03.benches';

export default defineRule<{ dir: Dir4; face: Dir4; stone: boolean }>({
  id: RULE,
  part: 'decoration',
  tier: 2,
  priority: 970,
  about: 'Reads: plazas (squares, edge cells), streetEnds (dead ends with a view), clearways. Claims: the floor slot of each bench.',
  find({ facts }) {
    const clear = clearways(facts);
    const out: Candidate<{ dir: Dir4; face: Dir4; stone: boolean }>[] = [];
    for (const plaza of plazas(facts).list) {
      if (!plaza.square) continue;
      const inside = new Set(plaza.cells);
      for (const cell of plaza.edgeCells) {
        if ((keyX(cell) + 3 * keyZ(cell)) % 4 !== 1) continue;
        const open = DIRS.filter((d) => !inside.has(neighbor(cell, d)));
        if (open.length !== 1) continue;
        const d = open[0]!;
        const pos = edgePos(d);
        if (!clear.free(cell, pos) || !clear.headroom(cell, pos) || clear.walked(cell, 'c') || clear.doorFronts.has(cell)) continue;
        // A square laid on marble or a roof has stone benches.
        out.push({ anchor: cell, key: d, data: { dir: d, face: opposite(d), stone: !onGround(facts, cell) } });
      }
    }
    for (const [cell, dir] of streetEnds(facts).views) {
      if (clear.free(cell, edgePos(dir))) out.push({ anchor: cell, key: `view${dir}`, data: { dir, face: dir, stone: false } });
    }
    return out;
  },
  claims: (c) => [slot.floor(c.anchor, edgePos(c.data.dir))],
  apply(c, out, ctx) {
    const { dir, face, stone } = c.data;
    const bench = out.prop({ type: 'bench', variant: stone ? 'stone' : 'wood', at: { cell: c.anchor, pos: edgePos(dir), face }, params: { look: hash(ctx.seed, RULE, c.anchor) % 1000 } });
    for (const n of [0, 1]) out.socket({ type: 'seat', owner: bench, name: `seat-${n}`, cell: c.anchor, dir: face });
  },
});
