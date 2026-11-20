// R-M12 · tier 3 · Stoa (RC-13). A long portico on the side of a square is
// a stoa, a market hall with shops at the back:
//
//   marble resting on 4 or more placed pillar shafts, each 2 or more tall
//   (R-M01's temple shape), its top one rectangle at one level, at least 3
//   times as long as it is wide, and more than 6 cells;
//   a long side looks onto plaza: a plaza cell at the foot of its pillars on
//   that side, or one or two cells out from it.
//
// Not: a temple of 6 cells or fewer, or one as wide as it is long; a long
// portico facing no square (it stays a temple).
//
// Draws (the marble generator, by role): one sloping roof falling away from
// the square from a deep cornice on the square side, instead of the
// pediments; the stylobates as a temple's; under its back bays, goods and
// crates for the booths (R-H98).
//
// Priority 5993: before the temple (5990), after the bandstand (5995).

import { above, below, keyX, keyY, keyZ, neighbor, NO_CELL, type Dir4 } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import type { ShapePlan, Structure } from '@/resolve/plan';
import { pillarsUnder, stylobates } from './R-M01.temple.rule';

export interface Stoa {
  /** The side of the long axis that faces the square. */
  front: Dir4;
}

export function stoaOf(s: Structure, plan: ShapePlan): Stoa | null {
  if (s.kind !== 'marble' || s.cells.length <= 6 || pillarsUnder(s, plan) < 4) return null;
  const mine = new Set(s.cells);
  const tops = s.cells.filter((c) => !mine.has(above(c)));
  const level = keyY(tops[0]!);
  if (tops.some((c) => keyY(c) !== level || plan.kinds.has(above(c)))) return null;
  const xs = tops.map(keyX), zs = tops.map(keyZ);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const w = x1 - x0 + 1, d = z1 - z0 + 1;
  if (tops.length !== w * d || Math.max(w, d) < 3 * Math.min(w, d)) return null;
  const alongX = w > d;
  const sides: Dir4[] = alongX ? [0, 2] : [3, 1];
  const lowest = Math.min(...s.cells.map(keyY));
  // A plaza at the foot of the pillars on that side: down from the edge cells, then one step out (or none).
  const plazaOn = (side: Dir4): number => {
    let n = 0;
    for (const c of s.cells) {
      if (keyY(c) !== lowest) continue;
      if (alongX ? keyZ(c) !== (side === 0 ? z0 : z1) : keyX(c) !== (side === 3 ? x0 : x1)) continue;
      let foot = below(c);
      while (foot !== NO_CELL && plan.kinds.get(foot) === 'pillar') foot = below(foot);
      if (foot === NO_CELL) continue;
      const ground = above(foot);
      const out1 = neighbor(ground, side), out2 = out1 === NO_CELL ? NO_CELL : neighbor(out1, side);
      if ([ground, out1, out2].some((k) => k !== NO_CELL && plan.world.floors.get(k) === 'plaza')) n++;
    }
    return n;
  };
  const counts = sides.map(plazaOn);
  if (Math.max(...counts) === 0) return null;
  return { front: counts[0]! >= counts[1]! ? sides[0]! : sides[1]! };
}

export default defineRule<Stoa>({
  id: 'R-M12.stoa',
  part: 'roles',
  tier: 3,
  priority: 5993,
  about: 'Reads: marble of 7+ cells on 4+ pillar shafts of 2+, a rectangular top 3+ times as long as wide, plaza at the foot of one long side or within 2 of it. Emits: role stoa; tag stoa:<front>; stylobates.',
  find({ plan }) {
    const out = [];
    for (const s of plan.structures.values()) {
      if (s.kind !== 'marble' || plan.roles.has(s.id)) continue;
      const st = stoaOf(s, plan);
      if (st) out.push({ anchor: s.cells[0]!, structure: s.id, data: st });
    }
    return out;
  },
  apply(c, out, { plan }) {
    const s = plan.structures.get(c.structure!)!;
    out.role(s.id, 'stoa');
    out.tag(s.id, `stoa:${(['n', 'e', 's', 'w'] as const)[c.data.front]}`);
    stylobates(s, plan, out);
  },
});
