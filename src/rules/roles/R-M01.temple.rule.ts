// R-M01 · Temple. A marble structure resting on four or more placed pillar
// shafts, each at least 2 tall: a pediment over each short end with a low
// roof between them, a frieze band (the generator, by role), and steps at
// the base of the pillars (a 'stylobate' under each lowest cell).
//
// The pediments need a plain rectangular top at one level; a temple with a
// stepped or L-shaped top still gets the role, the frieze and the steps.

import { above, below, columnIndex, key, keyX, keyY, keyZ, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, type RuleOut } from '@/resolve/engine/api';
import type { ShapePlan, Structure } from '@/resolve/plan';

export function pillarsUnder(s: Structure, plan: ShapePlan): number {
  const shafts = new Set<number>();
  for (const cell of s.cells) {
    const under = below(cell);
    if (under === NO_CELL || plan.kinds.get(under) !== 'pillar') continue;
    const p = plan.structures.get(plan.structureAt.get(under)!);
    if (p && p.cells.length >= 2) shafts.add(p.id);
  }
  return shafts.size;
}

/** Steps under every bottom cell, at the foot of the pillars (or of the support that would stand there). */
export function stylobates(s: Structure, plan: ShapePlan, out: RuleOut): void {
  const lowest = Math.min(...s.cells.map((cell) => keyY(cell)));
  for (const cell of s.cells) {
    if (keyY(cell) !== lowest) continue;
    let depth = 0;
    for (let u = below(cell); u !== NO_CELL; u = below(u)) {
      const kind = plan.kinds.get(u);
      const ground = plan.terrain.height[columnIndex(keyX(u), keyZ(u))]!;
      if (keyY(u) < ground || (kind !== undefined && kind !== 'pillar')) break;
      depth++;
    }
    if (depth > 0) out.feature({ type: 'stylobate', structure: s.id, cell, params: { depth } });
  }
}

export default defineRule({
  id: 'R-M01.temple',
  part: 'roles',
  tier: 2,
  priority: 5990,
  about:
    'Reads: marble structures with no role standing on 4+ pillar structures of 2+ cells. Emits: role temple; a pediment at each short end of a rectangular top; a stylobate under each cell that stands on a pillar or over open ground.',
  find({ plan }) {
    const out = [];
    for (const s of plan.structures.values()) {
      if (s.kind === 'marble' && pillarsUnder(s, plan) >= 4) out.push({ anchor: s.cells[0]!, structure: s.id });
    }
    return out;
  },
  apply(c, out, { plan }) {
    const s = plan.structures.get(c.structure!)!;
    out.role(s.id, 'temple');
    const mine = new Set(s.cells);
    stylobates(s, plan, out);

    // Pediments: the top must be one full rectangle at one level, open to the sky.
    const tops = s.cells.filter((cell) => !mine.has(above(cell)));
    const level = keyY(tops[0]!);
    if (tops.some((cell) => keyY(cell) !== level || plan.kinds.has(above(cell)))) return;
    const xs = tops.map(keyX), zs = tops.map(keyZ);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    const w = x1 - x0 + 1, d = z1 - z0 + 1;
    if (tops.length !== w * d) return;
    // The ridge runs along the longer side; a square temple's runs north–south.
    const alongX = w > d;
    const across = alongX ? d : w, length = alongX ? w : d;
    const ends: { cell: CellKey; dir: Dir4 }[] = alongX
      ? [
          { cell: key(x0, level, z0), dir: 3 }, // west end: facing it, its left cell is the north one
          { cell: key(x1, level, z1), dir: 1 }, // east end: its left cell is the south one
        ]
      : [
          { cell: key(x1, level, z0), dir: 0 }, // north end: its left cell is the east one
          { cell: key(x0, level, z1), dir: 2 }, // south end: its left cell is the west one
        ];
    for (const e of ends) {
      out.feature({ type: 'pediment', structure: s.id, cell: e.cell, dir: e.dir, params: { width: across, offset: (across - 1) / 2, depth: length / 2 } });
    }
  },
});
