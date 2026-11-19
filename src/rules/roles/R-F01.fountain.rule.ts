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

import { neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import type { Facts } from '@/resolve/facts/api';
import { courtyards } from '@/resolve/facts/courtyards.fact';
import { plazas } from '@/resolve/facts/plazas.fact';
import { FOUNTAIN } from '@/style/props';
import { fountainSocketId, fountainSockets, type FountainRole } from './ground-props';

const DIRS: readonly Dir4[] = [0, 1, 2, 3];

export function fountainRole(f: Facts, cell: CellKey): FountainRole {
  const squares = plazas(f).byCell;
  if (squares.get(cell)?.square) return 'tiered-fountain';
  const around = new Map<number, number>();
  for (const d of DIRS) {
    const n = neighbor(cell, d);
    const p = n === NO_CELL ? undefined : squares.get(n);
    if (p?.square) around.set(p.id, (around.get(p.id) ?? 0) + 1);
  }
  for (const sides of around.values()) if (sides >= FOUNTAIN.squareSides) return 'tiered-fountain';
  if (courtyards(f).byCell.has(cell)) return 'well';
  if (f.world.floors.get(cell) === 'garden') return 'birdbath';
  return 'basin';
}

export default defineRule<{ role: FountainRole }>({
  id: 'R-F01.fountain',
  part: 'roles',
  tier: 1,
  priority: 3990,
  about: 'Reads: plazas (square), courtyards, the floor in the cell. Claims: the fountain’s role. Emits water-surface, water-jet and perch sockets.',
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
