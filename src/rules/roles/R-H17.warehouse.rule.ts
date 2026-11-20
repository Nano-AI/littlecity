// R-H17 · tier 2 · Warehouse (RC-02). The big buildings on a working
// waterfront are stores, not inns:
//
//   a house of 6 or more cells, 2 or more storeys, a footprint of 2 or more;
//   a ground-storey facade whose cell outside lies within 3 of a dock (the
//   quay across the harbour street) and that looks toward the water (it is
//   met within 3, or the dock is straight ahead); a house on an open coast
//   with no dock is not a store;
//   no ground-storey facade faces a plaza right outside (that is the
//   harbour's inn, R-H06, or a shop, R-H07).
//
// Draws (J30): a column of loading doors up the facade that faces the water,
// one per storey, with a hoist beam, pulley and rope at the eaves above
// them; crates and sacks at the door (R-H98). The loading doors own a
// 'loading-door' socket each and the beam a 'hoist' socket, for whoever
// carries cargo to them; this rule does not.
//
// Priority 9942: after the town hall (9945), before the inn (9940).

import { below, keyX, keyZ, neighbor, NO_CELL } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { facades, type Facade } from '@/resolve/facts/facades.fact';
import type { Facts } from '@/resolve/facts/api';
import { structureInfo } from '@/resolve/facts/structure.fact';
import { distToDock } from '../joinery/houses.fact';
import { houseStructures } from '../joinery/houses.lib';

/** The ground-storey facades of a house that look onto the water by a dock: those with the dock straight ahead first. */
export function waterFacades(facts: Facts, id: number): Facade[] {
  const docks = distToDock(facts);
  const ahead = (f: Facade): boolean => {
    let c = neighbor(f.cell, f.dir);
    for (let k = 0; k < 4 && c !== NO_CELL; k++, c = neighbor(c, f.dir)) if (facts.kinds.get(below(c)) === 'dock' || facts.kinds.get(c) === 'dock') return true;
    return false;
  };
  return (facades(facts).byStructure.get(id) ?? [])
    .filter((f) => {
      if (f.storey !== 1 || f.touching) return false;
      const n = neighbor(f.cell, f.dir);
      if (n === NO_CELL || docks.at(keyX(n), keyZ(n)) > 3) return false;
      return (f.water !== undefined && f.water <= 4) || ahead(f);
    })
    .map((f) => ({ f, a: ahead(f) ? 0 : 1 }))
    .sort((x, y) => x.a - y.a || (x.f.water ?? 9) - (y.f.water ?? 9) || x.f.cell - y.f.cell || x.f.dir - y.f.dir)
    .map((x) => x.f);
}

export default defineRule({
  id: 'R-H17.warehouse',
  part: 'roles',
  tier: 2,
  priority: 9942,
  about: 'Reads: structureInfo (cells, storeys, footprint), facades (plaza right outside, water ahead), distToDock (3 from the cell outside), docks straight ahead. Claims: the role.',
  find(ctx) {
    const info = structureInfo(ctx.facts);
    const all = facades(ctx.facts);
    const out = [];
    for (const s of houseStructures(ctx)) {
      const i = info.get(s.id);
      if (!i || s.cells.length < 6 || i.storeys < 2 || i.footprint < 2 || ctx.plan.roles.has(s.id)) continue;
      if ((all.byStructure.get(s.id) ?? []).some((f) => f.storey === 1 && f.plaza === 1)) continue;
      if (waterFacades(ctx.facts, s.id).length === 0) continue;
      out.push({ anchor: s.cells[0]!, structure: s.id });
    }
    return out;
  },
  apply(c, out) {
    out.role(c.structure!, 'warehouse');
  },
});
