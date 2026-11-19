// L20 · tier 3 · The rower (town-wide). Two piers whose ends are 10 or more
// columns apart, with a way between them through open water, share a
// rowboat with someone at the oars: it waits off one pier end and now and
// then, by day, rows across to the other (src/life/boats/rower.behaviour.ts),
// along a route that keeps to open water (waterway.ts).
//
// Each pier has at most one rower. Pairs are taken shortest crossing first
// (ties: the lower pier ids), so a town with many piers gets several rowers,
// each between near neighbours.
//
// A boat waits in the open-water column straight out from the pier's end, or
// failing that beside the end (the ladder's side first). A pier end with no
// open water round it has no rower.
//
// Reads: pier-head features (R-D02), open water. Claims: each pier's rower.

import { DIR4, key, keyX, keyZ, turn, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { featuresOfType } from '@/resolve/facts/plan-index.fact';
import type { StructureId } from '@/resolve/plan';
import { freeWater } from '../roles/dock-shape';
import { ladderSide } from '../roles/R-D02.pier.rule';
import { routeLength, waterMask, waterRoute } from './waterway';

/** Pier ends closer than this (in columns) have no rower between them. */
export const ROWER_MIN_APART = 10;

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
  about: 'Reads: pier-head features, open water between pier ends. Claims: each pier’s rower. Emits: a rower between two piers 10+ apart joined by open water.',
  find({ facts }) {
    const ends: { pier: StructureId; x: number; z: number; wx: number; wz: number }[] = [];
    for (const head of featuresOfType(facts, 'pier-head')) {
      if (head.cell === undefined || head.dir === undefined) continue;
      const x = keyX(head.cell), z = keyZ(head.cell);
      const seaward = head.dir as Dir4;
      const sides: Dir4[] = [seaward, ladderSide(seaward), turn(ladderSide(seaward), 2)];
      const side = sides.find((d) => freeWater(facts, x + DIR4[d]![0], z + DIR4[d]![1]));
      if (side === undefined) continue;
      ends.push({ pier: head.structure, x, z, wx: x + DIR4[side]![0] + 0.5, wz: z + DIR4[side]![1] + 0.5 });
    }
    if (ends.length < 2) return [];
    ends.sort((p, q) => p.pier - q.pier);
    const water = waterMask(facts);
    const pairs: { i: number; j: number; len: number }[] = [];
    for (let i = 0; i < ends.length; i++) {
      for (let j = i + 1; j < ends.length; j++) {
        const p = ends[i]!, q = ends[j]!;
        if (p.pier === q.pier || Math.hypot(p.x - q.x, p.z - q.z) < ROWER_MIN_APART) continue;
        const route = waterRoute(water, [p.wx, p.wz], [q.wx, q.wz]);
        if (route) pairs.push({ i, j, len: routeLength(route) });
      }
    }
    pairs.sort((p, q) => p.len - q.len || p.i - q.i || p.j - q.j);
    const used = new Set<number>();
    const out: Candidate<Crossing>[] = [];
    for (const { i, j } of pairs) {
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
