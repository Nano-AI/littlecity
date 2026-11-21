// The raid's chain on the living town's board (design section 13b): it holds
// the raiders ashore (they are claimed by it, so no other chain takes them),
// gives them their plans (the charge, the brands, the looting, back to the
// boats), sends the town's people running, and keeps the loot piles. The raid
// itself (raid.ts) decides; this only connects it to the board.

import type { Board, Chain } from '../town/board';
import type { Load } from '../people/errand';
import { raidsOf } from './raids';

export function raidChain(): Chain {
  const chain: Chain = {
    id: 'raid',
    sync(board: Board) {
      if (!board.stage) return;
      const raids = raidsOf(board.stage);
      raids.board = board;
      // The piles are claimed again at every change of the town (a store nobody claims is cleared away).
      const raid = raids.current;
      if (raid && !raid.ended) for (const p of raid.piles) board.store(p.key, p.spots);
    },
    offer(p, _time, board) {
      if (!p.raider || !board.stage) return null;
      const raid = raidsOf(board.stage).current;
      return raid && !raid.ended ? raid.offer(p, board, chain) : null;
    },
    keeps: (_load: Load) => true,
    step(dt, time, board) {
      if (!board.stage) return;
      const raids = raidsOf(board.stage);
      raids.board = board;
      const raid = raids.current;
      if (raid && !raid.ended) raid.stepLand(dt, board, time, chain.id, chain);
    },
  };
  return chain;
}
