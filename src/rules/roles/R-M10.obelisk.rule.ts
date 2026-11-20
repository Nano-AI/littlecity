// R-M10 · Obelisk or victory column (RC-08, FX-09). A single column of
// marble, 3 or more tall, standing free on a square:
//
//   a marble structure on one column, 3+ cells tall, nothing on top;
//   its foot stands on plaza, or has plaza on 2 or more sides;
//   no other block touches any of its cells at the side (a 1 × 1 stack
//   against a wall is a pier or a buttress, and stays a terrace).
//
// Not: 1–2 tall (R-M06 plinth, or a terrace).
//
// Draws (the marble generator, by role): a stepped base and a pedestal, then
// by seed a tapering obelisk with a gilt pyramidion, or (4 tall or more,
// p = 0.5, tag 'obelisk:column') a fluted column with a capital and a gilt
// statue on top. Never the four stacked boxes it used to be.

import { above, keyX, keyZ, neighbor, NO_CELL, type Dir4 } from '@/core/grid';
import { rand } from '@/core/rand';
import { defineRule } from '@/resolve/engine/api';
import type { ShapePlan, Structure } from '@/resolve/plan';

export function isObelisk(s: Structure, plan: ShapePlan): boolean {
  if (s.kind !== 'marble' || s.cells.length < 3) return false;
  const x = keyX(s.cells[0]!), z = keyZ(s.cells[0]!);
  if (!s.cells.every((c) => keyX(c) === x && keyZ(c) === z)) return false;
  const top = s.cells[s.cells.length - 1]!;
  if (plan.kinds.has(above(top))) return false;
  for (const c of s.cells) {
    for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
      const n = neighbor(c, d);
      if (n !== NO_CELL && plan.kinds.has(n)) return false;
    }
  }
  const foot = s.cells[0]!;
  if (plan.world.floors.get(foot) === 'plaza') return true;
  let plaza = 0;
  for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
    const n = neighbor(foot, d);
    if (n !== NO_CELL && plan.world.floors.get(n) === 'plaza') plaza++;
  }
  return plaza >= 2;
}

export default defineRule<{ column: boolean }>({
  id: 'R-M10.obelisk',
  part: 'roles',
  tier: 2,
  priority: 5965,
  about: 'Reads: one-column marble structures 3+ tall, nothing on top or beside, on or beside a plaza. Emits: role obelisk; tag obelisk:column (a victory column, 4+ tall, p = 0.5).',
  find({ plan }) {
    const out = [];
    for (const s of plan.structures.values()) {
      if (s.kind !== 'marble' || plan.roles.has(s.id) || !isObelisk(s, plan)) continue;
      out.push({ anchor: s.cells[0]!, structure: s.id, data: { column: s.cells.length >= 4 && rand(s.seed, 'column') < 0.5 } });
    }
    return out;
  },
  apply(c, out) {
    out.role(c.structure!, 'obelisk');
    if (c.data.column) out.tag(c.structure!, 'obelisk:column');
  },
});
