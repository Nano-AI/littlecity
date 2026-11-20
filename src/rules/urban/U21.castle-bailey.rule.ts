// U21 · tier 2 · Castle bailey (discovery round 1, UF-05).
//
// The ground inside a castle's curtain wall is a working yard, not a lawn.
// The landUse fact finds it: a leftover patch of 4 or more cells shut in by
// two or more of a castle's parts (keep, gatehouse, curtain walls, castle
// turrets), one of them a keep or a gatehouse, with no water on its bounds.
// Must not: a garden floor (not bare grass, so never a leftover), a walled
// garden or paddock away from a castle (no keep or gatehouse on its bounds),
// a temple precinct (no curtain wall, gatehouse or turret with its keep).
//
// Dressing: packed earth underfoot; a well near the middle
// ('activity'/'fetch-water'); a lean-to stable against the curtain wall with
// a horse looking out over the half door; hay against the wall; a practice
// dummy and an archery butt in the open.
//
// Stability: seeded by the bailey's own cells.
//
// Reads: landUse.baileys, clearways. Claims: the slots of the well, stable,
// hay, dummy and butt; a 'paving' slot per cell of earth.

import { keyX, keyZ, opposite, type CellKey } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { DIRS } from '@/resolve/facts/lib';
import type { Slot } from '@/resolve/plan';
import { clearways, edgePos } from '../decoration/clearways.fact';
import { landUse } from './land-use.fact';
import { claimsOf, emit, placer, plotOf, sidesWith, type Placed } from './plots';

const RULE = 'U21.castle-bailey';

export default defineRule<{ items: Placed[]; cells: readonly CellKey[] }>({
  id: RULE,
  part: 'urban',
  tier: 2,
  priority: 790,
  about: 'Reads: landUse (baileys: ground shut in by a keep or gatehouse and curtain walls or turrets), clearways. Claims: the slots of its well, stable, hay, dummy and butt; a paving slot per cell.',
  find({ facts, seed }) {
    const clear = clearways(facts);
    const out: Candidate<{ items: Placed[]; cells: readonly CellKey[] }>[] = [];
    for (const bailey of landUse(facts).baileys) {
      const plot = plotOf(facts, bailey.cells, seed);
      const set = new Set(bailey.cells);
      const p = placer((c, pos) => clear.free(c, pos));
      const look = (k: string, c: CellKey): number => hash(seed, RULE, k, c) % 1000;
      for (const c of bailey.cells) {
        let mask = 0;
        for (const d of DIRS) if (plot.beyond(c, d) === 'in' && set.has(c + [-64, 1, 64, -1][d]!)) mask |= 1 << d;
        p.put({ type: 'paving', variant: 'earth', cell: c, pos: 'nw', face: 2, claim: false, params: { mask } });
      }
      // The well, nearest the middle.
      const mx = bailey.cells.reduce((a, c) => a + keyX(c), 0) / bailey.cells.length;
      const mz = bailey.cells.reduce((a, c) => a + keyZ(c), 0) / bailey.cells.length;
      const byMiddle = [...bailey.cells].sort((a, b) => Math.hypot(keyX(a) - mx, keyZ(a) - mz) - Math.hypot(keyX(b) - mx, keyZ(b) - mz) || a - b);
      for (const c of byMiddle) if (p.put({ type: 'well', cell: c, pos: 'c', activities: ['fetch-water'], params: { look: look('well', c) } })) break;
      // Against the curtain wall: the stable, then the hay.
      const walled: [CellKey, number][] = [];
      for (const c of plot.shuffled('wall')) {
        const d = sidesWith(plot, c, 'fence')[0] ?? sidesWith(plot, c, 'wall')[0];
        if (d !== undefined) walled.push([c, d]);
      }
      let stable = false, hay = false;
      for (const [c, d] of walled) {
        const dir = d as 0 | 1 | 2 | 3;
        if (!stable) stable = p.put({ type: 'stable', cell: c, pos: edgePos(dir), face: opposite(dir), params: { look: look('stable', c) } });
        else if (!hay) hay = p.put({ type: 'hay', cell: c, pos: edgePos(dir), face: opposite(dir), params: { look: look('hay', c) } });
        if (stable && hay) break;
      }
      // In the open: the practice dummy and the archery butt, a little apart.
      const open = plot.shuffled('yard').filter((c) => sidesWith(plot, c, 'in').length === 4);
      let dummy = false;
      for (const c of open) {
        if (!dummy) dummy = p.put({ type: 'practice-dummy', cell: c, pos: 'c', params: { look: look('dummy', c) } });
        else if (p.put({ type: 'archery-butt', cell: c, pos: 'c', face: ((hash(seed, RULE, 'butt', c) % 4) as 0 | 1 | 2 | 3) })) break;
      }
      out.push({ anchor: bailey.cells[0]!, data: { items: p.items, cells: bailey.cells } });
    }
    return out;
  },
  claims: (c): Slot[] => [...claimsOf(c.data.items), ...c.data.cells.map((cell) => slot.custom('paving', cell))],
  apply: (c, out) => emit(out, c.data.items),
});
