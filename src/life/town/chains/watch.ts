// L55 · The night watchman (posts from L55.watchman.rule.ts). At night one
// resident takes up a lantern on a pole and walks the beat in order, stopping
// at each post to hold the lantern up and look about, round and round until
// dawn, then home. The lantern glows (a lit surface), so the round is seen
// as a light going about the dark town.

import { rand } from '@/core/rand';
import { CHAINS } from '@/style/town-life';
import type { Person } from '../../people/crowd';
import type { Chain, PlanStep, Post } from '../board';
import { keepHand } from '../hands';

export function watchChain(): Chain {
  let beats: Post[] = [];
  let watchman: Person | null = null;
  let rounds = 0;
  const chain: Chain = {
    id: 'watch',
    sync(board) {
      beats = board
        .posts('watch')
        .filter((p) => p.role === 'beat')
        .sort((a, b) => Number(a.ref) - Number(b.ref));
      if (beats.length === 0) {
        if (watchman) board.unclaim(watchman);
        watchman = null;
        return;
      }
      // Somebody with no job of their own, living near the start of the beat.
      watchman = keepHand(board, chain, watchman, beats[0]!.cell, (p) => p.work === null);
    },
    offer(p, time, board) {
      if (p !== watchman || beats.length === 0 || !time.isNight) return null;
      rounds++;
      const steps: PlanStep[] = beats.map((b, i) => {
        const c = board.centre(b.cell);
        const r = (what: string): number => rand(p.seed, 'beat', what, rounds, i);
        return board.stepAt(b.cell, {
          spot: { x: c.x + (r('x') - 0.5) * 0.3, z: c.z + (r('z') - 0.5) * 0.3 },
          face: r('face') * Math.PI * 2,
          pose: 'look',
          linger: CHAINS.watchStop,
          load: 'lantern',
          tag: `watch:beat${i}`,
          done: (q) => void (q.load = 'lantern'),
        });
      });
      const home = board.homeStep(p, { tag: 'watch:home', load: 'lantern' });
      if (home) steps.push(home);
      return { chain, at: 0, steps };
    },
  };
  return chain;
}
