// L20 · tier 3 · The rower (town-wide; "Boats and ships": no conditions but
// fit). Any two docks with open water beside them and a way between them by
// water share a rowboat with someone at the oars: it waits off one and now
// and then, by day, rows across to the other (src/life/boats/rower.behaviour.ts),
// along a route that keeps to open water (waterway.ts).
//
// Each dock has at most one rower, and the town at most ROWERS_MAX. Pairs
// are taken shortest crossing first (ties: the lower dock ids), skipping
// pairs so close they are one harbour wall (under ROWER_MIN_APART).
//
// A boat waits in the open water off its dock: off a pier's end if it has
// one (straight out, or beside it on the ladder's side), else beside the
// dock cell with the most open water round it.
//
// Reads: dock structures, pier-head features (R-D02), open water. Claims:
// each dock's rower.

import { columnIndex, DIR4, key, keyX, keyY, keyZ, turn, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { featuresOfType, socketsOfType } from '@/resolve/facts/plan-index.fact';
import type { StructureId } from '@/resolve/plan';
import { freeWater } from '../roles/dock-shape';
import { ladderSide } from '../roles/R-D02.pier.rule';
import { berthZones, edgeWater, shipLanes, zoneGap } from './berths.fact';
import { bargeRun } from './L41.river-barge.rule';
import { routeLength, waterMask, waterRoute } from './waterway';

/** Docks closer than this (in columns) have no rower between them: it would be a step, not a crossing. */
export const ROWER_MIN_APART = 4;
/** Rowers in the town, at most. */
export const ROWERS_MAX = 2;

interface Crossing {
  a: StructureId;
  b: StructureId;
  ax: number;
  az: number;
  bx: number;
  bz: number;
}

export default defineRule<Crossing>({
  id: 'L20.rower',
  part: 'life',
  tier: 3,
  priority: 800,
  townWide: true,
  about: 'Reads: dock structures, pier-head features, open water between docks. Claims: each dock’s rower. Emits: a rower between two docks joined by open water (at most two in the town).',
  find({ facts }) {
    const ends: { pier: StructureId; x: number; z: number; wx: number; wz: number }[] = [];
    // It waits where nothing else lies or comes: out of the big ships' berths and the ways they sail, off
    // every mooring a rowboat may lie at (L17), and off the barge's run (L41).
    const zones = berthZones(facts);
    const inLane = shipLanes(facts);
    const rests = socketsOfType(facts, 'mooring')
      .filter((m) => m.dir !== undefined)
      .map((m) => [keyX(m.cell) + DIR4[m.dir as Dir4]![0] * 1.1 + 0.5, keyZ(m.cell) + DIR4[m.dir as Dir4]![1] * 1.1 + 0.5] as const);
    const run = bargeRun(facts)?.route ?? [];
    const free = (wx: number, wz: number): boolean =>
      zones.every((s) => zoneGap(s, wx, wz) > 0.8) &&
      !inLane(wx, wz) &&
      rests.every(([x, z]) => Math.hypot(x - wx, z - wz) > 1.4) &&
      run.every(([x, z]) => Math.hypot(x - wx, z - wz) > 1.6);
    for (const head of featuresOfType(facts, 'pier-head')) {
      if (head.cell === undefined || head.dir === undefined) continue;
      const x = keyX(head.cell), z = keyZ(head.cell);
      const seaward = head.dir as Dir4;
      const sides: Dir4[] = [seaward, ladderSide(seaward), turn(ladderSide(seaward), 2)];
      const side = sides.find((d) => freeWater(facts, x + DIR4[d]![0], z + DIR4[d]![1]) && free(x + DIR4[d]![0] + 0.5, z + DIR4[d]![1] + 0.5));
      if (side === undefined) continue;
      ends.push({ pier: head.structure, x, z, wx: x + DIR4[side]![0] + 0.5, wz: z + DIR4[side]![1] + 0.5 });
    }
    // Every other dock (a quay, a jetty): the water beside its cell with the most open water round it.
    const reach = edgeWater(facts);
    for (const st of [...facts.structures.values()].filter((s) => s.kind === 'dock').sort((a, b) => a.id - b.id)) {
      if (ends.some((e) => e.pier === st.id)) continue;
      let best: (typeof ends)[number] | null = null;
      let room = -1;
      for (const c of st.cells) {
        if (keyY(c) !== 0) continue;
        const x = keyX(c), z = keyZ(c);
        for (const [dx, dz] of DIR4) {
          if (!freeWater(facts, x + dx, z + dz) || !reach[columnIndex(x + dx, z + dz)] || !free(x + dx + 0.5, z + dz + 0.5)) continue;
          let wet = 0;
          for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (freeWater(facts, x + dx * 2 + i, z + dz * 2 + j)) wet++;
          if (wet > room) {
            room = wet;
            best = { pier: st.id, x, z, wx: x + dx + 0.5, wz: z + dz + 0.5 };
          }
        }
      }
      if (best) ends.push(best);
    }
    if (ends.length < 2) return [];
    ends.sort((p, q) => p.pier - q.pier);
    const water = waterMask(facts);
    // Nearest pairs first (by the straight distance between them); a route by water is worked out only for
    // the pairs that are tried, so a big harbour does not cost a route for every pair of docks.
    const near: { i: number; j: number; d: number }[] = [];
    for (let i = 0; i < ends.length; i++) {
      for (let j = i + 1; j < ends.length; j++) {
        const p = ends[i]!, q = ends[j]!;
        const d = Math.hypot(p.x - q.x, p.z - q.z);
        if (p.pier !== q.pier && d >= ROWER_MIN_APART) near.push({ i, j, d });
      }
    }
    near.sort((a, b) => a.d - b.d || a.i - b.i || a.j - b.j);
    const pairs: { i: number; j: number; len: number }[] = [];
    const tried = new Set<number>();
    for (const { i, j } of near) {
      if (pairs.length >= ROWERS_MAX * 3 || tried.size > 40) break;
      if (pairs.some((x) => x.i === i || x.j === i || x.i === j || x.j === j)) continue;
      tried.add(i * 1000 + j);
      const p = ends[i]!, q = ends[j]!;
      const route = waterRoute(water, [p.wx, p.wz], [q.wx, q.wz]);
      if (route) pairs.push({ i, j, len: routeLength(route) });
    }
    pairs.sort((p, q) => p.len - q.len || p.i - q.i || p.j - q.j);
    const used = new Set<number>();
    const out: Candidate<Crossing>[] = [];
    for (const { i, j } of pairs) {
      if (out.length >= ROWERS_MAX) break;
      if (used.has(i) || used.has(j)) continue;
      used.add(i).add(j);
      const p = ends[i]!, q = ends[j]!;
      out.push({
        anchor: key(p.x, 0, p.z),
        structure: p.pier,
        key: `to${q.pier}`,
        data: { a: p.pier, b: q.pier, ax: p.wx, az: p.wz, bx: q.wx, bz: q.wz },
      });
    }
    return out;
  },
  claims: (c) => [slot.custom('L20', 'pier', c.data.a), slot.custom('L20', 'pier', c.data.b)],
  apply(c, out, ctx) {
    const d = c.data;
    out.actor({ type: 'rower', at: null, home: d.a, params: { look: hash(ctx.seed, 'L20', 'look', d.a) % 8, ax: d.ax, az: d.az, bx: d.bx, bz: d.bz } });
  },
});
