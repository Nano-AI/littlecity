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

import { columnIndex, DIR4, inColumnBounds, keyX, keyY, keyZ, SIZE_X, SIZE_Z, type CellKey, type Dir4 } from '@/core/grid';
import { hash, rand } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';
import type { Socket, StructureId } from '@/resolve/plan';
import { BOATS } from '@/style/boats';
import { freeWater } from '../roles/dock-shape';
import { SHIPS } from '@/style/ships';
import { berthZones, edgeWater, shipLanes, zoneGap } from './berths.fact';
import { bargeRun, lowObstacles, riverWater } from './L41.river-barge.rule';

interface Berth {
  socket: string;
  /** The order it was chosen in town-wide: a phone shows only the first SHIPS.rowboatsPhone. */
  rank: number;
  /** Where it waits while a big ship takes its stretch of quay (a moored boat there has one; else NaN). */
  asideX: number;
  asideZ: number;
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
    // River people keep boats on their river even where a low bridge shuts it off from the sea.
    const river = riverWater(facts, lowObstacles(facts));
    // Not in the barge's way: a rowboat moored on its run in a narrow river would stop it.
    const run = bargeRun(facts);
    // Its run, longer at each end by the hull it carries past its middle there.
    const reachOut = (p: readonly number[], q: readonly number[]): [number, number] => {
      const l = Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!) || 1;
      return [p[0]! + ((p[0]! - q[0]!) / l) * 1.8, p[1]! + ((p[1]! - q[1]!) / l) * 1.8];
    };
    const runPts = run && run.route.length > 1 ? [reachOut(run.route[0]!, run.route[1]!), ...run.route, reachOut(run.route.at(-1)!, run.route.at(-2)!)] : [];
    const inRun = (x: number, z: number): boolean => {
      for (let i = 1; i < runPts.length; i++) {
        const a = runPts[i - 1]!, b = runPts[i]!;
        const ex = b[0] - a[0], ez = b[1] - a[1], l2 = ex * ex + ez * ez || 1;
        const t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / l2));
        if (Math.hypot(a[0] + ex * t - x, a[1] + ez * t - z) < 1.4) return true;
      }
      return false;
    };
    for (const s of socketsOfType(facts, 'mooring')) {
      if (s.structure === undefined || s.dir === undefined) continue;
      const [dx, dz] = DIR4[s.dir]!;
      const x = keyX(s.cell), z = keyZ(s.cell);
      // It fits: the water in front and the column beyond are open, and a boat could get there from the edge.
      if (!freeWater(facts, x + dx, z + dz) || !freeWater(facts, x + 2 * dx, z + 2 * dz)) continue;
      if (!reach[columnIndex(x + dx, z + dz)] && !river(x + dx, z + dz)) continue;
      if ([0.7, 1.1, 1.5].some((k) => inRun(x + dx * k + 0.5, z + dz * k + 0.5))) continue;
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
    // As many as the water by the docks holds without crowding: about one boat to every five open columns
    // within three of a dock (a narrow river or a little harbour gets fewer), up to the town's cap.
    const near = new Set<number>();
    for (const [c, k] of facts.kinds) {
      if (k !== 'dock' || keyY(c) !== 0) continue;
      for (let dz = -3; dz <= 3; dz++) {
        for (let dx = -3; dx <= 3; dx++) {
          const x = keyX(c) + dx, z = keyZ(c) + dz;
          if (freeWater(facts, x, z)) near.add(columnIndex(x, z));
        }
      }
    }
    const cap = Math.max(0, Math.min(Math.round(SHIPS.rowboatsMax), Math.floor(near.size / 5)));
    // A boat moored where a big ship berths needs a place of its own to wait in while the ship is in: open
    // water out of every berth, clear of the other boats and their places, that it can row to straight.
    const zones = berthZones(facts);
    // Nor in the ways the ships sail in and out.
    const inLane = shipLanes(facts);
    const places: [number, number][] = [];
    const rests: [number, number][] = [];
    const reachable = (x: number, z: number): boolean => inColumnBounds(x, z) && freeWater(facts, x, z) && (reach[columnIndex(x, z)] === 1 || river(x, z));
    const apart = (x: number, z: number, d: number): boolean => places.every(([px, pz]) => Math.hypot(px - x, pz - z) >= d) && rests.every(([px, pz]) => Math.hypot(px - x, pz - z) >= d);
    const placeFor = (wx: number, wz: number, rx: number, rz: number): [number, number] | null => {
      const found: [number, number, number][] = [];
      for (let dz = -8; dz <= 8; dz++) {
        for (let dx = -8; dx <= 8; dx++) {
          const cx = wx + dx, cz = wz + dz;
          if (cx < 1 || cz < 1 || cx > SIZE_X - 2 || cz > SIZE_Z - 2 || !reachable(cx, cz)) continue;
          const px = cx + 0.5, pz = cz + 0.5;
          if (zones.some((s) => zoneGap(s, px, pz) < 0.55) || inRun(px, pz) || !apart(px, pz, 1.4) || inLane(px, pz)) continue;
          found.push([Math.hypot(px - rx, pz - rz), px, pz]);
        }
      }
      found.sort((a, b) => a[0] - b[0]);
      for (const [d, px, pz] of found) {
        // Rowed to straight over open water.
        let ok = true;
        for (let t = 0; t <= d && ok; t += 0.2) ok = freeWater(facts, Math.floor(rx + ((px - rx) * t) / d), Math.floor(rz + ((pz - rz) * t) / d));
        if (ok) return [px, pz];
      }
      return null;
    };
    for (let more = true; more && out.length < cap; ) {
      more = false;
      for (const q of queues) {
        if (out.length >= cap) break;
        while (q.n < q.want && q.order.length) {
          const s = q.order.shift()!;
          const [dx, dz] = DIR4[s.dir as Dir4]!;
          const wx = keyX(s.cell) + dx, wz = keyZ(s.cell) + dz;
          if (taken.some(([tx, tz]) => Math.max(Math.abs(tx - wx), Math.abs(tz - wz)) < 2)) continue;
          // Where it lies at rest: just off the face, bow out.
          const rx = wx + 0.5 + dx * 0.1, rz = wz + 0.5 + dz * 0.1;
          if (!apart(rx, rz, 1.4)) continue;
          let place: [number, number] | null = null;
          if (zones.some((z) => [-0.4, 0, 0.4].some((k) => zoneGap(z, rx + dx * k, rz + dz * k) < 0.3))) {
            place = placeFor(wx, wz, rx, rz);
            if (!place) continue;
            places.push(place);
          }
          rests.push([rx, rz]);
          taken.push([wx, wz]);
          out.push({ anchor: s.cell as CellKey, structure: q.id, key: `m${s.dir}`, data: { socket: s.id, rank: out.length, asideX: place ? place[0] : NaN, asideZ: place ? place[1] : NaN } });
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
      params: {
        look: hash(ctx.seed, 'L17', 'look', c.anchor, c.key ?? 0) % 8,
        line: BOATS.line,
        rank: c.data.rank,
        ...(Number.isFinite(c.data.asideX) ? { asideX: c.data.asideX, asideZ: c.data.asideZ } : {}),
      },
    });
  },
});
