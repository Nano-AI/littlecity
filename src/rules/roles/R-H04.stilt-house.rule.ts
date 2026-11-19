// R-H04 · tier 1 · Stilt house. Every lowest cell stands over water (on a
// dock or on generated stilts): plank walls, a ladder down to the water and
// a fishing spot on the water side.
import { columnIndex, keyX, keyY, keyZ } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { facades } from '@/resolve/facts/facades.fact';
import { structureInfo } from '@/resolve/facts/structure.fact';
import { houseStructures } from '../joinery/houses.lib';

export default defineRule({
  id: 'R-H04.stilt-house',
  part: 'roles',
  tier: 1,
  priority: 9960,
  about: 'Reads: terrain under the lowest cells, facades (water side). Emits: role, plank-walls, a ladder, a fishing-spot socket.',
  find(ctx) {
    const info = structureInfo(ctx.facts);
    return houseStructures(ctx)
      .filter((s) => {
        const minY = info.get(s.id)?.minY ?? 0;
        return s.cells.filter((c) => keyY(c) === minY).every((c) => ctx.facts.terrain.height[columnIndex(keyX(c), keyZ(c))] === 0);
      })
      .map((s) => ({ anchor: s.cells[0]!, structure: s.id }));
  },
  apply(c, out, ctx) {
    const s = c.structure!;
    out.role(s, 'stilt-house');
    out.tag(s, 'plank-walls');
    out.tag(s, 'over-water');
    // The ladder and the fishing spot go on ground-storey sides that look straight onto open water.
    const sides = (facades(ctx.facts).byStructure.get(s) ?? []).filter((f) => f.storey === 1 && f.water === 1 && !f.touching);
    if (sides.length === 0) return;
    const order = [...sides].sort((a, b) => ctx.rand('side', a.cell, a.dir) - ctx.rand('side', b.cell, b.dir));
    const ladder = order[0]!;
    out.feature({ type: 'ladder', structure: s, cell: ladder.cell, dir: ladder.dir, params: { length: Math.max(1, keyY(ladder.cell)) } });
    const spot = order.find((f) => f.cell !== ladder.cell || f.dir !== ladder.dir) ?? ladder;
    out.socket({ type: 'fishing-spot', structure: s, cell: spot.cell, dir: spot.dir });
  },
});
