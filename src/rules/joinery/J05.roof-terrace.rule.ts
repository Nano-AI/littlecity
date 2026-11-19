// J05 · tier 2 · Roof terrace. A roof region of 2+ cells beside a taller part
// of the same house becomes, with p = 0.35, a flat terrace with a parapet.
// The door from the taller part is J07's (it sees a walkable roof outside);
// the parasol and pots are D28's.
//
// Priority 965, not the conventional 950: it has to decide before J04 gives
// the region a pitched roof (J04 leaves alone any region that has a roof).
import { defineRule } from '@/resolve/engine/api';
import { roofRegions, type RoofRegion } from '@/resolve/facts/roofs.fact';
import { houseStructures, roleOf } from './houses.lib';

export default defineRule<{ region: RoofRegion }>({
  id: 'J05.roof-terrace',
  part: 'joinery',
  tier: 2,
  priority: 965,
  chance: 0.35,
  about: 'Reads: roofRegions (cells, againstTaller), roles. Emits: a flat roof feature for the region.',
  find(ctx) {
    const regions = roofRegions(ctx.facts);
    const out = [];
    for (const s of houseStructures(ctx)) {
      const role = roleOf(ctx.plan, s.id);
      if (role === 'chapel' || role === 'greenhouse' || role === 'manor') continue;
      for (const region of regions.byStructure.get(s.id) ?? []) {
        if (region.againstTaller.length === 0 || region.cells.length - region.pierced.length < 2) continue;
        out.push({ anchor: region.cells[0]!, structure: s.id, key: region.index, data: { region } });
      }
    }
    return out;
  },
  apply(c, out) {
    out.feature({ type: 'roof', structure: c.structure!, region: c.data.region.index, variant: 'flat' });
  },
});
