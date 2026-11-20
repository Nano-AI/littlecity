// R-H06 · tier 2 · Inn. An inn stands where travellers arrive (FX-02):
//
//   a candidate is a house of six or more cells, two or more storeys, with a
//   ground-storey facade on a street or a plaza right outside;
//   the places are the town's squares (a plaza holding a 3 × 3: the house
//   faces it right outside, or stands within 2 of it on a street running
//   into it), the ends of its bridges over water and its
//   gates (an arch over a path between solid pieces): the house has a cell
//   within 3 of the place (trade.fact.ts, `arrivals`);
//   each place has one inn: the largest candidate there (most cells, then
//   the lowest id), and a house is the inn of one place at most.
//
// Everything else is a home. So a hill town of 25 houses has an inn on its
// square, not 14; a quay's big houses are warehouses (R-H17) and the harbour
// inn is the one on the harbour square. The answer reads only the places a
// house stands near and the houses near those places: building elsewhere
// never flips it.
//
// An inn sign on a bracket by the door (J06 gives the door a sign-bracket
// socket; D07 hangs the sign), a lantern by the door (R-H99).
import { columnIndex, inColumnBounds, keyX, keyZ } from '@/core/grid';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { facades } from '@/resolve/facts/facades.fact';
import { plazas } from '@/resolve/facts/plazas.fact';
import { structureInfo } from '@/resolve/facts/structure.fact';
import type { StructureId } from '@/resolve/plan';
import { houseStructures } from '../joinery/houses.lib';
import { ARRIVAL_REACH, arrivals } from './trade.fact';

export default defineRule({
  id: 'R-H06.inn',
  part: 'roles',
  tier: 2,
  priority: 9940,
  about: 'Reads: structureInfo (cells, storeys), facades (street or plaza right outside), plazas (squares), arrivals (squares, bridge ends, gates). Claims: the role; one inn per place, the largest house there.',
  find(ctx) {
    const info = structureInfo(ctx.facts);
    const all = facades(ctx.facts);
    const squares = plazas(ctx.facts);
    const places = arrivals(ctx.facts);
    if (places.length === 0) return [];
    // The places each column is near, worked out once from the places: a square's cells and the columns
    // within 2 of them (a house facing a square stands within 1), a bridge end or gate and the columns
    // within ARRIVAL_REACH of it.
    const nearPlace = new Map<number, Set<string>>();
    const mark = (x0: number, z0: number, r: number, k: string): void => {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          const x = x0 + dx, z = z0 + dz;
          if (!inColumnBounds(x, z)) continue;
          const col = columnIndex(x, z);
          let set = nearPlace.get(col);
          if (!set) nearPlace.set(col, (set = new Set()));
          set.add(k);
        }
      }
    };
    for (const place of places) {
      if (place.kind === 'square') for (const c of squares.byId.get(place.plaza!)?.cells ?? []) mark(keyX(c), keyZ(c), 2, place.key);
      else mark(place.x!, place.z!, ARRIVAL_REACH, place.key);
    }
    // Candidates, with the places each one stands at.
    const at = new Map<string, StructureId[]>();
    const size = new Map<StructureId, number>();
    const anchor = new Map<StructureId, number>();
    for (const s of houseStructures(ctx)) {
      const i = info.get(s.id);
      if (!i || s.cells.length < 6 || i.storeys < 2 || ctx.plan.roles.has(s.id)) continue;
      const here = new Set<string>();
      for (const c of s.cells) for (const k of nearPlace.get(columnIndex(keyX(c), keyZ(c))) ?? []) here.add(k);
      if (here.size === 0) continue;
      if (!(all.byStructure.get(s.id) ?? []).some((f) => f.storey === 1 && f.drop === 0 && !f.touching && (f.street === 1 || f.plaza === 1))) continue;
      for (const k of here) {
        const list = at.get(k) ?? [];
        list.push(s.id);
        at.set(k, list);
      }
      size.set(s.id, s.cells.length);
      anchor.set(s.id, s.cells[0]!);
    }
    // One inn per place: the largest, then the lowest id; a house wins one place at most (places in order).
    const taken = new Set<StructureId>();
    const out: Candidate[] = [];
    for (const place of places) {
      const best = (at.get(place.key) ?? [])
        .filter((id) => !taken.has(id))
        .sort((a, b) => size.get(b)! - size.get(a)! || a - b)[0];
      if (best === undefined) continue;
      taken.add(best);
      out.push({ anchor: anchor.get(best)!, structure: best });
    }
    return out.sort((a, b) => a.anchor - b.anchor);
  },
  apply(c, out) {
    out.role(c.structure!, 'inn');
  },
});
