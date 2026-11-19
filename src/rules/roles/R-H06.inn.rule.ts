// R-H06 · tier 2 · Inn. Six or more cells, two or more storeys, and a
// ground-storey facade on a street or a plaza: an inn sign on a bracket by
// the door (J06 gives the door a sign-bracket socket; D07 hangs the sign).
import { defineRule } from '@/resolve/engine/api';
import { facades } from '@/resolve/facts/facades.fact';
import { structureInfo } from '@/resolve/facts/structure.fact';
import { houseStructures } from '../joinery/houses.lib';

export default defineRule({
  id: 'R-H06.inn',
  part: 'roles',
  tier: 2,
  priority: 9940,
  about: 'Reads: structureInfo (cells, storeys), facades (street or plaza right outside). Claims: the role.',
  find(ctx) {
    const info = structureInfo(ctx.facts);
    const all = facades(ctx.facts);
    return houseStructures(ctx)
      .filter((s) => {
        const i = info.get(s.id);
        if (!i || s.cells.length < 6 || i.storeys < 2) return false;
        return (all.byStructure.get(s.id) ?? []).some((f) => f.storey === 1 && f.drop === 0 && (f.street === 1 || f.plaza === 1));
      })
      .map((s) => ({ anchor: s.cells[0]!, structure: s.id }));
  },
  apply(c, out) {
    out.role(c.structure!, 'inn');
  },
});
