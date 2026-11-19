// R-G01 · tier 1 · Garden (first match wins, per garden region):
//   within 2 of a windmill and 4+ cells   → wheat field
//   in a courtyard                        → clipped herb beds
//   next to water                         → reeds and irises
//   9+ cells                              → park lawn with a hedge border
//   next to a house                       → vegetable rows and flower beds mixed by seed
//   otherwise                             → flower garden
//
// It also places each region's one seeded ornament (a `garden-piece`
// feature): a scarecrow in a wheat field of 6+ cells, a sundial in a herb
// garden of 3+ cells, round flower beds inside a park lawn.

import { keyX, keyZ, neighbor, type CellKey, type Dir4 } from '@/core/grid';
import { rand } from '@/core/rand';
import type { FeatureVariant, RolesOf } from '@/core/vocab';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import type { Facts } from '@/resolve/facts/api';
import { courtyards } from '@/resolve/facts/courtyards.fact';
import { gardens, type Garden } from '@/resolve/facts/gardens.fact';
import { FLOOR } from '@/style/ground';

type GardenRole = RolesOf<'garden'>;
const DIRS: readonly Dir4[] = [0, 1, 2, 3];

export function gardenRole(f: Facts, g: Garden): GardenRole {
  if (g.area >= FLOOR.wheatCells) {
    const mills: [number, number][] = [];
    for (const [c, k] of f.kinds) if (k === 'windmill') mills.push([keyX(c), keyZ(c)]);
    if (mills.length > 0 && g.cells.some((c) => mills.some(([mx, mz]) => Math.abs(mx - keyX(c)) + Math.abs(mz - keyZ(c)) <= FLOOR.wheatReach))) return 'wheat-field';
  }
  const yards = courtyards(f).byCell;
  if (g.cells.some((c) => yards.has(c))) return 'herb-garden';
  if (g.byWater) return 'reed-bed';
  if (g.area >= FLOOR.parkCells) return 'park-lawn';
  if (g.cells.some((c) => DIRS.some((d) => f.kinds.get(neighbor(c, d)) === 'house'))) return 'kitchen-garden';
  return 'flower-garden';
}

interface Piece {
  cell: CellKey;
  variant: FeatureVariant<'garden-piece'>;
}

/** The ornaments of a region: seeded, on cells with nothing standing in them. */
export function gardenPieces(f: Facts, g: Garden, role: GardenRole): Piece[] {
  const free = g.cells.filter((c) => !f.kinds.has(c));
  if (free.length === 0) return [];
  const cells = new Set(g.cells);
  const inner = free.filter((c) => DIRS.every((d) => cells.has(neighbor(c, d))));
  const seeded = (list: readonly CellKey[], what: string): CellKey => list[Math.floor(rand(f.seed, 'R-G01', g.id, what) * list.length)]!;
  if (role === 'wheat-field' && g.area >= 6) return [{ cell: seeded(inner.length ? inner : free, 'scarecrow'), variant: 'scarecrow' }];
  if (role === 'herb-garden' && g.area >= 3) return [{ cell: seeded(inner.length ? inner : free, 'sundial'), variant: 'sundial' }];
  if (role === 'park-lawn') {
    // Round beds on inner cells, never two side by side.
    const out: Piece[] = [];
    const taken = new Set<CellKey>();
    for (const c of inner) {
      if (rand(f.seed, 'R-G01', c, 'bed') > 0.3) continue;
      if (taken.has(c) || DIRS.some((d) => taken.has(neighbor(c, d)))) continue;
      taken.add(c);
      out.push({ cell: c, variant: 'bed' });
    }
    return out;
  }
  return [];
}

export default defineRule<{ role: GardenRole; pieces: Piece[] }>({
  id: 'R-G01.garden',
  part: 'roles',
  tier: 1,
  priority: 3990,
  about: 'Reads: gardens, courtyards, windmills within reach, houses beside. Claims: the garden region’s role. Emits: garden-piece features.',
  find({ facts }) {
    const out: Candidate<{ role: GardenRole; pieces: Piece[] }>[] = [];
    for (const g of gardens(facts).list) {
      const role = gardenRole(facts, g);
      out.push({ anchor: g.cells[0]!, structure: g.id, data: { role, pieces: gardenPieces(facts, g, role) } });
    }
    return out;
  },
  apply(c, out) {
    out.role(c.structure!, c.data.role);
    for (const p of c.data.pieces) out.feature({ type: 'garden-piece', structure: c.structure!, cell: p.cell, variant: p.variant });
  },
});
