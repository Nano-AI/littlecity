// L17 · tier 1 · Moored rowboats. One per pier or quay of 2+ cells, up to
// one per 3 cells, tied to a mooring (the bollards J23 puts on docks, the
// rings R-M05 puts on quay walls). The behaviour (src/life/boats) floats the
// boat off the mooring, lets it drift downwind and tugs it back on its line.
//
// A mooring is used only if a boat can lie there: the column in front of it
// and the one beyond are open water. Two boats never share the water: their
// moorings are at least two columns apart.

import { DIR4, keyX, keyZ, type CellKey, type Dir4 } from '@/core/grid';
import { hash, rand } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';
import type { Socket, StructureId } from '@/resolve/plan';
import { BOATS } from '@/style/boats';
import { freeWater } from '../roles/dock-shape';

interface Berth {
  socket: string;
}

export default defineRule<Berth>({
  id: 'L17.rowboats',
  part: 'life',
  tier: 1,
  priority: 830,
  about: 'Reads: mooring sockets, their structures, open water in front of them. Claims: the mooring socket. Emits: one rowboat per dock or quay of 2+ cells, up to one per 3 cells.',
  find({ facts }) {
    const byStructure = new Map<StructureId, Socket[]>();
    for (const s of socketsOfType(facts, 'mooring')) {
      if (s.structure === undefined || s.dir === undefined) continue;
      const [dx, dz] = DIR4[s.dir]!;
      const x = keyX(s.cell), z = keyZ(s.cell);
      if (!freeWater(facts, x + dx, z + dz) || !freeWater(facts, x + 2 * dx, z + 2 * dz)) continue;
      const list = byStructure.get(s.structure);
      if (list) list.push(s);
      else byStructure.set(s.structure, [s]);
    }
    const out: Candidate<Berth>[] = [];
    /** The water column each chosen boat lies in, town-wide: boats of two docks keep apart too. */
    const taken: [number, number][] = [];
    for (const id of [...byStructure.keys()].sort((a, b) => a - b)) {
      const structure = facts.structures.get(id);
      if (!structure) continue;
      const moorings = byStructure.get(id)!;
      // A dock counts its own cells; a quay wall is a mass of marble, so it counts its moorings (one every second cell).
      const cells = structure.kind === 'dock' ? structure.cells.length : moorings.length * 2;
      if (cells < BOATS.rowMinCells) continue;
      const want = Math.max(1, Math.floor(cells / Math.max(1, BOATS.rowPerCells)));
      // Seeded order, so which bollards have a boat is the town's own and does not follow build order.
      const order = [...moorings].sort((a, b) => rand(facts.seed, 'L17', a.cell, a.dir!) - rand(facts.seed, 'L17', b.cell, b.dir!) || a.cell - b.cell);
      let n = 0;
      for (const s of order) {
        if (n >= want) break;
        const [dx, dz] = DIR4[s.dir as Dir4]!;
        const wx = keyX(s.cell) + dx, wz = keyZ(s.cell) + dz;
        if (taken.some(([tx, tz]) => Math.max(Math.abs(tx - wx), Math.abs(tz - wz)) < 2)) continue;
        taken.push([wx, wz]);
        out.push({ anchor: s.cell as CellKey, structure: id, key: `m${s.dir}`, data: { socket: s.id } });
        n++;
      }
    }
    return out;
  },
  claims: (c) => [slot.socket(c.data.socket)],
  apply(c, out, ctx) {
    out.actor({
      type: 'rowboat',
      at: { socket: c.data.socket },
      home: c.structure,
      params: { look: hash(ctx.seed, 'L17', 'look', c.anchor, c.key ?? 0) % 8, line: BOATS.line },
    });
  },
});
