// L52 · Water: now and then a resident who lives near a well, basin or
// fountain walks there, bends to fill a bucket (it appears in their hand),
// and carries it home, the pail swinging at their side. One at a time at
// each post.

import { rand } from '@/core/rand';
import { WATER_REACH } from '@/rules/life/L52.water.rule';
import { CHAINS } from '@/style/town-life';
import type { Person } from '../../people/crowd';
import type { Chain, Plan, Post } from '../board';
import { canWork, homeCell, reaches, standAt } from '../hands';

export function waterChain(): Chain {
  let wells: Post[] = [];
  /** Who is on the way to (or at) each post. */
  const at = new Map<string, Person>();
  const chain: Chain = {
    id: 'water',
    sync(board) {
      wells = [...board.posts('water')];
      for (const [id, p] of at) if (!wells.some((w) => w.id === id) || !board.plans.has(p)) at.delete(id);
    },
    offer(p, time, board) {
      if (wells.length === 0 || !canWork(p) || board.claimedBy(p) || !(time.isDay || time.isDawn)) return null;
      if (rand(p.seed, 'water', p.trips) >= CHAINS.water) return null;
      const home = homeCell(board, p);
      if (home === null) return null;
      let best: Post | null = null;
      for (const w of wells) {
        const holder = at.get(w.id);
        if (holder && board.plans.get(holder)?.chain === chain) continue;
        if (board.dist(w.cell, home) > WATER_REACH || !reaches(board, p, w.cell)) continue;
        if (!best || board.dist(w.cell, home) < board.dist(best.cell, home) || (board.dist(w.cell, home) === board.dist(best.cell, home) && w.id < best.id)) best = w;
      }
      if (!best) return null;
      const well = best;
      at.set(well.id, p);
      const stand = standAt(board, well, 0.24);
      const home_ = board.homeStep(p, { tag: 'water:home', load: 'bucket' });
      if (!home_) return null;
      const plan: Plan = {
        chain,
        at: 0,
        steps: [
          board.stepAt(well.cell, {
            ...stand,
            pose: 'tend',
            linger: CHAINS.fill,
            tag: 'water:fill',
            done: (q) => {
              q.load = 'bucket';
              at.delete(well.id);
            },
          }),
          home_,
        ],
        fail: () => at.delete(well.id),
      };
      return plan;
    },
  };
  return chain;
}

