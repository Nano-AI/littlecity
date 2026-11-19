// J22 · tier 2 · Plaza paving.
//
// The paving pattern is aligned to the grid (and so to the region's bounding
// box). A region of 4+ cells gets a border course at its edges (a
// `plaza-border` feature); a region containing a full 5 × 5 gets a radial
// centre motif (`plaza-motif`) in the middle of its largest square: a
// compass star in a square of 7 or more, plain rings in a smaller one, and
// rings as well when something stands on the centre cell (a fountain sits
// in the rings; a star would be hidden under it).

import { columnIndex, key, keyX, keyY, keyZ, SIZE_X, SIZE_Z, type CellKey } from '@/core/grid';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { plazas, type Plaza } from '@/resolve/facts/plazas.fact';
import { FLOOR } from '@/style/ground';

/** The north-west cell of the first largest square of a region (scanning level, then z, then x), and its side. */
export function largestSquareAt(cells: readonly CellKey[]): { x: number; y: number; z: number; size: number } {
  let best = { x: 0, y: 0, z: 0, size: 0 };
  const levels = [...new Set(cells.map(keyY))].sort((a, b) => a - b);
  for (const y of levels) {
    const has = new Uint8Array(SIZE_X * SIZE_Z);
    for (const c of cells) if (keyY(c) === y) has[columnIndex(keyX(c), keyZ(c))] = 1;
    const dp = new Uint8Array(SIZE_X * SIZE_Z);
    for (let z = 0; z < SIZE_Z; z++) {
      for (let x = 0; x < SIZE_X; x++) {
        const i = columnIndex(x, z);
        if (!has[i]) continue;
        const v = x > 0 && z > 0 ? 1 + Math.min(dp[i - 1]!, dp[i - SIZE_X]!, dp[i - 1 - SIZE_X]!) : 1;
        dp[i] = v;
        if (v > best.size) best = { x: x - v + 1, y, z: z - v + 1, size: v };
      }
    }
  }
  return best;
}

interface Paving {
  border: boolean;
  motif: { cell: CellKey; size: number; variant: 'compass' | 'rings' } | null;
}

export function pavingOf(p: Plaza, standsOn: (c: CellKey) => boolean): Paving {
  let motif: Paving['motif'] = null;
  if (p.largestSquare >= FLOOR.motifSquare) {
    const sq = largestSquareAt(p.cells);
    const half = Math.floor((sq.size - 1) / 2);
    const cell = key(sq.x + half, sq.y, sq.z + half);
    const odd = sq.size % 2 === 1;
    motif = { cell, size: sq.size, variant: sq.size >= 7 && !(odd && standsOn(cell)) ? 'compass' : 'rings' };
  }
  return { border: p.area >= 4, motif };
}

export default defineRule<Paving>({
  id: 'J22.plaza-paving',
  part: 'joinery',
  tier: 2,
  priority: 780,
  about: 'Reads: plazas (area, largest square), blocks on the centre cell. Emits: plaza-border and plaza-motif features.',
  find({ facts }) {
    const out: Candidate<Paving>[] = [];
    for (const p of plazas(facts).list) {
      const paving = pavingOf(p, (c) => facts.kinds.has(c));
      if (paving.border || paving.motif) out.push({ anchor: p.cells[0]!, structure: p.id, data: paving });
    }
    return out;
  },
  apply(c, out) {
    if (c.data.border) out.feature({ type: 'plaza-border', structure: c.structure!, cell: c.anchor });
    const m = c.data.motif;
    if (m) out.feature({ type: 'plaza-motif', structure: c.structure!, cell: m.cell, variant: m.variant, params: { size: m.size } });
  },
});
