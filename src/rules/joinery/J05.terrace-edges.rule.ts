// J05 (seam with J19 and R-E01) · tier 1 · Terrace edges. One barrier per
// side of a roof terrace, never two. Where the player stood a fence or wall
// edge piece on a terrace side, or J19 gave that side a railing, the house
// leaves its own parapet out there and caps the wall with a low coping for
// the railing to stand on. This rule pins that on the house as a `coping`
// feature (the house generator may not read edge pieces or other
// structures' features itself: they are outside its hash).
//
// Priority 805: after J19 (810), whose railings it reads.
import { above, edgeOf, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { roofRegions } from '@/resolve/facts/roofs.fact';
import { houseStructures, roofOf } from './houses.lib';

export default defineRule<{ dir: Dir4 }>({
  id: 'J05.terrace-edges',
  part: 'joinery',
  tier: 1,
  priority: 805,
  about: 'Reads: flat roof regions, edge pieces and railing features on their sides. Emits: a coping feature per terrace side that carries one.',
  find(ctx) {
    const railed = new Set<number>();
    for (const f of ctx.plan.features) if (f.type === 'railing' && f.cell !== undefined && f.dir !== undefined) railed.add(f.cell * 4 + f.dir);
    const out = [];
    for (const s of houseStructures(ctx)) {
      for (const region of roofRegions(ctx.facts).byStructure.get(s.id) ?? []) {
        if (roofOf(ctx.plan, region)?.variant !== 'flat') continue;
        const inRegion = new Set<CellKey>(region.cells);
        for (const cell of region.cells) {
          const up = above(cell);
          if (up === NO_CELL) continue;
          for (let dir = 0 as Dir4; dir < 4; dir = (dir + 1) as Dir4) {
            const n = neighbor(cell, dir);
            if (n !== NO_CELL && inRegion.has(n)) continue;
            const e = edgeOf(up, dir);
            if ((e !== NO_CELL && ctx.facts.world.edges.has(e)) || railed.has(up * 4 + dir)) out.push({ anchor: cell, structure: s.id, key: dir, data: { dir } });
          }
        }
      }
    }
    return out;
  },
  apply(c, out) {
    out.feature({ type: 'coping', structure: c.structure!, cell: c.anchor, dir: c.data.dir });
  },
});
