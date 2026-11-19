// J20 · tier 1 · Fence and wall runs.
//
// Cell and edge pieces of one kind are already one structure (pass 3), and
// the fence and wall generators draw a structure as runs with posts at
// corners and ends. This rule adds what a generator cannot see for itself:
//
//   gate      a cell piece standing on a path, or an edge piece between two
//             path cells: a gate in a fence (`gate/picket`), an arched
//             opening in a wall (`gate/arched`). People can walk through.
//             `dir` is the way through. A cell piece becomes a gate only if
//             the path leads on from it on at least one side and its own run
//             does not go the same way (a fence laid along a path is a
//             fence, not a row of gates).
//   run-end   an end of an edge piece that no other piece continues and that
//             points straight at a structure or a cliff: the run goes into
//             it and has no end post (`run-end/butt`).
//
// Cell pieces need no run-end: their generator sees their side neighbours.

import { edgeCells, keyY, neighbor, NO_CELL, type CellKey, type Dir4, type EdgeKey } from '@/core/grid';
import type { EdgeKind } from '@/core/kinds';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import type { StructureId } from '@/resolve/plan';
import { blocked, cellsBeyond, edgeEndIsFree, joinedArms, type Town } from './edges-lib';

type Data =
  | { what: 'gate'; structure: StructureId; kind: EdgeKind; cell?: CellKey; edge?: EdgeKey; dir: Dir4 }
  | { what: 'butt'; structure: StructureId; edge: EdgeKey; end: 0 | 1 };

/** A path lies beside `cell` on side `d`: at its level, or one level up or down (a path up a terrace). */
function pathBeside(t: Town, cell: CellKey, d: Dir4): boolean {
  const n = neighbor(cell, d);
  if (n === NO_CELL) return false;
  if (t.world.floors.get(n) === 'path') return true;
  const y = keyY(n);
  return (y < 31 && t.world.floors.get(n + (1 << 12)) === 'path') || (y > 0 && t.world.floors.get(n - (1 << 12)) === 'path');
}

/** The way through a cell piece standing on a path (0 = north–south, 1 = east–west), or null if it is no gate. */
export function gatePassage(t: Town, cell: CellKey, kind: EdgeKind): Dir4 | null {
  if (t.world.floors.get(cell) !== 'path') return null;
  const arms = joinedArms(t, cell, kind);
  let best: Dir4 | null = null;
  let bestCount = 0;
  for (const axis of [0, 1] as const) {
    const a = axis as Dir4, c = (axis + 2) as Dir4;
    if (arms.some((arm) => arm.dir === a || arm.dir === c)) continue;
    const count = (pathBeside(t, cell, a) ? 1 : 0) + (pathBeside(t, cell, c) ? 1 : 0);
    if (count > bestCount) {
      best = a;
      bestCount = count;
    }
  }
  return best;
}

export default defineRule<Data>({
  id: 'J20.fence-wall-runs',
  part: 'joinery',
  tier: 1,
  priority: 800,
  about: 'Reads: fence and wall runs, path floors under and beside them, what stands beyond the free ends of edge pieces. Emits: gate features; run-end features where an edge run meets a structure.',
  find({ facts }) {
    const out: Candidate<Data>[] = [];
    for (const s of facts.structures.values()) {
      if (s.kind !== 'fence' && s.kind !== 'wall') continue;
      const kind = s.kind;
      for (const cell of s.cells) {
        const dir = gatePassage(facts, cell, kind);
        if (dir !== null) out.push({ anchor: cell, key: 'gate', data: { what: 'gate', structure: s.id, kind, cell, dir } });
      }
      for (const edge of s.edges) {
        const [a, b] = edgeCells(edge);
        if (b !== NO_CELL && facts.world.floors.get(a) === 'path' && facts.world.floors.get(b) === 'path') {
          out.push({ anchor: a, key: `gate${edge & 1}`, data: { what: 'gate', structure: s.id, kind, edge, dir: (edge & 1 ? 2 : 1) as Dir4 } });
        }
        for (const end of [0, 1] as const) {
          if (!edgeEndIsFree(facts, edge, end, kind)) continue;
          if (cellsBeyond(edge, end).every((c) => blocked(facts, c))) {
            out.push({ anchor: a, key: `end${edge & 1}${end}`, data: { what: 'butt', structure: s.id, edge, end } });
          }
        }
      }
    }
    return out;
  },
  apply(c, out) {
    const d = c.data;
    if (d.what === 'gate') {
      const variant = d.kind === 'fence' ? 'picket' : 'arched';
      if (d.cell !== undefined) out.feature({ type: 'gate', structure: d.structure, cell: d.cell, dir: d.dir, variant });
      else out.feature({ type: 'gate', structure: d.structure, edge: d.edge, dir: d.dir, variant });
    } else {
      out.feature({ type: 'run-end', structure: d.structure, edge: d.edge, variant: 'butt', params: { end: d.end } });
    }
  },
});
