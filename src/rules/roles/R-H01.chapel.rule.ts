// R-H01 · tier 1 · Chapel. A house of 2+ cells touching (beside, or directly
// below) a tower at least 3 tall is a chapel, and that tower is its steeple.
// The chapel role selects pointed windows, a rose window, a double door and
// a finial in the joinery rules; the tower's own rules (R-T01) read 'steeple'.
import { defineRule, slot } from '@/resolve/engine/api';
import { structureInfo } from '@/resolve/facts/structure.fact';
import { houseStructures } from '../joinery/houses.lib';

export default defineRule<{ tower: number }>({
  id: 'R-H01.chapel',
  part: 'roles',
  tier: 1,
  priority: 9990,
  about: 'Reads: structureInfo (touches). Claims: the roles of the house and of the tower it pairs with.',
  find(ctx) {
    const info = structureInfo(ctx.facts);
    const out = [];
    for (const s of houseStructures(ctx)) {
      if (s.cells.length < 2) continue;
      const mine = info.get(s.id);
      if (!mine) continue;
      // The tallest touching tower; ties go to the lower id.
      let best: { id: number; storeys: number } | null = null;
      for (const t of mine.touches) {
        if (t.kind !== 'tower' || !(t.sides.length > 0 || t.above)) continue;
        const storeys = info.get(t.id)?.storeys ?? 0;
        if (storeys >= 3 && (!best || storeys > best.storeys)) best = { id: t.id, storeys };
      }
      if (best) out.push({ anchor: s.cells[0]!, structure: s.id, data: { tower: best.id } });
    }
    return out;
  },
  claims: (c) => [slot.role(c.data.tower)],
  apply(c, out) {
    out.role(c.structure!, 'chapel');
    out.role(c.data.tower, 'steeple');
    out.tag(c.structure!, 'has-steeple');
  },
});
