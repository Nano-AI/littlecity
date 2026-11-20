// R-H18 · tier 2 · Barn (RC-09, and FX-06: a barn is never a manor). A
// long low building out by the fields:
//
//   a house of exactly one storey with a footprint of 6 or more cells, the
//   longer side at least 3;
//   no ground-storey facade faces a street or a plaza right outside (it
//   stands in its yard, off the road);
//   a garden region of 6 or more cells (a field, a wheat field, a kitchen
//   garden) has a cell within 4 of it;
//   no plaza that holds a 3 × 3 (a square) within 6.
//
// Not: a house on a street or a square (a hall, a manor or a home), a
// house of two storeys (the farmhouse itself), a house with a steeple.
//
// Draws: weatherboarded timber walls (tag 'barn'), a steep gable roof with
// no chimney and no dormers (J04, J10, J11), wide double doors on its long
// side and a hayloft door in a gable (J30), sparse small windows (J09). If a
// cottage (or a mill house) stands within 4, the pair is a farmstead (tag
// 'farmstead'): hay bales and a cart in the yard (R-H98).

import { keyX, keyZ } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { facades } from '@/resolve/facts/facades.fact';
import { gardens } from '@/resolve/facts/gardens.fact';
import { plazas } from '@/resolve/facts/plazas.fact';
import { structureInfo } from '@/resolve/facts/structure.fact';
import { houseStructures } from '../joinery/houses.lib';

const FIELD_REACH = 4;
const SQUARE_REACH = 6;

export default defineRule<{ farm: boolean }>({
  id: 'R-H18.barn',
  part: 'roles',
  tier: 2,
  priority: 9915,
  about: 'Reads: structureInfo (storeys, footprint, box), facades (street or plaza right outside), gardens (6+ cells within 4), plazas (squares within 6), houses within 4. Claims: the role; tags barn and farmstead.',
  find(ctx) {
    const info = structureInfo(ctx.facts);
    const all = facades(ctx.facts);
    const fields = gardens(ctx.facts).list.filter((g) => g.cells.length >= 6);
    const squares = plazas(ctx.facts).list.filter((p) => p.square);
    if (fields.length === 0) return [];
    const near = (cells: readonly number[], others: readonly number[], r: number): boolean =>
      cells.some((c) => others.some((o) => Math.max(Math.abs(keyX(c) - keyX(o)), Math.abs(keyZ(c) - keyZ(o))) <= r));
    const houses = houseStructures(ctx);
    const out = [];
    for (const s of houses) {
      const i = info.get(s.id);
      if (!i || i.storeys !== 1 || i.footprint < 6 || ctx.plan.roles.has(s.id)) continue;
      if (Math.max(i.box.x1 - i.box.x0, i.box.z1 - i.box.z0) + 1 < 3) continue;
      if ((all.byStructure.get(s.id) ?? []).some((f) => f.storey === 1 && (f.street === 1 || f.plaza === 1))) continue;
      if (!fields.some((g) => near(s.cells, g.cells, FIELD_REACH))) continue;
      if (squares.some((p) => near(s.cells, p.cells, SQUARE_REACH))) continue;
      // A farmhouse beside it: any other house within 4 that is not itself a barn candidate's size.
      const farm = houses.some((o) => o.id !== s.id && (info.get(o.id)?.footprint ?? 0) < 6 && near(s.cells, o.cells, FIELD_REACH));
      out.push({ anchor: s.cells[0]!, structure: s.id, data: { farm } });
    }
    return out;
  },
  apply(c, out) {
    out.role(c.structure!, 'barn');
    out.tag(c.structure!, 'barn');
    if (c.data.farm) out.tag(c.structure!, 'farmstead');
  },
});
