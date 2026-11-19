// U12 · tier 2 · Centre and edge (the centre half).
//
// A town is grander toward its middle. A house of two storeys or more that
// stands within DRESSING.centreReach column steps of a square (a plaza
// holding a full 3 × 3) gets a stone ground storey: the tag 'stone-ground',
// which the house generator already draws for cliff houses.
//
// This is an urban-fill rule that runs in the SHAPE stage (part 'joinery'):
// tags belong to a structure's content hash, so they cannot be set while
// dressing. Its fixture is scenarios/rules/U12.centre-and-edge.
//
// The edge half (thatch, timber and rough stone on houses far from any
// floor) is U12-E.edge-rustic: it depends on the nearest floor, which may be
// far away, so it is a town-wide rule of its own.
//
// Stability: a house's tag depends on the plazas within centreReach of it.
//
// Reads: plazas (squares), structureInfo (storeys, ground footprint), roles.
// Claims: nothing.

import { columnIndex, keyX, keyZ, SIZE_X, SIZE_Z } from '@/core/grid';
import type { Role } from '@/core/vocab';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { plazas } from '@/resolve/facts/plazas.fact';
import { structureInfo } from '@/resolve/facts/structure.fact';
import { DRESSING } from '@/style/dressing';

/** Roles whose walls are their character already: left as they are. */
const KEEP: ReadonlySet<Role> = new Set<Role>(['chapel', 'greenhouse', 'stilt-house', 'boathouse', 'keepers-cottage', 'mill-house', 'cliff-house']);

export default defineRule({
  id: 'U12.centre-and-edge',
  part: 'joinery',
  tier: 2,
  priority: 880,
  about: 'Reads: plazas (squares), structureInfo (storeys, ground footprint), roles. Claims: nothing. Tags houses of 2+ storeys near a square stone-ground.',
  find({ facts, plan }) {
    const squares = plazas(facts).list.filter((p) => p.square);
    if (!squares.length) return [];
    const reach = Math.max(0, Math.round(DRESSING.centreReach));
    const near = new Uint8Array(SIZE_X * SIZE_Z);
    for (const p of squares) {
      for (const c of p.cells) {
        const x = keyX(c), z = keyZ(c);
        for (let dz = -reach; dz <= reach; dz++) {
          for (let dx = -(reach - Math.abs(dz)); dx <= reach - Math.abs(dz); dx++) {
            const nx = x + dx, nz = z + dz;
            if (nx >= 0 && nz >= 0 && nx < SIZE_X && nz < SIZE_Z) near[columnIndex(nx, nz)] = 1;
          }
        }
      }
    }
    const out: Candidate[] = [];
    for (const [id, info] of structureInfo(facts)) {
      const s = facts.structures.get(id);
      if (!s || s.kind !== 'house' || info.storeys < 2) continue;
      const role = plan.roles.get(id)?.role;
      if (role && KEEP.has(role)) continue;
      if (s.cells.some((c) => near[columnIndex(keyX(c), keyZ(c))])) out.push({ anchor: s.cells[0]!, structure: id });
    }
    return out;
  },
  apply(c, out) {
    out.tag(c.structure!, 'stone-ground');
  },
});
