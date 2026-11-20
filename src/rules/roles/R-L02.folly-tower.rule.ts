// R-L02 · tier 2 · Folly tower (RC-21). A Light placed far from the sea is
// no lighthouse: a red-and-white tower ten cells inland is a joke. Inland it
// is a belvedere, the folly a landowner builds for the view:
//
//   a lighthouse structure with no open water (terrain at sea level) within
//   6 columns of its foot.
//
// Not: a Light within 6 of water (R-L01's lighthouse, whose beam L09 turns).
//
// Draws: plain coursed stone instead of the bands, the gallery with its
// rail, and on top an open belvedere (four slim posts under a little dome,
// a finial and a flag) in place of the glazed lantern room: no 'lantern'
// socket, so no beam. A house touching it is not a keeper's cottage
// (R-H02 asks `inland`).
//
// Priority 7995: before R-L01 (7990).

import { above, columnIndex, inColumnBounds, keyX, keyZ } from '@/core/grid';
import type { Terrain } from '@/core/world';
import { defineRule } from '@/resolve/engine/api';
import type { Structure } from '@/resolve/plan';

/** How far (Chebyshev, columns) open water must be from a Light's foot for it to be a folly. */
export const FOLLY_REACH = 6;

/** No open water within FOLLY_REACH of the structure's foot. */
export function inland(t: Terrain, s: Pick<Structure, 'cells'>): boolean {
  const x0 = keyX(s.cells[0]!), z0 = keyZ(s.cells[0]!);
  for (let dz = -FOLLY_REACH; dz <= FOLLY_REACH; dz++) {
    for (let dx = -FOLLY_REACH; dx <= FOLLY_REACH; dx++) {
      const x = x0 + dx, z = z0 + dz;
      if (!inColumnBounds(x, z) || t.height[columnIndex(x, z)] === 0) return false;
    }
  }
  return true;
}

export default defineRule({
  id: 'R-L02.folly-tower',
  part: 'roles',
  tier: 2,
  priority: 7995,
  about: 'Reads: lighthouse structures, the terrain within 6 of their foot. Emits: role folly-tower; cap/belvedere (sockets tower-top, flag-mount) and a gallery (sockets flag-mount, perch) on the top cell when nothing stands on it.',
  find({ plan }) {
    const out = [];
    for (const s of plan.structures.values()) if (s.kind === 'lighthouse' && inland(plan.terrain, s)) out.push({ anchor: s.cells[0]!, structure: s.id });
    return out;
  },
  apply(c, out, { plan }) {
    const s = plan.structures.get(c.structure!)!;
    const top = s.cells[s.cells.length - 1]!;
    out.role(s.id, 'folly-tower');
    if (plan.kinds.has(above(top))) return;
    const cap = out.feature({ type: 'cap', variant: 'belvedere', structure: s.id, cell: top });
    out.socket({ type: 'tower-top', owner: cap, cell: top, structure: s.id });
    out.socket({ type: 'flag-mount', owner: cap, cell: top, structure: s.id });
    const g = out.feature({ type: 'gallery', structure: s.id, cell: top });
    out.socket({ type: 'flag-mount', owner: g, cell: top, structure: s.id });
    out.socket({ type: 'perch', owner: g, cell: top, structure: s.id });
  },
});
