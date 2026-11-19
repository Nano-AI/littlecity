// J28 · tier 1 · Shoreline. (The foam line where land meets water is drawn
// by the sea itself.) This rule adds:
//
//   ramp       a short plank ramp where a dock steps onto a beach: the land
//              beside the dock cell is sand at deck level with nothing built
//              on it, and the dock does not run along the shore there (a
//              quay lies against the beach on a sill instead).
//   dock-pile  a pair of mooring piles standing in the water off a dock of
//              2+ cells (seeded), on an open side with free water all round
//              and nothing else fitted there. Owns a 'perch' socket.
//
// Reads the fittings of R-D02 and J23 so as not to stand in their way.

import { DIR4, key, keyX, keyZ, neighbor, NO_CELL, opposite, turn, type CellKey, type Dir4 } from '@/core/grid';
import { rand } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import type { Facts } from '@/resolve/facts/api';
import { DOCK } from '@/style/dock';
import { beachOn, DIRS, dockSide, freeWater, SIDE_POS } from '../roles/dock-shape';

type Shore = { what: 'ramp' | 'pile'; dir: Dir4 };

/** The dock cell `cell` steps onto a beach on side `d`, end on. */
export function rampAt(f: Facts, cell: CellKey, d: Dir4): boolean {
  if (dockSide(f, cell, d) !== 'land' || !beachOn(f, cell, d)) return false;
  const land = key(keyX(cell) + DIR4[d]![0], 1, keyZ(cell) + DIR4[d]![1]);
  if (f.world.blocks.has(land)) return false;
  // Running along the shore: a neighbour beside it meets the land the same way.
  for (const p of [turn(d, 1), turn(d, 3)]) {
    const beside = neighbor(cell, p);
    if (beside !== NO_CELL && f.kinds.get(beside) === 'dock' && dockSide(f, beside, d) === 'land') return false;
  }
  return true;
}

export default defineRule<Shore>({
  id: 'J28.shoreline',
  part: 'joinery',
  tier: 1,
  priority: 720,
  about: 'Reads: dock cells, terrain height and material beside them, dock fittings. Claims: the beach slot under a ramp. Emits: ramp, dock-pile (socket perch).',
  find({ facts, plan }) {
    const out: Candidate<Shore>[] = [];
    for (const s of facts.structures.values()) {
      if (s.kind !== 'dock') continue;
      for (const cell of s.cells) {
        for (const d of DIRS) if (rampAt(facts, cell, d)) out.push({ anchor: cell, structure: s.id, key: `r${d}`, data: { what: 'ramp', dir: d } });
      }
      if (s.cells.length < 2 || rand(facts.seed, 'J28', 'piles', s.id) >= DOCK.piles) continue;
      const fitted = new Set((plan.featuresByStructure.get(s.id) ?? []).map((ft) => `${ft.cell! & 0xfff}:${ft.dir}`));
      const free: { cell: CellKey; d: Dir4 }[] = [];
      for (const cell of s.cells) {
        for (const d of DIRS) {
          if (dockSide(facts, cell, d) !== 'open' || fitted.has(`${cell}:${d}`)) continue;
          // The water the piles stand in must be open on its other three sides too.
          const wx = keyX(cell) + DIR4[d]![0], wz = keyZ(cell) + DIR4[d]![1];
          if (!freeWater(facts, wx, wz)) continue;
          const round = DIRS.filter((n) => n !== opposite(d)).every((n) => freeWater(facts, wx + DIR4[n]![0], wz + DIR4[n]![1]));
          if (round) free.push({ cell, d });
        }
      }
      if (free.length) {
        const pick = free[Math.floor(rand(facts.seed, 'J28', 'pile-at', s.id) * free.length)]!;
        out.push({ anchor: pick.cell, structure: s.id, key: `p${pick.d}`, data: { what: 'pile', dir: pick.d } });
      }
    }
    return out;
  },
  claims(c) {
    if (c.data.what !== 'ramp') return [];
    const d = c.data.dir;
    const land = key(keyX(c.anchor) + DIR4[d]![0], 1, keyZ(c.anchor) + DIR4[d]![1]);
    return [slot.floor(land, SIDE_POS[opposite(d)]!)];
  },
  apply(c, out) {
    const structure = c.structure!;
    const { what, dir } = c.data;
    if (what === 'ramp') {
      out.feature({ type: 'ramp', structure, cell: c.anchor, dir });
      return;
    }
    const id = out.feature({ type: 'dock-pile', structure, cell: c.anchor, dir });
    out.socket({ type: 'perch', owner: id, structure, cell: c.anchor, dir });
  },
});
