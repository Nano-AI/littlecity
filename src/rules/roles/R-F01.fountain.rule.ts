// R-F01 · tier 1 · Fountain (first match wins):
//   in a square       → tiered fountain with jets
//   in a courtyard    → well with a bucket
//   on a garden floor → birdbath
//   otherwise         → a small basin
//
// "In a square": the fountain's cell holds plaza that belongs to a region
// containing a full 3 × 3, or (a fountain set down first and paved round
// afterwards) such a region lies on three or more of its four sides.
//
// Also declares the fountain's sockets (src/rules/roles/ground-props.ts):
// where its water lies and where it leaves, for the Animation owner, and a
// perch on the birdbath. The generator supplies their frames.

import { key, keyX, keyY, keyZ, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import type { Facts } from '@/resolve/facts/api';
import { FOUNTAIN } from '@/style/props';
import { fountainSocketId, fountainSockets, type FountainRole } from './ground-props';
import { yardAt } from './ground-yard';

const DIRS: readonly Dir4[] = [0, 1, 2, 3];

// Whether a floor region is a square (the `plazas` fact's `square`: a plaza containing a full 3 × 3 at
// one level), asked of one region at a time and remembered for the resolve. The fact works it out for
// every plaza on the map, which the shape stage's budget has no room for.
const squares = new WeakMap<Facts, Map<number, boolean>>();
function isSquare(f: Facts, id: number | undefined): boolean {
  if (id === undefined) return false;
  let known = squares.get(f);
  if (!known) squares.set(f, (known = new Map()));
  const hit = known.get(id);
  if (hit !== undefined) return hit;
  const s = f.structures.get(id);
  let square = false;
  if (s && s.kind === 'plaza' && s.cells.length >= 9) {
    const cells = new Set(s.cells);
    square = s.cells.some((c) => {
      const x = keyX(c), y = keyY(c), z = keyZ(c);
      for (let dz = 0; dz < 3; dz++) for (let dx = 0; dx < 3; dx++) if (!cells.has(key(x + dx, y, z + dz))) return false;
      return true;
    });
  }
  known.set(id, square);
  return square;
}

export function fountainRole(f: Facts, cell: CellKey): FountainRole {
  // A square: the plaza region in the cell (or on enough of its sides) contains a full 3 × 3.
  if (isSquare(f, f.floorAt.get(cell))) return 'tiered-fountain';
  const around = new Map<number, number>();
  for (const d of DIRS) {
    const n = neighbor(cell, d);
    const id = n === NO_CELL ? undefined : f.floorAt.get(n);
    if (id !== undefined && isSquare(f, id)) around.set(id, (around.get(id) ?? 0) + 1);
  }
  for (const sides of around.values()) if (sides >= FOUNTAIN.squareSides) return 'tiered-fountain';
  if (yardAt(f, cell)) return 'well';
  if (f.world.floors.get(cell) === 'garden') return 'birdbath';
  return 'basin';
}

export default defineRule<{ role: FountainRole }>({
  id: 'R-F01.fountain',
  part: 'roles',
  tier: 1,
  priority: 3990,
  about: 'Reads: plazas (square), the yard the cell lies in, the floor in the cell. Claims: the fountain’s role. Emits water-surface, water-jet and perch sockets.',
  find({ facts }) {
    const out: Candidate<{ role: FountainRole }>[] = [];
    for (const s of facts.structures.values()) {
      if (s.kind !== 'fountain') continue;
      const cell = s.cells[0]!;
      out.push({ anchor: cell, structure: s.id, data: { role: fountainRole(facts, cell) } });
    }
    return out;
  },
  apply(c, out) {
    out.role(c.structure!, c.data.role);
    for (const s of fountainSockets(c.data.role)) {
      out.socket({ id: fountainSocketId(c.anchor, s), type: s.type, name: s.name, cell: c.anchor, structure: c.structure });
    }
  },
});
