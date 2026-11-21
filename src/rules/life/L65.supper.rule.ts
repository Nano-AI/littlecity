// L65 · tier 2 · A harvest supper. The town's biggest square (a plaza with a
// full 3 × 3) → posts `supper|table|<i>` on a straight run of SUPPER.tables
// (at least three) free cells through its middle, along its longer way: one
// trestle table a cell, end to end, `dir` pointing along the run; i counts
// from the run's start. Free: on the walking graph, not cluttered, not a
// doorstep, all at one level. src/life/town/chains/supper.ts holds the suppers.

import { key, keyX, keyY, keyZ, type CellKey } from '@/core/grid';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { plazas } from '@/resolve/facts/plazas.fact';
import { SUPPER } from '@/style/scenes';
import { navOf } from './people.lib';

/** Table cells a supper needs at least. */
export const SUPPER_MIN = 3;

type Data = { i: number; dir: 1 | 2 };

export default defineRule<Data>({
  id: 'L65.supper',
  part: 'life',
  tier: 2,
  priority: 410,
  townWide: true,
  about: 'Reads: squares, the walking graph, doors. Emits: errand sockets supper|table on a row of cells through the middle of the biggest square.',
  find(ctx) {
    const nav = navOf(ctx);
    if (!nav) return [];
    const doorsteps = new Set(nav.doors.filter((d) => d.node >= 0).map((d) => nav.nodes[d.node]!.cell));
    const free = (c: CellKey): boolean => {
      const n = nav.nodeAt.get(c);
      if (n === undefined || doorsteps.has(c)) return false;
      const node = nav.nodes[n]!;
      return !node.clutter && node.rot === undefined && node.passage === undefined && node.surface === 'plaza';
    };
    const square = [...plazas(ctx.facts).list].filter((p) => p.square).sort((a, b) => b.area - a.area || a.id - b.id)[0];
    if (!square) return [];
    const want = Math.max(SUPPER_MIN, Math.round(SUPPER.tables));
    const alongX = square.box.x1 - square.box.x0 >= square.box.z1 - square.box.z0;
    const mx = (square.box.x0 + square.box.x1) / 2, mz = (square.box.z0 + square.box.z1) / 2;
    const cells = new Set(square.cells);
    // Runs through cells near the middle, longest (up to `want`) and most central first.
    let best: { run: CellKey[]; score: number } | null = null;
    for (const c of square.cells) {
      for (let len = want; len >= SUPPER_MIN; len--) {
        const run: CellKey[] = [];
        for (let i = 0; i < len; i++) {
          const k = alongX ? key(keyX(c) + i, keyY(c), keyZ(c)) : key(keyX(c), keyY(c), keyZ(c) + i);
          if (!cells.has(k) || !free(k)) break;
          run.push(k);
        }
        if (run.length < len) continue;
        const cx = run.reduce((n, k) => n + keyX(k), 0) / len + 0.5, cz = run.reduce((n, k) => n + keyZ(k), 0) / len + 0.5;
        const score = len * 10 - Math.hypot(cx - mx - 0.5, cz - mz - 0.5);
        if (!best || score > best.score || (score === best.score && run[0]! < best.run[0]!)) best = { run, score };
        break;
      }
    }
    if (!best) return [];
    return best.run.map((cell, i) => ({ anchor: cell, key: `t${i}`, data: { i, dir: alongX ? 1 : 2 } })) satisfies Candidate<Data>[];
  },
  apply(c, out) {
    out.socket({ id: `L65.supper@${c.anchor}:${String(c.key)}`, type: 'errand', cell: c.anchor, dir: c.data.dir, name: `supper|table|${c.data.i}` });
  },
});
