// R-H21 · tier 3 · Schoolhouse (RC-19; town-wide). A town of 10 or more
// houses has a school, and one only:
//
//   a house with no role yet (a home: every special house is decided
//   first), of one storey and a footprint of 1–4 cells, with a facade on a
//   street within 2;
//   its yard: the free ground cells (bare grass, or garden) at its level
//   round it (side or corner), 4 or more of them, with a fence or wall (an edge piece
//   or a fence or wall piece) on at least one of their sides, and some of
//   them beside a path (a back yard behind a row is not a school yard);
//   of all such houses, the one with the biggest yard (then the lowest id).
//
// Town-wide: it counts the houses and picks one in the whole town, so a
// house built far away can move the school (RuleDef.townWide).
//
// Draws: a bell cupola on the ridge (J30 'bell-cupola'), tall windows
// (J09), and a hopscotch court chalked on its yard (R-H98).
//
// Priority 9855: after every other house role, just before the cottage.

import { columnIndex, edgeOf, inColumnBounds, key, keyX, keyY, keyZ, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import type { Facts } from '@/resolve/facts/api';
import { facades } from '@/resolve/facts/facades.fact';
import { structureInfo } from '@/resolve/facts/structure.fact';
import type { Structure } from '@/resolve/plan';
import { houseStructures } from '../joinery/houses.lib';

const DIRS: readonly Dir4[] = [0, 1, 2, 3];
export const SCHOOL_TOWN = 10;

/** The free ground cells beside a house (grass or garden, nothing on them), if 4+ and fenced on some side. */
export function schoolYard(f: Facts, s: Structure): CellKey[] {
  const mine = new Set(s.cells);
  const yard = new Set<CellKey>();
  for (const c of s.cells) {
    if (keyY(c) !== f.terrain.height[columnIndex(keyX(c), keyZ(c))]) continue;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const x = keyX(c) + dx, z = keyZ(c) + dz;
        if (!inColumnBounds(x, z)) continue;
        const n = key(x, f.terrain.height[columnIndex(x, z)]!, z);
        if (mine.has(n) || f.kinds.has(n) || keyY(n) !== keyY(c)) continue;
        const floor = f.world.floors.get(n);
        if (floor !== undefined && floor !== 'garden') continue;
        yard.add(n);
      }
    }
  }
  if (yard.size < 4) return [];
  const fenced = [...yard].some((c) =>
    DIRS.some((d) => {
      const e = edgeOf(c, d);
      if (e !== NO_CELL && f.world.edges.has(e)) return true;
      const k = f.kinds.get(neighbor(c, d));
      return k === 'fence' || k === 'wall';
    }),
  );
  // A school yard is open to the street: some cell of it beside a path (a back yard behind a row is not).
  const onStreet = [...yard].some((c) => DIRS.some((d) => f.world.floors.get(neighbor(c, d)) === 'path'));
  return fenced && onStreet ? [...yard].sort((a, b) => a - b) : [];
}

export default defineRule({
  id: 'R-H21.schoolhouse',
  part: 'roles',
  tier: 3,
  priority: 9855,
  townWide: true,
  about: 'Reads: every house (count, roles), structureInfo (storeys, footprint), facades (a street right outside), the free ground beside each and the fences round it. Claims: the role of one house, the best yard in a town of 10+ houses.',
  find(ctx) {
    const houses = houseStructures(ctx);
    if (houses.length < SCHOOL_TOWN) return [];
    const info = structureInfo(ctx.facts);
    const all = facades(ctx.facts);
    let best: { s: Structure; size: number } | null = null;
    for (const s of houses) {
      const i = info.get(s.id);
      if (!i || ctx.plan.roles.has(s.id) || i.storeys !== 1 || i.footprint > 4) continue;
      if (!(all.byStructure.get(s.id) ?? []).some((fc) => fc.storey === 1 && fc.street !== undefined && fc.street <= 2)) continue;
      const size = schoolYard(ctx.facts, s).length;
      if (size >= 4 && (!best || size > best.size)) best = { s, size };
    }
    return best ? [{ anchor: best.s.cells[0]!, structure: best.s.id }] : [];
  },
  apply(c, out) {
    out.role(c.structure!, 'schoolhouse');
  },
});
