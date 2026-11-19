// D14-T · tier 3 · Roof life: the stork. Town-wide: once the town has
// DEPTH.storkHouses house structures, a stork nests on its tallest chimney
// (the highest 'chimney-top'; ties go to the lowest cell). The nest claims
// the chimney, so it does not smoke (L02 claims chimneys after it).
//
// Reads: townFacts (house count), chimney-top sockets. Claims: the socket.

import { keyY } from '@/core/grid';
import { defineRule, slot } from '@/resolve/engine/api';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';
import { townFacts } from '@/resolve/facts/town.fact';
import { DEPTH } from '@/style/depth';

export default defineRule<{ socket: string }>({
  id: 'D14-T.stork-nest',
  part: 'decoration',
  tier: 3,
  priority: 859,
  townWide: true,
  about: 'Town-wide. Reads: townFacts (house count), chimney-top sockets. Claims: the tallest chimney (so it does not smoke).',
  find({ facts }) {
    if ((townFacts(facts).structuresByKind.get('house') ?? 0) < Math.round(DEPTH.storkHouses)) return [];
    let best: { cell: number; id: string; structure?: number } | null = null;
    for (const s of socketsOfType(facts, 'chimney-top')) {
      if (s.structure === undefined || facts.structures.get(s.structure)?.kind !== 'house') continue;
      if (!best || keyY(s.cell) > keyY(best.cell) || (keyY(s.cell) === keyY(best.cell) && s.cell < best.cell)) best = { cell: s.cell, id: s.id, structure: s.structure };
    }
    return best ? [{ anchor: best.cell, structure: best.structure, key: best.id, data: { socket: best.id } }] : [];
  },
  claims: (c) => [slot.socket(c.data.socket)],
  apply(c, out, ctx) {
    const nest = out.prop({ type: 'stork-nest', at: { socket: c.data.socket }, params: { look: Math.floor(ctx.rand('look') * 1000) } });
    out.socket({ type: 'perch', owner: nest, cell: c.anchor, structure: c.structure });
  },
});
