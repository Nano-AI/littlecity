// D33 · tier 3 · Hand pump. Town-wide: a town whose streets add up to eight
// cells or more and which has no fountain anywhere draws its water from a
// cast-iron pump over a stone trough, at its busiest junction (the street
// cell with the most branches; ties go to the lowest cell key), on a free
// corner of that cell, its spout toward the street.
//
// Reads: townFacts (street length, fountains), streets (links), clearways.
// Claims: the corner slot.

import { type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, slot } from '@/resolve/engine/api';
import { streets } from '@/resolve/facts/streets.fact';
import { townFacts } from '@/resolve/facts/town.fact';
import type { CellPos } from '@/resolve/plan';
import { clearways, cornerSides } from './clearways.fact';

const CORNERS: readonly CellPos[] = ['sw', 'se', 'nw', 'ne'];

export default defineRule<{ cell: CellKey; pos: CellPos; face: Dir4 }>({
  id: 'D33.hand-pump',
  part: 'decoration',
  tier: 3,
  priority: 670,
  townWide: true,
  about: 'Town-wide. Reads: townFacts (street length, fountains), streets (the cell with most branches), clearways. Claims: a corner slot of the busiest junction.',
  find({ facts }) {
    const town = townFacts(facts);
    if (town.streetLength < 8 || (town.structuresByKind.get('fountain') ?? 0) > 0) return [];
    const clear = clearways(facts);
    let best: { cell: CellKey; links: number } | null = null;
    for (const street of streets(facts).list) {
      for (const c of street.cells) {
        const links = street.links.get(c)?.length ?? 0;
        if (!best || links > best.links || (links === best.links && c < best.cell)) best = { cell: c, links };
      }
    }
    if (!best) return [];
    const at = best.cell;
    // One candidate per free corner, in order; they share a slot, so the first a lamp has not taken wins.
    return CORNERS.filter((p) => clear.free(at, p) && clear.headroom(at, p)).map((pos) => {
      // The spout looks back across the cell: from a south corner north, from a north corner south.
      const [ns] = cornerSides(pos)!;
      return { anchor: at, key: `pump-${pos}`, data: { cell: at, pos, face: (ns === 0 ? 2 : 0) as Dir4 } };
    });
  },
  claims: (c) => [slot.floor(c.data.cell, c.data.pos), slot.custom('D33', 'pump')],
  apply(c, out) {
    out.prop({ type: 'pump', at: { cell: c.data.cell, pos: c.data.pos, face: c.data.face } });
  },
});
