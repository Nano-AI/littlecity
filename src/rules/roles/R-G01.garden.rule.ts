// R-G01 · tier 1 · Garden (first match wins, per garden region):
//   within 2 of a windmill and 4+ cells   → wheat field
//   in a courtyard                        → clipped herb beds (a court of blocks, walls or cliffs, as
//                                           the design defines it: a yard closed only by a picket
//                                           fence is a fenced garden, not a courtyard)
//   next to water                         → reeds and irises
//   9+ cells                              → park lawn with a hedge border
//   next to a house                       → vegetable rows and flower beds mixed by seed
//   otherwise                             → flower garden
//
// It also places each region's one seeded ornament (a `garden-piece`
// feature): a scarecrow in a wheat field of 6+ cells, a sundial in a herb
// garden of 3+ cells, round flower beds inside a park lawn.

import { edgeOf, keyX, keyZ, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { rand } from '@/core/rand';
import type { FeatureVariant, RolesOf } from '@/core/vocab';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import type { Facts } from '@/resolve/facts/api';
import { openWater } from '@/resolve/facts/lib';
import type { Structure } from '@/resolve/plan';
import { FLOOR } from '@/style/ground';
import { yardAt } from './ground-yard';

type GardenRole = RolesOf<'garden'>;
const DIRS: readonly Dir4[] = [0, 1, 2, 3];

/** Some side of this yard is closed by a fence (a cell piece or an edge piece) rather than a block, a wall or a cliff. */
function fenced(f: Facts, yard: readonly CellKey[]): boolean {
  return yard.some((c) =>
    DIRS.some((d) => {
      const e = edgeOf(c, d);
      if (e !== NO_CELL && f.world.edges.get(e) === 'fence') return true;
      return f.kinds.get(neighbor(c, d)) === 'fence';
    }),
  );
}

/** A garden region: a floor structure of kind 'garden'. (The rule reads only its id and cells.) */
type Garden = Pick<Structure, 'id' | 'cells'>;

/** The columns that hold a windmill block. */
export function windmills(f: Facts): [number, number][] {
  const mills: [number, number][] = [];
  for (const [c, k] of f.kinds) if (k === 'windmill') mills.push([keyX(c), keyZ(c)]);
  return mills;
}

export function gardenRole(f: Facts, g: Garden, mills: readonly (readonly [number, number])[] = windmills(f)): GardenRole {
  const area = g.cells.length;
  if (area >= FLOOR.wheatCells && mills.length > 0) {
    if (g.cells.some((c) => mills.some(([mx, mz]) => Math.abs(mx - keyX(c)) + Math.abs(mz - keyZ(c)) <= FLOOR.wheatReach))) return 'wheat-field';
  }
  const open = new Set<CellKey>();
  for (const c of g.cells) {
    const yard = yardAt(f, c, open);
    if (yard && !fenced(f, yard)) return 'herb-garden';
    if (yard) for (const y of yard) open.add(y); // a fenced yard: no need to flood it again
  }
  if (g.cells.some((c) => DIRS.some((d) => openWater(f, keyX(c) + STEP[d]![0], keyZ(c) + STEP[d]![1])))) return 'reed-bed';
  if (area >= FLOOR.parkCells) return 'park-lawn';
  if (g.cells.some((c) => DIRS.some((d) => f.kinds.get(neighbor(c, d)) === 'house'))) return 'kitchen-garden';
  return 'flower-garden';
}
const STEP: readonly (readonly [number, number])[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

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
  const area = g.cells.length;
  if (role === 'wheat-field' && area >= 6) return [{ cell: seeded(inner.length ? inner : free, 'scarecrow'), variant: 'scarecrow' }];
  if (role === 'herb-garden' && area >= 3) return [{ cell: seeded(inner.length ? inner : free, 'sundial'), variant: 'sundial' }];
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
    // A park with room for one always has one.
    if (out.length === 0 && inner.length > 0) out.push({ cell: seeded(inner, 'bed'), variant: 'bed' });
    return out;
  }
  return [];
}

export default defineRule<{ role: GardenRole; pieces: Piece[] }>({
  id: 'R-G01.garden',
  part: 'roles',
  tier: 1,
  priority: 3990,
  about: 'Reads: garden regions, the yard each lies in, windmills within reach, water and houses beside. Claims: the garden region’s role. Emits: garden-piece features.',
  find({ facts }) {
    const out: Candidate<{ role: GardenRole; pieces: Piece[] }>[] = [];
    const mills = windmills(facts);
    for (const g of facts.structures.values()) {
      if (g.kind !== 'garden') continue;
      const role = gardenRole(facts, g, mills);
      out.push({ anchor: g.cells[0]!, structure: g.id, data: { role, pieces: gardenPieces(facts, g, role) } });
    }
    return out;
  },
  apply(c, out) {
    out.role(c.structure!, c.data.role);
    for (const p of c.data.pieces) out.feature({ type: 'garden-piece', structure: c.structure!, cell: p.cell, variant: p.variant });
  },
});
