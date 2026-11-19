// J15 · Arch direction and continuity, with the shaping of S1 (design
// section 9). For every arch cell this pins what its generator cannot see
// from the cell alone: the passage direction, the opening or openings that
// cross it (one arch may span three cells), and the piers under it. The
// working-out is in J15.arch-runs.fact.ts.
//
// Emits per arch cell one 'arch-opening' (dir = the passage; the arch spans
// the other axis), with an 'arch-crown' socket where an opening's crown lies
// in the cell, and a 'pier' under each cell that carries one.

import { E, N, S, W, type Dir4 } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { archRuns, type ArchRun } from './J15.arch-runs.fact';

export default defineRule<{ run: ArchRun; index: number }>({
  id: 'J15.arch-direction',
  part: 'joinery',
  tier: 1,
  priority: 850,
  about:
    'Reads: arch structures, what is solid beside and below them, floors. Emits: arch-opening per arch cell (socket arch-crown at a crown); ' +
    'pier features with their depth for spans of 4+, hanging runs past 2 cells, free runs and corners.',
  find({ facts }) {
    const out = [];
    for (const run of archRuns(facts).runs) {
      for (let index = 0; index < run.cells.length; index++) out.push({ anchor: run.cells[index]!, structure: run.structure, data: { run, index } });
    }
    return out;
  },
  apply(c, out) {
    const { run, index } = c.data;
    const cell = c.anchor;
    const inCell = run.openings.filter((o) => o.hi > index + 1e-6 && o.lo < index + 1 - 1e-6);
    const first = inCell[0], second = inCell[1];
    const half = inCell.find((o) => o.half);
    const lowSide: Dir4 = run.axis === 'x' ? W : N, highSide: Dir4 = run.axis === 'x' ? E : S;
    const crown = first !== undefined && !first.half && (first.lo + first.hi) / 2 >= index && (first.lo + first.hi) / 2 < index + 1;
    const id = out.feature({
      type: 'arch-opening',
      structure: run.structure,
      cell,
      dir: run.axis === 'x' ? S : E,
      variant: half ? 'half' : 'full',
      params: {
        ...(first ? { lo: first.lo - index, hi: first.hi - index } : {}),
        ...(second ? { lo2: second.lo - index, hi2: second.hi - index } : {}),
        ...(inCell.some((o) => o.overWater) ? { spring: 1 } : {}),
        ...(half ? { toward: half.half === 'hi' ? lowSide : highSide } : {}),
        crown: crown ? 1 : 0,
        at: index,
        len: run.cells.length,
      },
    });
    if (crown) out.socket({ type: 'arch-crown', owner: id, cell, structure: run.structure });
    for (const p of run.piers) {
      if (p.cell !== cell) continue;
      out.feature({
        type: 'pier',
        structure: run.structure,
        cell,
        params: { depth: p.depth, water: p.water ? 1 : 0, ...(p.side !== undefined ? { side: p.side } : {}) },
      });
    }
  },
});
