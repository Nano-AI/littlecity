// R-H19 · tier 2 · Smithy (RC-06). A one-storey house with a short tower
// against it is a forge: the tower is its broad chimney.
//
//   a house of one storey and a footprint of 1–3 cells;
//   side by side with a tower 1 or 2 tall (3 or more makes a chapel and its
//   steeple, R-H01, decided first);
//   on land (its ground storey on the ground, not over water or a dock).
//
// The tower takes the role 'forge-chimney' (square, a flat sooty top with
// a 'chimney-top' socket, so it smokes: J13, L02). The house gets an open
// forge front with a glowing hearth on a free ground-storey wall that is
// not its door's (J30, 'forge-front'), and outside it an anvil on its
// block, a quench barrel and a hitching rail with a trough (R-H98).
//
// Priority 9925: after the shop and inn (a one-storey house is neither),
// before the townhouse and cottage.

import { columnIndex, keyX, keyY, keyZ } from '@/core/grid';
import { defineRule, slot } from '@/resolve/engine/api';
import { structureInfo } from '@/resolve/facts/structure.fact';
import { houseStructures } from '../joinery/houses.lib';

export default defineRule<{ tower: number }>({
  id: 'R-H19.smithy',
  part: 'roles',
  tier: 2,
  priority: 9925,
  about: 'Reads: structureInfo (storeys, footprint, touches). Claims: the roles of the house and of the short tower beside it.',
  find(ctx) {
    const info = structureInfo(ctx.facts);
    const out = [];
    for (const s of houseStructures(ctx)) {
      const i = info.get(s.id);
      if (!i || i.storeys !== 1 || i.footprint > 3 || ctx.plan.roles.has(s.id)) continue;
      // On the ground: every cell stands on the terrain.
      if (!s.cells.every((c) => keyY(c) === ctx.facts.terrain.height[columnIndex(keyX(c), keyZ(c))])) continue;
      const tower = i.touches.find((t) => t.kind === 'tower' && t.sides.length > 0 && !ctx.plan.roles.has(t.id) && (info.get(t.id)?.storeys ?? 9) <= 2);
      if (tower) out.push({ anchor: s.cells[0]!, structure: s.id, data: { tower: tower.id } });
    }
    return out;
  },
  claims: (c) => [slot.role(c.data.tower)],
  apply(c, out) {
    out.role(c.structure!, 'smithy');
    out.role(c.data.tower, 'forge-chimney');
  },
});
