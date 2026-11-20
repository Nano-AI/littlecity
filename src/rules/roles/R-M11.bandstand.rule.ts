// R-M11 · tier 3 · Bandstand (RC-14). A small open pavilion on a green or a
// square, where a band plays on summer evenings:
//
//   marble resting on 4 or more placed pillar shafts, each 2 or more tall
//   (R-M01's temple shape), its roof on 4 cells or fewer;
//   the pillars stand on the ground (not up on a podium of more than 4
//   cells: that stays a temple);
//   at their feet a plaza or garden region of 9 or more cells, or open
//   grass with no house within 4.
//
// Draws (the marble generator, by role): the slab as a thin canopy with an
// eight-sided tented roof and a finial over it, a railing round its stepped
// floor between the pillars (a 'stylobate' under each cell, as a temple).
//
// Priority 5995: before the temple (5990).

import { above, below, columnIndex, inBounds, key, keyX, keyY, keyZ, NO_CELL } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import type { ShapePlan, Structure } from '@/resolve/plan';
import { pillarsUnder, stylobates } from './R-M01.temple.rule';

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
  const ground = [...feet].map(above); // the cells the pillars stand in
  const floor = ground.map((c) => plan.world.floors.get(c)).find((k) => k === 'plaza' || k === 'garden');
  if (floor !== undefined) {
    const region = plan.floorAt.get(ground.find((c) => plan.world.floors.get(c) === floor)!);
    return region !== undefined && (plan.structures.get(region)?.cells.length ?? 0) >= 9;
  }
  // Open grass: no house within 4.
  for (const c of ground) {
    for (let dx = -4; dx <= 4; dx++) {
      for (let dz = -4; dz <= 4; dz++) {
        for (let y = keyY(c) - 1; y <= keyY(c) + 2; y++) {
          const x = keyX(c) + dx, z = keyZ(c) + dz;
          if (inBounds(x, y, z) && plan.kinds.get(key(x, y, z)) === 'house') return false;
        }
      }
    }
  }
  return true;
}

export default defineRule({
  id: 'R-M11.bandstand',
  part: 'roles',
  tier: 3,
  priority: 5995,
  about: 'Reads: marble of 4 cells or fewer on 4+ pillar shafts of 2+, standing on the ground on a plaza or garden of 9+ or on grass with no house within 4. Emits: role bandstand; stylobates.',
  find({ plan }) {
    const out = [];
    for (const s of plan.structures.values()) if (s.kind === 'marble' && !plan.roles.has(s.id) && isBandstand(s, plan)) out.push({ anchor: s.cells[0]!, structure: s.id });
    return out;
  },
  apply(c, out, { plan }) {
    const s = plan.structures.get(c.structure!)!;
    out.role(s.id, 'bandstand');
    stylobates(s, plan, out);
  },
});
