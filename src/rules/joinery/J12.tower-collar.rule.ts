// J12 · tier 1 · Tower through roof. A tower (or a lighthouse or pillar)
// rising out of a house roof gets a collar where they meet; the house's roof
// wraps round it. The collar is a feature of the HOUSE (its generator knows
// the roof line) at the tower's lowest cell.
import { above, NO_CELL } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { roofRegions } from '@/resolve/facts/roofs.fact';
import { houseStructures } from './houses.lib';

const SLENDER = new Set(['tower', 'lighthouse', 'pillar']);

export default defineRule({
  id: 'J12.tower-collar',
  part: 'joinery',
  tier: 1,
  priority: 880,
  about: 'Reads: roofRegions (pierced cells), kinds above them. Emits: a collar feature on the house per tower rising through its roof.',
  find(ctx) {
    const regions = roofRegions(ctx.facts);
    const out = [];
    for (const s of houseStructures(ctx)) {
      for (const region of regions.byStructure.get(s.id) ?? []) {
        for (const cell of region.pierced) {
          const up = above(cell);
          if (up === NO_CELL || !SLENDER.has(ctx.facts.kinds.get(up) ?? '')) continue;
          // Only where there is a roof around it for the collar to sit in.
          if (region.cells.length === region.pierced.length) continue;
          out.push({ anchor: up, structure: s.id });
        }
      }
    }
    return out;
  },
  apply(c, out) {
    out.feature({ type: 'collar', structure: c.structure!, cell: c.anchor });
  },
});
