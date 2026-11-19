// R-H07 · tier 1 · Shop. A ground-storey facade faces a plaza right outside;
// or faces a street right outside and the house has 2+ storeys. The shop
// type is a seeded pick; fish only within 6 cells of a dock. The role
// selects the shopfront (J06, J09), which owns the awning and sign sockets
// that D07 dresses.
import { keyX, keyZ } from '@/core/grid';
import type { ShopType } from '@/core/vocab';
import { defineRule } from '@/resolve/engine/api';
import { facades } from '@/resolve/facts/facades.fact';
import { structureInfo } from '@/resolve/facts/structure.fact';
import { distToDock } from '../joinery/houses.fact';
import { houseStructures } from '../joinery/houses.lib';

const TYPES: readonly ShopType[] = ['bakery', 'cafe', 'books', 'flowers', 'fish', 'tailor', 'cheese', 'toys'];

export default defineRule<{ nearDock: boolean }>({
  id: 'R-H07.shop',
  part: 'roles',
  tier: 1,
  priority: 9930,
  about: 'Reads: facades (street, plaza), structureInfo (storeys), distToDock. Claims: the role. Tags shop:<type>.',
  find(ctx) {
    const info = structureInfo(ctx.facts);
    const all = facades(ctx.facts);
    const docks = distToDock(ctx.facts);
    const out = [];
    for (const s of houseStructures(ctx)) {
      const storeys = info.get(s.id)?.storeys ?? 1;
      const ground = (all.byStructure.get(s.id) ?? []).filter((f) => f.storey === 1 && f.drop === 0 && !f.touching);
      if (!ground.some((f) => f.plaza === 1 || (f.street === 1 && storeys >= 2))) continue;
      const nearDock = s.cells.some((c) => docks.at(keyX(c), keyZ(c)) <= 6);
      out.push({ anchor: s.cells[0]!, structure: s.id, data: { nearDock } });
    }
    return out;
  },
  apply(c, out, ctx) {
    out.role(c.structure!, 'shop');
    const types = TYPES.filter((t) => t !== 'fish' || c.data.nearDock);
    // By the water a fish shop is the likeliest of all.
    const type = ctx.pick(types, types.map((t) => (t === 'fish' ? 3 : 1)), 'type');
    out.tag(c.structure!, `shop:${type}`);
  },
});
