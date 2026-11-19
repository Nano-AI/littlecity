// U10 · tier 2 · Corners. A house of two storeys or more standing at a street
// corner (a ground-storey cell with a street right outside on two sides that
// meet) gets a round corner turret on that corner: corbelled out from the top
// of the ground storey, climbing every upper storey that is open on both
// streets, and ending in a cone above the eave (feature 'corner-oriel').
// DEPTH.cornerOriel of such houses have one; one per house, on its first
// corner in cell order.
//
// Not built: the corner entrance with a chamfered ground storey (the house
// shell would have to cut its corner). A shop on a corner already has
// shopfronts on both streets (J09 gives one to every ground-storey facade on
// a street).
//
// A shape-stage rule (part 'joinery'), after U09 (a vista on either face of
// that corner cell keeps the corner plain). Stability: depends on the house
// and the cells right outside its corner.
//
// Reads: facades (street right outside, exposed upper walls), structureInfo
// (storeys), vista features. Claims: nothing.

import { above, turn, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { facades } from '@/resolve/facts/facades.fact';
import { structureInfo } from '@/resolve/facts/structure.fact';
import { DEPTH } from '@/style/depth';
import { lucky } from '../decoration/lib';
import { houseStructures } from '../joinery/houses.lib';

const RULE = 'U10.corners';

export default defineRule<{ cell: CellKey; dir: Dir4; storeys: number }>({
  id: RULE,
  part: 'joinery',
  tier: 2,
  priority: 914,
  about: 'Reads: facades (a street right outside two sides that meet; upper walls open on both), structureInfo (storeys), vista features. Emits: a corner-oriel feature on the upper storeys of a corner house.',
  find(ctx) {
    const { facts, plan, seed } = ctx;
    const all = facades(facts);
    const info = structureInfo(facts);
    const out: Candidate<{ cell: CellKey; dir: Dir4; storeys: number }>[] = [];
    for (const s of houseStructures(ctx)) {
      if ((info.get(s.id)?.storeys ?? 1) < 2) continue;
      const role = plan.roles.get(s.id)?.role;
      if (role === 'chapel' || role === 'greenhouse' || role === 'town-hall') continue;
      const vistas = new Set<number>();
      for (const f of plan.featuresByStructure.get(s.id) ?? []) if (f.type === 'vista' && f.cell !== undefined && f.dir !== undefined) vistas.add(f.cell * 4 + f.dir);
      const open = (c: CellKey, d: Dir4): boolean => {
        const f = all.at(c, d);
        return !!f && f.structure === s.id && !f.touching && f.faces !== 'structure';
      };
      let found: { cell: CellKey; dir: Dir4; storeys: number } | null = null;
      for (const f of all.byStructure.get(s.id) ?? []) {
        if (found) break;
        if (f.storey !== 1 || f.street !== 1 || f.drop !== 0 || f.touching) continue;
        const r = turn(f.dir, -1);
        const side = all.at(f.cell, r);
        if (!side || side.street !== 1 || side.drop !== 0 || side.touching) continue;
        let storeys = 0;
        let start: CellKey | null = null;
        for (let c = above(f.cell); facts.structureAt.get(c) === s.id && open(c, f.dir) && open(c, r); c = above(c)) {
          if (vistas.has(c * 4 + f.dir) || vistas.has(c * 4 + r)) break;
          start ??= c;
          storeys++;
        }
        if (start !== null && storeys > 0) found = { cell: start, dir: f.dir, storeys };
      }
      if (found && lucky(seed, RULE, found.cell, found.dir, DEPTH.cornerOriel)) out.push({ anchor: found.cell, structure: s.id, key: found.dir, data: found });
    }
    return out;
  },
  apply(c, out, ctx) {
    const { cell, dir, storeys } = c.data;
    out.feature({ type: 'corner-oriel', structure: c.structure!, cell, dir, params: { storeys, look: Math.floor(ctx.rand('look') * 1000) } });
  },
});
