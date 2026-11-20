// R-M11 · tier 3 · Bandstand (RC-14). A small open pavilion on a green or a
// square, where a band plays on summer evenings:
//
//   marble resting on 4 or more placed pillar shafts, each 2 or more tall
//   (R-M01's temple shape), its roof on 4 cells or fewer;
//   the pillars stand on the ground (not up on a podium of more than 4
//   cells: that stays a temple);
//   at their feet a plaza or garden region of 9 or more cells (on bare grass
//   a small temple is left the temple it was built as).
//
// (Four shafts under four cells or fewer means exactly four cells, one shaft
// under each, all at one level: a 2 × 2, a 1 × 4, an L, a T or an S.)
//
// Draws (src/gen/marble/pavilion.ts): a park pavilion. The marble becomes
// its roof: a stepped many-sided plinth, a light entablature and a tented
// roof in facets (an octagon over a 2 × 2; a one-wide plan with half-octagon
// ends otherwise). The pillars become its ring of slender columns: this rule
// claims each pillar's role slot (nothing else may give it a role) and pins
// a 'pavilion-bay' feature on it with the footprint, so the pillar draws the
// columns standing in its own cell instead of a fat shaft. The rail between
// the columns is open in one bay, on the side tagged 'bandstand:<side>':
// toward the nearest path, else the most open paving or lawn.
//
// Priority 5995: before the temple (5990).

import { above, below, columnIndex, DIR4, inColumnBounds, key, keyX, keyY, keyZ, neighbor, NO_CELL, type Dir4 } from '@/core/grid';
import { defineRule, slot } from '@/resolve/engine/api';
import type { ShapePlan, Structure, StructureId } from '@/resolve/plan';
import { pillarsUnder } from './R-M01.temple.rule';

export function isBandstand(s: Structure, plan: ShapePlan): boolean {
  if (s.kind !== 'marble' || s.cells.length > 4 || pillarsUnder(s, plan) < 4) return false;
  // The foot of the pillars: the cells under the lowest marble cells, down the shafts to the ground.
  const lowest = Math.min(...s.cells.map(keyY));
  const feet = new Set<number>();
  for (const c of s.cells) {
    if (keyY(c) !== lowest) continue;
    let u = below(c);
    while (u !== NO_CELL && plan.kinds.get(u) === 'pillar') u = below(u);
    if (u === NO_CELL) return false;
    // On the ground, not on a block (a podium): the cell under the shaft is terrain.
    if (keyY(u) >= plan.terrain.height[columnIndex(keyX(u), keyZ(u))]!) return false;
    feet.add(u);
  }
  // The cells the pillars stand in and those beside them (a pillar takes the floor of its own cell).
  const ground = [...feet].map(above).flatMap((c) => [c, ...([0, 1, 2, 3] as Dir4[]).map((d) => neighbor(c, d))]);
  for (const c of ground) {
    const k = c === NO_CELL ? undefined : plan.world.floors.get(c);
    if (k !== 'plaza' && k !== 'garden') continue;
    const region = plan.floorAt.get(c);
    if (region !== undefined && (plan.structures.get(region)?.cells.length ?? 0) >= 9) return true;
  }
  return false;
}

/** The pillar structures under a marble structure. */
function pillarIds(s: Structure, plan: ShapePlan): StructureId[] {
  const out = new Set<StructureId>();
  for (const cell of s.cells) {
    const under = below(cell);
    if (under === NO_CELL || plan.kinds.get(under) !== 'pillar') continue;
    const p = plan.structureAt.get(under);
    if (p !== undefined) out.add(p);
  }
  return [...out].sort((a, b) => a - b);
}

/** The side to leave open: toward the nearest path, else the most paving or lawn, else south. */
function doorSide(s: Structure, plan: ShapePlan): Dir4 {
  const mine = new Set(s.cells.map((c) => `${keyX(c)},${keyZ(c)}`));
  const score = [0, 0, 0, 0];
  for (const c of s.cells) {
    for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
      const [dx, dz] = DIR4[d]!;
      if (mine.has(`${keyX(c) + dx},${keyZ(c) + dz}`)) continue;
      for (let k = 1; k <= 4; k++) {
        const x = keyX(c) + dx * k, z = keyZ(c) + dz * k;
        if (!inColumnBounds(x, z)) break;
        const h = plan.terrain.height[columnIndex(x, z)]!;
        const cell = key(x, h, z);
        if (plan.kinds.has(cell)) {
          score[d] -= 1 / k;
          break;
        }
        const f = plan.world.floors.get(cell);
        score[d] += f === 'path' ? 4 / k : f === 'plaza' ? 1 / k : f === 'garden' ? 0.5 / k : 0;
      }
    }
  }
  // Ties: the side the usual view looks at first.
  const order: Dir4[] = [2, 1, 3, 0];
  return order.reduce((best, d) => (score[d]! > score[best]! + 1e-9 ? d : best), order[0]!);
}

export default defineRule<{ pillars: StructureId[] }>({
  id: 'R-M11.bandstand',
  part: 'roles',
  tier: 3,
  priority: 5995,
  about:
    'Reads: marble of 4 cells or fewer on 4+ pillar shafts of 2+, standing on the ground on a plaza or garden of 9+; the floors round it. Claims: the role of each pillar under it. Emits: role bandstand; tag bandstand:<side> (the open bay); a pavilion-bay feature on each pillar (it draws the columns in its cell).',
  find({ plan }) {
    const out = [];
    for (const s of plan.structures.values()) {
      if (s.kind === 'marble' && !plan.roles.has(s.id) && isBandstand(s, plan)) out.push({ anchor: s.cells[0]!, structure: s.id, data: { pillars: pillarIds(s, plan) } });
    }
    return out;
  },
  claims: (c) => c.data.pillars.map((p) => slot.role(p)),
  apply(c, out, { plan }) {
    const s = plan.structures.get(c.structure!)!;
    out.role(s.id, 'bandstand');
    out.tag(s.id, (['bandstand:n', 'bandstand:e', 'bandstand:s', 'bandstand:w'] as const)[doorSide(s, plan)]);
    // The footprint, as the pillars need it to work out the same layout.
    const xs = s.cells.map(keyX), zs = s.cells.map(keyZ);
    const x0 = Math.min(...xs), z0 = Math.min(...zs);
    let mask = 0, ground = 0, low = Infinity;
    for (const cell of s.cells) {
      mask |= 1 << (keyX(cell) - x0 + 4 * (keyZ(cell) - z0));
      const h = plan.terrain.height[columnIndex(keyX(cell), keyZ(cell))]!;
      ground = Math.max(ground, h);
      low = Math.min(low, h);
    }
    for (const id of c.data.pillars) {
      const p = plan.structures.get(id)!;
      const top = p.cells[p.cells.length - 1]!;
      out.feature({ type: 'pavilion-bay', structure: id, cell: top, params: { mask, x0, z0, ground, low } });
    }
  },
});
