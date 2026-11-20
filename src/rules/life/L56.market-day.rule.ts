// L56 · tier 2 · Market day (discovery LF-02). The town's biggest square (a
// plaza with a full 3 × 3) that has two or more stalls on it or beside it
// keeps a market. Posts:
//
//   market|pitch|<goods>   where a market day's stall goes up: open plaza
//                          cells (not cluttered, not a doorstep, not beside
//                          a stall or a fountain), at least three steps
//                          apart, one per 6 cells of the square, at most 4;
//                          `dir` the way the stall faces (toward the
//                          middle of the square)
//   market|busk|           the busker's spot, near the middle
//
// src/life/town/chains/market.ts holds the market on seeded mornings.

import { DIR4, key, keyX, keyY, keyZ, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { GOODS } from '@/rules/roles/ground-props';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { plazas } from '@/resolve/facts/plazas.fact';
import { navOf, steps } from './people.lib';

export const MARKET_PITCHES = 4;

interface Data {
  role: 'pitch' | 'busk';
  dir?: Dir4;
  goods: string;
}

export default defineRule<Data>({
  id: 'L56.market-day',
  part: 'life',
  tier: 2,
  priority: 440,
  townWide: true,
  about: 'Reads: plazas, stalls, fountains, doors, the walking graph. Emits: errand sockets market|pitch and market|busk on the biggest square with two stalls.',
  find(ctx) {
    const nav = navOf(ctx);
    if (!nav) return [];
    const { facts, seed } = ctx;
    const standing = (c: CellKey): string | undefined => {
      const s = facts.structureAt.get(c);
      return s !== undefined ? facts.structures.get(s)?.kind : undefined;
    };
    const near = (c: CellKey, kinds: string[]): boolean => {
      for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
        const n = neighbor(c, d);
        if (n !== NO_CELL && kinds.includes(standing(n) ?? '')) return true;
      }
      for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) if (kinds.includes(standing(key(keyX(c) + dx, keyY(c), keyZ(c) + dz)) ?? '')) return true;
      return false;
    };
    const square = [...plazas(facts).list]
      .filter((p) => p.square && p.cells.filter((c) => near(c, ['stall']) || standing(c) === 'stall').length > 0)
      .filter((p) => new Set(p.cells.flatMap((c) => [c, ...([0, 1, 2, 3] as Dir4[]).map((d) => neighbor(c, d))]).filter((c) => standing(c) === 'stall')).size >= 2)
      .sort((a, b) => b.area - a.area || a.id - b.id)[0];
    if (!square) return [];
    const doorsteps = new Set(nav.doors.filter((d) => d.node >= 0).map((d) => nav.nodes[d.node]!.cell));
    const cx = square.cells.reduce((a, c) => a + keyX(c), 0) / square.cells.length;
    const cz = square.cells.reduce((a, c) => a + keyZ(c), 0) / square.cells.length;
    const open = square.cells.filter((c) => {
      const node = nav.nodeAt.get(c);
      return node !== undefined && !nav.nodes[node]!.clutter && !doorsteps.has(c) && standing(c) === undefined && !near(c, ['stall', 'fountain', 'tree']);
    });
    // Pitches: seeded order, kept at least three steps apart.
    const order = [...open].sort((a, b) => hash(seed, 'pitch', a) - hash(seed, 'pitch', b) || a - b);
    const pitches: CellKey[] = [];
    const want = Math.min(MARKET_PITCHES, Math.floor(square.area / 6));
    for (const c of order) {
      if (pitches.length >= want) break;
      if (pitches.every((p) => steps(p, c) >= 3)) pitches.push(c);
    }
    if (pitches.length === 0) return [];
    const out: Candidate<Data>[] = pitches.map((c, i) => {
      // Facing the middle of the square.
      const dx = cx - keyX(c), dz = cz - keyZ(c);
      let dir: Dir4 = 2;
      let best = -Infinity;
      for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
        const s = dx * DIR4[d]![0] + dz * DIR4[d]![1];
        const front = neighbor(c, d);
        if (s > best && front !== NO_CELL && nav.nodeAt.has(front)) {
          best = s;
          dir = d;
        }
      }
      return { anchor: c, key: `pitch${i}`, data: { role: 'pitch', dir, goods: GOODS[(hash(seed, 'market-goods', c) >>> 0) % GOODS.length]! } };
    });
    const busk = open.filter((c) => !pitches.includes(c) && pitches.every((p) => steps(p, c) >= 2)).sort((a, b) => Math.hypot(keyX(a) - cx, keyZ(a) - cz) - Math.hypot(keyX(b) - cx, keyZ(b) - cz) || a - b)[0];
    if (busk !== undefined) out.push({ anchor: busk, key: 'busk', data: { role: 'busk', goods: '' } });
    return out;
  },
  apply(c, out) {
    const d = c.data;
    out.socket({ id: `L56.market-day@${c.anchor}:${String(c.key)}`, type: 'errand', cell: c.anchor, ...(d.dir !== undefined ? { dir: d.dir } : {}), name: `market|${d.role}|${d.goods}` });
  },
});
