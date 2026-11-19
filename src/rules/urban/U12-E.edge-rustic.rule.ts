// U12-E · tier 2 · Centre and edge (the edge half; the centre half is
// U12.centre-and-edge). A town is plainer toward its edge. A cottage, row
// house, mill house or lookout cottage of one or two storeys that stands
// more than DEPTH.edgeReach column steps from every floor of the town (path,
// plaza or garden) is rustic: the tag 'rustic', from which the house's
// personality (src/style/houses.ts) picks thatch for a small one
// (DEPTH.rusticThatch) and walls of timber framing, rough stone or boards.
//
// A town with no floors at all has no centre, so it has no edge either:
// nothing is tagged until the first path or square is laid.
//
// Town-wide: the nearest floor may be farther away than an edit's reach.
//
// Reads: distToFloor, structureInfo (storeys), roles. Claims: nothing.

import { keyX, keyZ } from '@/core/grid';
import type { Role } from '@/core/vocab';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { distToFloor, NONE } from '@/resolve/facts/distance.fact';
import { structureInfo } from '@/resolve/facts/structure.fact';
import { DEPTH } from '@/style/depth';
import { houseStructures } from '../joinery/houses.lib';

/** The roles a rustic house can have: the plain ones. */
const PLAIN: ReadonlySet<Role | undefined> = new Set<Role | undefined>([undefined, 'cottage', 'row-house', 'mill-house', 'lookout-cottage']);

export default defineRule({
  id: 'U12-E.edge-rustic',
  part: 'joinery',
  tier: 2,
  priority: 879,
  townWide: true,
  about: 'Town-wide. Reads: distToFloor, structureInfo (storeys), roles. Claims: nothing. Tags plain houses of 1–2 storeys far from every floor rustic.',
  find(ctx) {
    const dist = distToFloor(ctx.facts);
    const info = structureInfo(ctx.facts);
    const reach = Math.max(1, Math.round(DEPTH.edgeReach));
    const out: Candidate[] = [];
    for (const s of houseStructures(ctx)) {
      if ((info.get(s.id)?.storeys ?? 9) > 2 || !PLAIN.has(ctx.plan.roles.get(s.id)?.role)) continue;
      const far = s.cells.every((c) => {
        const d = dist.at(keyX(c), keyZ(c));
        return d !== NONE && d > reach;
      });
      if (far) out.push({ anchor: s.cells[0]!, structure: s.id });
    }
    return out;
  },
  apply(c, out) {
    out.tag(c.structure!, 'rustic');
  },
});
