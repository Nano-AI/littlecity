// J18 · tier 1 · Stairs.
//
// Side-by-side flights with the same `rot` and flights continuing one up and
// one forward are already one structure (pass 3), and the stairs generator
// draws a structure as one flight. This rule adds what the generator cannot
// see for itself:
//
//   stair-landing  on every cell that starts the 4th, 7th, … cell of a
//                  flight ("a landing every 3"); cells side by side get it
//                  together, so a wide flight's landings line up
//   railing        on a side (cell + dir) that is open, with a drop of
//                  FENCE.drop (2) levels or more from the top of that cell
//                  to the surface beside it. A side against a wall, against
//                  higher ground or against another flight gets none.
//
// A rail's style follows what the flight stands on, as R-E01 would choose,
// except that stone steps on ordinary ground take an iron handrail rather
// than pickets.

import { below, keyX, keyY, keyZ, neighbor, NO_CELL, turn, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import type { StructureId } from '@/resolve/plan';
import { FENCE } from '@/style/edges';
import { flightSteps, isLanding, railVariantAt, surfaceBelow, type RailVariant, type Town } from './edges-lib';

type Data = { structure: StructureId; landing: boolean; rails: { dir: Dir4; variant: RailVariant }[] };

/** The sides of a stairs cell that need a handrail. */
export function stairRailSides(t: Town, cell: CellKey): Dir4[] {
  const rot = (t.world.blocks.get(cell)?.rot ?? 0) as Dir4;
  const y = keyY(cell);
  const out: Dir4[] = [];
  for (const d of [turn(rot, 1), turn(rot, 3)]) {
    const n = neighbor(cell, d);
    if (n === NO_CELL || t.kinds.get(n) === 'stairs') continue;
    const surface = surfaceBelow(t, keyX(n), keyZ(n), y);
    if (surface === 'wall') continue;
    // A flight climbing beside this one, one level down, is not a drop either.
    const under = below(n);
    if (under !== NO_CELL && t.kinds.get(under) === 'stairs') continue;
    if (y + 1 - surface >= FENCE.drop) out.push(d);
  }
  return out.sort((a, b) => a - b);
}

export default defineRule<Data>({
  id: 'J18.stairs',
  part: 'joinery',
  tier: 1,
  priority: 820,
  about: 'Reads: stairs structures, each cell’s rot and side columns. Emits: stair-landing every third cell of a flight; railing on open sides with a drop of 2 or more.',
  find({ facts }) {
    const out: Candidate<Data>[] = [];
    for (const s of facts.structures.values()) {
      if (s.kind !== 'stairs') continue;
      const steps = flightSteps(facts, s.cells);
      for (const cell of s.cells) {
        const landing = isLanding(steps.get(cell) ?? 0);
        const sides = stairRailSides(facts, cell);
        if (!landing && sides.length === 0) continue;
        const base = railVariantAt(facts, cell);
        const variant: RailVariant = base === 'picket' ? 'iron' : base;
        out.push({ anchor: cell, structure: s.id, data: { structure: s.id, landing, rails: sides.map((dir) => ({ dir, variant })) } });
      }
    }
    return out;
  },
  apply(c, out) {
    const { structure, landing, rails } = c.data;
    if (landing) out.feature({ type: 'stair-landing', structure, cell: c.anchor });
    for (const r of rails) out.feature({ type: 'railing', structure, cell: c.anchor, dir: r.dir, variant: r.variant });
  },
});
