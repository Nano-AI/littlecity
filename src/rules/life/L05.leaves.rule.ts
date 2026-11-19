// L05 · tier 2 · Trees: a leaf falls now and then; petals from fruit trees.
// One 'leaf' actor per tree that has a crown (not a bush), at its cell; the
// behaviour (src/life/small/leaf.behaviour.ts) lets it go from the crown
// every so often and flutters it down with the wind. Swaying is the
// renderer's (baked sway in the trees' meshes).

import { CELL_H } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';

/** How high over its cell each tree's crown is, roughly (world units, one-cell tree). */
const CROWN: Record<string, number> = { 'palm': 1.1, 'willow': 0.75, 'pine': 0.75, 'fruit-tree': 0.6, 'grove-tree': 0.7, 'round-tree': 0.7, 'cypress': 0.85, 'planter-tree': 0.55 };

export default defineRule<{ height: number; petal: boolean }>({
  id: 'L05.leaves',
  part: 'life',
  tier: 2,
  priority: 950,
  about: 'Reads: tree structures and their roles. Emits: one leaf actor per crowned tree (a petal on fruit trees).',
  find({ plan }) {
    const out = [];
    for (const s of plan.structures.values()) {
      if (s.kind !== 'tree' || s.cells.length === 0) continue;
      const role = plan.roles.get(s.id)?.role ?? 'round-tree';
      const crown = CROWN[role];
      if (crown === undefined) continue;
      out.push({ anchor: s.cells[0]!, structure: s.id, data: { height: Math.round((crown + (s.cells.length - 1) * CELL_H * 0.8) * 100) / 100, petal: role === 'fruit-tree' } });
    }
    return out;
  },
  apply(c, out, ctx) {
    out.actor({ type: 'leaf', variant: c.data.petal ? 'petal' : 'leaf', at: { cell: c.anchor, pos: 'c' }, home: c.structure, params: { height: c.data.height, look: Math.floor(ctx.rand('look') * 4) } });
  },
});
