// J20-F · tier 1 · Fence footing (a fix to J20, kept in a file of its own).
//
// A player can lay fence edge pieces where nothing is flat to stand on: round
// the eaves of a pitched roof, or across the top of a tower. Drawn on their
// cell line they float in the air at eaves level. Such a piece gets a
// 'run-bare' feature, and the fence generator leaves it out (the run's other
// pieces are drawn as before, with an end post where a bare piece was).
//
// A side of an edge piece has footing when the cell on that side, at the
// piece's level, is standable (ground, a floor, a deck, the top of a solid
// block) and is not the top of a pitched house roof or of a tower, lighthouse
// or windmill. A piece with footing on neither side is bare. A flat roof
// terrace (J05) is footing: its railings stay.
//
// Reads: fence runs (edge pieces), standable cells, roof features (J04, J05).
// Claims: nothing.

import { below, edgeCells, NO_CELL, type CellKey } from '@/core/grid';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { standable } from '@/resolve/facts/lib';
import type { StructureId } from '@/resolve/plan';
import { isTerraceTop } from '../joinery/houses.lib';

export default defineRule<{ structure: StructureId; edge: number }>({
  id: 'J20-F.fence-footing',
  part: 'joinery',
  tier: 1,
  priority: 799,
  about: 'Reads: fence runs (edge pieces), standable cells, roof features. Emits: run-bare on an edge piece with nothing flat to stand on either side. Claims: nothing.',
  find(ctx) {
    const { facts } = ctx;
    const footing = (c: CellKey): boolean => {
      if (c === NO_CELL || !standable(facts, c)) return false;
      const under = below(c);
      const k = under === NO_CELL ? undefined : facts.kinds.get(under);
      if (k === 'house') return isTerraceTop(ctx, under);
      return k !== 'tower' && k !== 'lighthouse' && k !== 'windmill';
    };
    const out: Candidate<{ structure: StructureId; edge: number }>[] = [];
    for (const s of facts.structures.values()) {
      if (s.kind !== 'fence') continue;
      for (const edge of s.edges) {
        const [a, b] = edgeCells(edge);
        if (footing(a) || footing(b)) continue;
        out.push({ anchor: a, key: `bare${edge & 1}`, data: { structure: s.id, edge } });
      }
    }
    return out;
  },
  apply(c, out) {
    out.feature({ type: 'run-bare', structure: c.data.structure, edge: c.data.edge });
  },
});
