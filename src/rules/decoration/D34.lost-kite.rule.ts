// D34 · tier 3 · Lost kite. Town-wide: in one town in ten (DEPTH.kite, rolled
// on the town's seed alone) a child's kite is caught in the crown of the
// tallest tree, its tail of bows hanging down. The tallest tree is the one
// whose crown reaches highest (its level, then how tall its kind grows);
// ties go to the lowest cell. Bushes are not trees for this.
//
// Reads: tree structures and their roles. Claims: the tree's crown.

import { CELL_H, keyY } from '@/core/grid';
import { rand } from '@/core/rand';
import { defineRule, slot } from '@/resolve/engine/api';
import { DEPTH } from '@/style/depth';

const RULE = 'D34.lost-kite';
/** How high above its cell's floor each kind's crown reaches, roughly. */
const CROWN: Record<string, number> = { pine: 1.35, palm: 1.3, cypress: 1.3, 'grove-tree': 1.1, 'round-tree': 1.05, willow: 1.0, 'fruit-tree': 0.95, 'planter-tree': 0.95 };

export default defineRule<{ cell: number; top: number }>({
  id: RULE,
  part: 'decoration',
  tier: 3,
  priority: 660,
  townWide: true,
  about: 'Town-wide. Reads: trees and their roles (how tall each kind grows). Claims: the crown of the tallest tree.',
  find({ facts, plan, seed }) {
    if (rand(seed, RULE, 'town') >= DEPTH.kite) return [];
    let best: { cell: number; reach: number; top: number } | null = null;
    for (const s of facts.structures.values()) {
      if (s.kind !== 'tree') continue;
      const top = CROWN[plan.roles.get(s.id)?.role ?? ''];
      if (top === undefined) continue;
      let cell = s.cells[0]!;
      for (const c of s.cells) if (keyY(c) > keyY(cell)) cell = c;
      const reach = keyY(cell) * CELL_H + top;
      if (!best || reach > best.reach + 1e-6 || (Math.abs(reach - best.reach) < 1e-6 && cell < best.cell)) best = { cell, reach, top };
    }
    return best ? [{ anchor: best.cell, key: 'kite', data: { cell: best.cell, top: best.top } }] : [];
  },
  claims: (c) => [slot.custom(RULE, 'crown', c.data.cell)],
  apply(c, out, ctx) {
    out.prop({ type: 'kite', at: { cell: c.data.cell, pos: 'c', face: 2 }, params: { top: c.data.top, look: Math.floor(ctx.rand('look') * 1000) } });
  },
});
