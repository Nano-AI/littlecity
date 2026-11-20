// R-H07 · tier 1 · Shop. Shops gather at the centre and thin out along the
// streets away from it (FX-02):
//
//   a ground-storey facade faces a plaza right outside → a shop (the
//   square is the market);
//   else it faces a street right outside and the house has 2+ storeys → a
//   shop if the house is within 3 steps of a plaza (the high street), and
//   farther out with p falling with the steps: 0.45 within 6, 0.2 within
//   12, and 0.1 farther (or with no plaza at all: a village street still
//   has its baker).
//
// Everything else is a home. The roll is seeded by the house itself (its
// structure seed), so a house keeps its answer while the town grows round
// it, unless a plaza is laid near it. The shop type is a seeded pick; fish
// only within 6 cells of a dock. The role selects the shopfront (J06, J09),
// which owns the awning and sign sockets that D07 dresses.
import { keyX, keyZ } from '@/core/grid';
import { rand } from '@/core/rand';
import type { ShopType } from '@/core/vocab';
import { defineRule } from '@/resolve/engine/api';
import { facades } from '@/resolve/facts/facades.fact';
import { structureInfo } from '@/resolve/facts/structure.fact';
import { distToDock } from '../joinery/houses.fact';
import { houseStructures } from '../joinery/houses.lib';
import { distToPlaza } from './trade.fact';

const TYPES: readonly ShopType[] = ['bakery', 'cafe', 'books', 'flowers', 'fish', 'tailor', 'cheese', 'toys'];

/** The chance that a two-storey house on a street this many steps from a plaza keeps a shop. */
export function streetShopChance(steps: number): number {
  if (steps <= 3) return 1;
  if (steps <= 6) return 0.45;
  if (steps <= 12) return 0.2;
  return 0.1;
}

export default defineRule<{ nearDock: boolean }>({
  id: 'R-H07.shop',
  part: 'roles',
  tier: 1,
  priority: 9930,
  about: 'Reads: facades (street, plaza), structureInfo (storeys), distToPlaza, distToDock. Claims: the role, by a seeded roll that falls with distance from the nearest plaza. Tags shop:<type>.',
  find(ctx) {
    const info = structureInfo(ctx.facts);
    const all = facades(ctx.facts);
    const docks = distToDock(ctx.facts);
    const centre = distToPlaza(ctx.facts);
    const out = [];
    for (const s of houseStructures(ctx)) {
      if (ctx.plan.roles.has(s.id)) continue;
      const storeys = info.get(s.id)?.storeys ?? 1;
      const ground = (all.byStructure.get(s.id) ?? []).filter((f) => f.storey === 1 && f.drop === 0 && !f.touching);
      let p = 0;
      for (const f of ground) {
        if (f.plaza === 1) p = 1;
        else if (f.street === 1 && storeys >= 2) {
          const steps = Math.min(...s.cells.map((c) => centre.at(keyX(c), keyZ(c))));
          p = Math.max(p, streetShopChance(steps));
        }
      }
      if (p === 0 || (p < 1 && rand(s.seed, 'R-H07.shop') >= p)) continue;
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
