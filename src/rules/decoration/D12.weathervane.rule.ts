// D12 · tier 2 · Weathervane. A house that rises higher than every other house
// within DEPTH.vaneReach column steps (and has at least one such neighbour:
// a lone cottage is not a landmark) carries a weathervane on the far end of
// its ridge: an arrow, a rooster or a little ship over the arrow, by seed.
//
// The vane is part of the roof, so this is a shape-stage rule (part
// 'joinery') emitting the 'finial/vane' feature the house generator already
// places on a ridge end (R-H14's lookout cottage has one the same way). It
// runs after J04 (the roof) and leaves a house that already has a finial
// (a chapel's cross, a lookout's vane) alone. Gable roofs only: a hip roof's
// ridge has no end to stand on.
//
// Stability: depends on the houses within reach (the box distance between
// two houses), so an edit farther away than that never moves it.
//
// Reads: structureInfo (top level, bounding box), roof regions and roof
// features, finials. Claims: nothing.

import { hash } from '@/core/rand';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { roofRegions } from '@/resolve/facts/roofs.fact';
import { structureInfo } from '@/resolve/facts/structure.fact';
import type { StructureId } from '@/resolve/plan';
import { DEPTH } from '@/style/depth';
import { farGableEnd, houseStructures, roofOf } from '../joinery/houses.lib';

const RULE = 'D12.weathervane';

export default defineRule<{ cell: number; dir: number }>({
  id: RULE,
  part: 'joinery',
  tier: 2,
  priority: 880,
  about: 'Reads: structureInfo (top level, box) of houses within reach, roof regions and roof features, finials. Emits: a finial/vane on the ridge end of a house taller than every house near it.',
  find(ctx) {
    const { facts, plan } = ctx;
    const info = structureInfo(facts);
    const reach = Math.max(1, Math.round(DEPTH.vaneReach));
    const houses = houseStructures(ctx);
    const out: Candidate<{ cell: number; dir: number }>[] = [];
    for (const s of houses) {
      const me = info.get(s.id);
      if (!me) continue;
      let near = 0;
      let tallest = true;
      for (const o of houses) {
        if (o.id === s.id) continue;
        const them = info.get(o.id);
        if (!them) continue;
        const dx = Math.max(0, them.box.x0 - me.box.x1, me.box.x0 - them.box.x1);
        const dz = Math.max(0, them.box.z0 - me.box.z1, me.box.z0 - them.box.z1);
        if (dx + dz > reach) continue;
        near++;
        if (them.maxY >= me.maxY) {
          tallest = false;
          break;
        }
      }
      if (!tallest || near === 0) continue;
      if ((plan.featuresByStructure.get(s.id) ?? []).some((f) => f.type === 'finial')) continue;
      const regions = (roofRegions(facts).byStructure.get(s.id) ?? []).filter((r) => r.level === me.maxY);
      for (const region of regions) {
        const roof = roofOf(plan, region);
        if (!roof || (roof.variant !== 'gable' && roof.variant !== 'stepped-gable')) continue;
        const ridge = (roof.params as { ridge?: 'x' | 'z' } | undefined)?.ridge ?? (region.width >= region.depth ? 'x' : 'z');
        const end = farGableEnd(ctx, s.id, region, ridge);
        if (!end) continue;
        out.push({ anchor: end.cell, structure: s.id as StructureId, data: { cell: end.cell, dir: end.dir } });
        break;
      }
    }
    return out;
  },
  apply(c, out, ctx) {
    const figure = hash(ctx.seed, RULE, c.structure!) % 3;
    out.feature({ type: 'finial', variant: 'vane', structure: c.structure!, cell: c.data.cell, dir: c.data.dir as 0 | 1 | 2 | 3, params: { figure } });
  },
});
