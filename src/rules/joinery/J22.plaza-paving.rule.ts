// J22 · tier 2 · Plaza paving.
//
// The paving pattern is aligned to the grid (and so to the region's bounding
// box). A region of 4+ cells gets a border course at its edges (a
// `plaza-border` feature); a region containing a full 5 × 5 gets a radial
// centre motif (`plaza-motif`) in the middle of its largest square: a
// compass star in a square of 7 or more, plain rings in a smaller one, and
// rings as well when something stands on the centre cell (a fountain sits
// in the rings; a star would be hidden under it). With a fountain elsewhere
// on that square, the rings centre on the fountain if a 5 × 5 or more of
// plaza fits round it, and the square has no motif if none does (FX-08).

import { columnIndex, key, keyX, keyY, keyZ, SIZE_X, SIZE_Z, type CellKey } from '@/core/grid';
import { defineRule, type Candidate } from '@/resolve/engine/api';
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

export function pavingOf(cells: readonly CellKey[], standsOn: (c: CellKey) => boolean, fountains: readonly CellKey[] = []): Paving {
  let motif: Paving['motif'] = null;
  // Only a region with enough cells to hold the square is worth searching for one.
  if (cells.length >= FLOOR.motifSquare * FLOOR.motifSquare) {
    const sq = largestSquareAt(cells);
    if (sq.size >= FLOOR.motifSquare) {
      const half = Math.floor((sq.size - 1) / 2);
      const cell = key(sq.x + half, sq.y, sq.z + half);
      const odd = sq.size % 2 === 1;
      motif = { cell, size: sq.size, variant: sq.size >= 7 && !(odd && standsOn(cell)) ? 'compass' : 'rings' };
      // FX-08: a square has one centre. With a fountain on it, the rings centre on the fountain where a
      // square of 5 or more fits round it; where none does, the square has no motif at all.
      const placed = fountains.filter((f) => keyY(f) === sq.y);
      if (placed.length > 0 && !placed.includes(cell)) {
        const cx = sq.x + (sq.size - 1) / 2, cz = sq.z + (sq.size - 1) / 2;
        const f = [...placed].sort((a, b) => Math.hypot(keyX(a) - cx, keyZ(a) - cz) - Math.hypot(keyX(b) - cx, keyZ(b) - cz) || a - b)[0]!;
        const has = new Set(cells);
        const fits = (h: number): boolean => {
          for (let dz = -h; dz <= h; dz++) for (let dx = -h; dx <= h; dx++) if (!has.has(key(keyX(f) + dx, sq.y, keyZ(f) + dz))) return false;
          return true;
        };
        let h = Math.floor((FLOOR.motifSquare - 1) / 2);
        if (!fits(h)) motif = null;
        else {
          while (2 * (h + 1) + 1 <= sq.size && fits(h + 1)) h++;
          motif = { cell: f, size: 2 * h + 1, variant: 'rings' };
        }
      }
    }
  }
  return { border: cells.length >= 4, motif };
}

export default defineRule<Paving>({
  id: 'J22.plaza-paving',
  part: 'joinery',
  tier: 2,
  priority: 780,
  about: 'Reads: plaza regions (area, largest square), blocks on the centre cell, fountains on the plaza. Emits: plaza-border and plaza-motif features.',
  find({ facts }) {
    const out: Candidate<Paving>[] = [];
    for (const p of facts.structures.values()) {
      if (p.kind !== 'plaza') continue;
      const paving = pavingOf(p.cells, (c) => facts.kinds.has(c), p.cells.filter((c) => facts.kinds.get(c) === 'fountain'));
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
