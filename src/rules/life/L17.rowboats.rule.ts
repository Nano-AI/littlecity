// L17 · tier 1 · Moored rowboats ("Boats and ships": fit is the only test).
// Every dock or quay wall with a mooring a rowboat fits at gets one, up to
// one per BOATS.rowPerCells cells, tied to a mooring (the bollards J23 puts
// on docks, the rings R-M05 puts on quay walls). Docks are served in turn,
// one boat each before any gets a second, up to SHIPS.rowboatsMax in the
// town (a phone shows fewer: the `rank` param). A big ship coming in to a
// stretch with rowboats on it has them row aside (rowboat.behaviour.ts). The behaviour (src/life/boats) floats the
// boat off the mooring, lets it drift downwind and tugs it back on its line.
//
// A mooring is used only if a boat can lie there and could have got there:
// the column in front of it and the one beyond are open water, reachable
// from the edge of the map. Two boats never share the water: their
// moorings are at least two columns apart.

import { columnIndex, DIR4, keyX, keyZ, type CellKey, type Dir4 } from '@/core/grid';
import { hash, rand } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';
import type { Socket, StructureId } from '@/resolve/plan';
import { BOATS } from '@/style/boats';
import { freeWater } from '../roles/dock-shape';
import { SHIPS } from '@/style/ships';
import { edgeWater } from './berths.fact';

interface Berth {
  socket: string;
  /** The order it was chosen in town-wide: a phone shows only the first SHIPS.rowboatsPhone. */
  rank: number;
}

export default defineRule<Berth>({
  id: 'L17.rowboats',
  part: 'life',
  tier: 1,
  priority: 830,
  about: 'Reads: mooring sockets, their structures, open water in front of them. Claims: the mooring socket. Emits: one rowboat per dock or quay of 2+ cells, up to one per 3 cells.',
  find({ facts }) {
    const byStructure = new Map<StructureId, Socket[]>();
    const reach = edgeWater(facts);
    for (const s of socketsOfType(facts, 'mooring')) {
      if (s.structure === undefined || s.dir === undefined) continue;
      const [dx, dz] = DIR4[s.dir]!;
      const x = keyX(s.cell), z = keyZ(s.cell);
      // It fits: the water in front and the column beyond are open, and a boat could get there from the edge.
      if (!freeWater(facts, x + dx, z + dz) || !freeWater(facts, x + 2 * dx, z + 2 * dz)) continue;
      if (!reach[columnIndex(x + dx, z + dz)]) continue;
      const list = byStructure.get(s.structure);
      if (list) list.push(s);
      else byStructure.set(s.structure, [s]);
    }
    /** The water column each chosen boat lies in, town-wide: boats of two docks keep apart too. */
    const taken: [number, number][] = [];
    // Each dock's moorings in a seeded order, so which bollards have a boat is the town's own.
    const queues = [...byStructure.keys()].sort((a, b) => a - b).map((id) => {
      const structure = facts.structures.get(id)!;
      const moorings = byStructure.get(id)!;
      // A dock counts its own cells; a quay wall is a mass of marble, so it counts its moorings (one every second cell).
      const cells = structure.kind === 'dock' ? structure.cells.length : moorings.length * 2;
      const want = Math.max(1, Math.ceil(cells / Math.max(1, BOATS.rowPerCells)));
      const order = [...moorings].sort((a, b) => rand(facts.seed, 'L17', a.cell, a.dir!) - rand(facts.seed, 'L17', b.cell, b.dir!) || a.cell - b.cell);
      return { id, want, order, n: 0 };
    });
    // Round the docks one boat at a time, so every dock has one before any has two, up to the town's cap.
    const out: Candidate<Berth>[] = [];
    const cap = Math.max(0, Math.round(SHIPS.rowboatsMax));
    for (let more = true; more && out.length < cap; ) {
      more = false;
      for (const q of queues) {
        if (out.length >= cap) break;
        while (q.n < q.want && q.order.length) {
          const s = q.order.shift()!;
          const [dx, dz] = DIR4[s.dir as Dir4]!;
          const wx = keyX(s.cell) + dx, wz = keyZ(s.cell) + dz;
          if (taken.some(([tx, tz]) => Math.max(Math.abs(tx - wx), Math.abs(tz - wz)) < 2)) continue;
          taken.push([wx, wz]);
          out.push({ anchor: s.cell as CellKey, structure: q.id, key: `m${s.dir}`, data: { socket: s.id, rank: out.length } });
          q.n++;
          more = true;
          break;
        }
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
      params: { look: hash(ctx.seed, 'L17', 'look', c.anchor, c.key ?? 0) % 8, line: BOATS.line, rank: c.data.rank },
    });
  },
});
