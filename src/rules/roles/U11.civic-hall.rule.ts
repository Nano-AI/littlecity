// U11 · tier 2 · Civic hall. A house with a footprint of DEPTH.hallFootprint
// cells or more whose ground storey looks straight out onto a square (a
// plaza holding a full 3 × 3) is the town hall. It is a role, so it is
// decided before the inn and the shop (priority 9945, between R-H05 and
// R-H06; the manor comes later still, so a big house on a square is a hall).
//
// What a hall looks like is the work of U11-F (joinery): an arcade along its
// ground storey on the square, a balcony over the door, a clock above it,
// and a flag beside the clock (D13). J04 gives it a hip roof and J06 a
// double door; its personality (src/style/houses.ts) tall windows.
//
// One hall per square: where two big houses face one square, the larger
// (then the lower id) is the hall.
//
// Reads: structureInfo (footprint), facades (a plaza right outside the
// ground storey), plazas (square). Claims: the role.

import { neighbor } from '@/core/grid';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { facades } from '@/resolve/facts/facades.fact';
import { plazas } from '@/resolve/facts/plazas.fact';
import { structureInfo } from '@/resolve/facts/structure.fact';
import type { StructureId } from '@/resolve/plan';
import { DEPTH } from '@/style/depth';
import { houseStructures } from '../joinery/houses.lib';

export default defineRule({
  id: 'U11.civic-hall',
  part: 'roles',
  tier: 2,
  priority: 9945,
  about: 'Reads: structureInfo (footprint), facades (plaza right outside the ground storey), plazas (squares). Claims: the role; one hall per square.',
  find(ctx) {
    const info = structureInfo(ctx.facts);
    const all = facades(ctx.facts);
    const squares = plazas(ctx.facts);
    const min = Math.max(1, Math.round(DEPTH.hallFootprint));
    // The best house on each square: the largest footprint, then the lowest id.
    const best = new Map<StructureId, { id: StructureId; anchor: number; size: number }>();
    for (const s of houseStructures(ctx)) {
      const size = info.get(s.id)?.footprint ?? 0;
      if (size < min) continue;
      for (const f of all.byStructure.get(s.id) ?? []) {
        if (f.storey !== 1 || f.plaza !== 1 || f.drop !== 0 || f.touching) continue;
        const p = squares.byCell.get(neighbor(f.cell, f.dir));
        if (!p?.square) continue;
        const now = best.get(p.id);
        if (!now || size > now.size || (size === now.size && s.id < now.id)) best.set(p.id, { id: s.id, anchor: s.cells[0]!, size });
      }
    }
    const out: Candidate[] = [];
    const seen = new Set<StructureId>();
    for (const b of best.values()) {
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      out.push({ anchor: b.anchor, structure: b.id });
    }
    return out;
  },
  apply(c, out) {
    out.role(c.structure!, 'town-hall');
  },
});
