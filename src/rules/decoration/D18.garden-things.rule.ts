// D18 · tier 2 · Garden things. What a gardener leaves round a garden:
//
//   a scarecrow     in a kitchen garden of 6+ cells, among the beds nearest
//                   its middle (a wheat field has R-G01's own scarecrow)
//   beehives        beside a flower or herb garden, DEPTH.beehives of them:
//                   a row of skeps on the ground just outside, facing away
//   a wheelbarrow   beside a kitchen garden, DEPTH.wheelbarrow of them
//   a trellis rose  on a house wall a garden runs up to, DEPTH.trellis of
//                   them: on the garden's edge against that wall
//
// Things outside a garden stand on bare ground that nothing else uses
// (landUse), at the edge slot toward the garden, and never on a walking
// line. Which outside cell is a seeded pick over the garden's own cells.
//
// Stability: each garden's rolls are seeded by its first cell; it reads its
// own cells and the cells beside them.
//
// Reads: gardens, roles, landUse, clearways. Claims: the slot each thing
// stands on.

import { keyX, keyZ, neighbor, NO_CELL, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { gardens } from '@/resolve/facts/gardens.fact';
import { DIRS } from '@/resolve/facts/lib';
import { occupancy } from '@/resolve/facts/occupancy.fact';
import { DEPTH } from '@/style/depth';
import { landUse } from '../urban/land-use.fact';
import { emit, type Placed } from '../urban/plots';
import { clearways, edgePos } from './clearways.fact';
import { lucky } from './lib';

const RULE = 'D18.garden-things';

export default defineRule<Placed>({
  id: RULE,
  part: 'decoration',
  tier: 2,
  priority: 820,
  about: 'Reads: gardens and their roles, landUse, clearways, house walls beside gardens. Claims: the slot each scarecrow, hive, barrow or trellis stands on.',
  find({ facts, plan, seed }) {
    const clear = clearways(facts);
    const uses = landUse(facts);
    const occ = occupancy(facts);
    const out: Candidate<Placed>[] = [];
    for (const g of gardens(facts).list) {
      const role = plan.roles.get(g.id)?.role;
      const first = g.cells[0]!;
      const inside = new Set(g.cells);
      const look = (k: string): number => hash(seed, RULE, k, first) % 1000;
      // Bare ground just outside, by a seeded order of the garden's own edge.
      const outside: { cell: CellKey; d: Dir4 }[] = [];
      for (const c of g.edgeCells) {
        for (const d of DIRS) {
          const n = neighbor(c, d);
          if (n === NO_CELL || inside.has(n) || facts.world.floors.has(n) || uses.byCell.has(n)) continue;
          if (!clear.free(n, edgePos(opposite(d)))) continue;
          outside.push({ cell: n, d: opposite(d) });
        }
      }
      outside.sort((a, b) => hash(seed, RULE, a.cell, a.d) - hash(seed, RULE, b.cell, b.d) || a.cell - b.cell);
      const add = (key: string, p: Placed): void => {
        out.push({ anchor: first, key, data: p });
      };
      if (role === 'kitchen-garden' && g.cells.length >= 6) {
        const mx = g.cells.reduce((a, c) => a + keyX(c), 0) / g.cells.length, mz = g.cells.reduce((a, c) => a + keyZ(c), 0) / g.cells.length;
        const mid = [...g.cells].sort((a, b) => Math.hypot(keyX(a) - mx, keyZ(a) - mz) - Math.hypot(keyX(b) - mx, keyZ(b) - mz) || a - b).find((c) => clear.free(c, 'c'));
        if (mid !== undefined) add('scarecrow', { type: 'scarecrow', cell: mid, pos: 'c', params: { look: look('s') } });
      }
      const spot = outside[0];
      if (spot && (role === 'flower-garden' || role === 'herb-garden') && lucky(seed, RULE, first, 'hives', DEPTH.beehives)) {
        add('hives', { type: 'beehive', cell: spot.cell, pos: edgePos(spot.d), face: opposite(spot.d), params: { look: look('h') } });
      }
      if (spot && role === 'kitchen-garden' && lucky(seed, RULE, first, 'barrow', DEPTH.wheelbarrow)) {
        add('barrow', { type: 'wheelbarrow', cell: spot.cell, pos: edgePos(spot.d), params: { look: look('b') } });
      }
      if (role !== 'reed-bed' && role !== 'wheat-field' && lucky(seed, RULE, first, 'trellis', DEPTH.trellis)) {
        // The first garden cell (in key order) with a house wall right beside it.
        let wall: { cell: CellKey; d: Dir4 } | null = null;
        for (const c of g.edgeCells) {
          for (const d of DIRS) {
            const n = neighbor(c, d);
            if (n !== NO_CELL && occ.kindAt(n) === 'house' && clear.free(c, edgePos(d)) && !clear.doorFronts.has(c)) {
              wall = { cell: c, d };
              break;
            }
          }
          if (wall) break;
        }
        if (wall) add('trellis', { type: 'trellis', cell: wall.cell, pos: edgePos(wall.d), face: opposite(wall.d), params: { look: look('t'), face: opposite(wall.d) } });
      }
    }
    return out;
  },
  claims: (c) => [slot.floor(c.data.cell, c.data.pos)],
  apply: (c, out) => emit(out, [c.data]),
});
