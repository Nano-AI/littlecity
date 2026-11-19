// D14 · tier 3 · Roof life (the local half; the stork is D14-T).
//
//   chimney pots   every chimney already wears them (the chimney part draws
//                  its pots), so nothing is added here
//   a birdhouse    on DEPTH.birdhouse of houses: a little painted box under
//                  the eaves of the top storey, on a wall with nothing else
//                  on it (no door, balcony, oriel, clock or turret), beside
//                  its window
//
// Stability: a house's roll is seeded by its own first cell.
//
// Reads: facades (top storey, exposed, not touching), features on the
// wall. Claims: the wall face the birdhouse is fixed to.

import { keyY, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { facades } from '@/resolve/facts/facades.fact';
import { structureInfo } from '@/resolve/facts/structure.fact';
import { DEPTH } from '@/style/depth';
import { lucky } from './lib';

const RULE = 'D14.roof-life';
const BUSY = new Set(['door', 'balcony', 'vista', 'corner-oriel', 'portico']);

export default defineRule<{ wall: CellKey; dir: Dir4 }>({
  id: RULE,
  part: 'decoration',
  tier: 3,
  priority: 860,
  about: 'Reads: facades of the top storey, features on those walls. Claims: the wall face a birdhouse hangs on.',
  find({ facts, plan, seed }) {
    const all = facades(facts);
    const info = structureInfo(facts);
    const out: Candidate<{ wall: CellKey; dir: Dir4 }>[] = [];
    for (const s of facts.structures.values()) {
      if (s.kind !== 'house' || !lucky(seed, RULE, s.cells[0]!, 'birdhouse', DEPTH.birdhouse)) continue;
      const top = info.get(s.id)?.maxY ?? -1;
      const role = plan.roles.get(s.id)?.role;
      if (role === 'greenhouse' || role === 'town-hall') continue;
      const busy = new Set<number>();
      for (const f of plan.featuresByStructure.get(s.id) ?? []) if (f.cell !== undefined && f.dir !== undefined && BUSY.has(f.type)) busy.add(f.cell * 4 + f.dir);
      const wall = (all.byStructure.get(s.id) ?? []).find((f) => keyY(f.cell) === top && !f.touching && f.faces !== 'structure' && !busy.has(f.cell * 4 + f.dir) && f.drop <= 2);
      if (wall) out.push({ anchor: wall.cell, structure: s.id, key: wall.dir, data: { wall: wall.cell, dir: wall.dir } });
    }
    return out;
  },
  claims: (c) => [slot.custom('wall-face', c.data.wall, c.data.dir)],
  apply(c, out, ctx) {
    const mount = out.socket({ type: 'wall-mount', cell: c.data.wall, dir: c.data.dir, structure: c.structure });
    const box = out.prop({ type: 'birdhouse', at: { socket: mount }, params: { look: Math.floor(ctx.rand('look') * 1000) } });
    out.socket({ type: 'perch', owner: box, cell: c.data.wall, dir: c.data.dir, structure: c.structure });
  },
});
