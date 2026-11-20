// L51 · Bread, from the mill to the table (posts from L51.bread.rule.ts).
//
//   the miller   goes into the windmill, comes out with a sack of flour on
//                their chest, walks it to the bakery and sets it down by the
//                door, where the sacks stack up (at most CHAINS.sacks)
//   the baker    picks up a sack by the door, takes it in, bakes (a few
//                seconds inside), comes out with a tray of loaves, walks it
//                to the stall (or inn, or café) with the most room and sets
//                the loaves out on the counter or by the door; then back in
//   residents    now and then (more in the mornings) walk to a place with
//                loaves, stop at the counter, and walk home with a loaf
//                under the arm; the loaves on the counter go down one by one
//
// Degrades as the rule does: no mill, the baker bakes without fetching a
// sack; a place erased mid-walk, the carrier takes what they hold home.

import { opposite } from '@/core/grid';
import { CHAINS } from '@/style/town-life';
import type { Person } from '../../people/crowd';
import { wallSpots, type Board, type Chain, type Plan, type PlanStep, type Post, type Store } from '../board';
import { canWork, keepHand, standAt } from '../hands';
import { buyerPlan, deliverStep, morning, outletsOf, roomiest, type Outlet } from '../market';

export function breadChain(): Chain {
  let mill: Post | undefined;
  let bakery: Post | undefined;
  let outlets: Outlet[] = [];
  let sacks: Store | null = null;
  let miller: Person | null = null;
  let baker: Person | null = null;
  let millAt = 0;
  let bakeAt = 0;

  const chain: Chain = {
    id: 'bread',
    sync(board) {
      mill = board.posts('bread').find((p) => p.role === 'mill');
      bakery = board.posts('bread').find((p) => p.role === 'bakery');
      // At the bakery's own door the loaves go on the far side from the sacks.
      outlets = outletsOf(board, 'bread', outlets, (post) => (post.cell === bakery?.cell ? 3 : 0));
      sacks = bakery && mill ? board.store(`bread:sacks:${bakery.structure}`, wallSpots(bakery.cell, opposite(bakery.dir ?? 0), CHAINS.sacks, board.centre(bakery.cell).y)) : null;
      if (!bakery) {
        if (miller) board.unclaim(miller);
        if (baker) board.unclaim(baker);
        miller = baker = null;
        return;
      }
      const b = bakery;
      baker = keepHand(board, chain, baker, b.cell, (p) => (p.work?.job === 'baker' && p.work.structure === b.structure) || p.home === b.structure);
      if (mill) {
        const m = mill;
        miller = keepHand(board, chain, miller, m.cell, (p) => p.work?.job === 'miller');
      } else if (miller) {
        board.unclaim(miller);
        miller = null;
      }
    },
    step(_dt, _time, board) {
      // Hands lost (gone, moved out of reach) are found again at the next change of the town; meanwhile a
      // hand that has gone is let go.
      if (miller && miller.mode === 'gone') miller = null;
      if (baker && baker.mode === 'gone') baker = null;
      void board;
    },
    offer(p, time, board) {
      if (!bakery || !(time.isDay || time.isDawn)) return null;
      const b = bakery;
      if (p === miller && mill && sacks) return millerPlan(board, p, mill, b, sacks);
      if (p === baker) return bakerPlan(board, p, b);
      if (board.claimedBy(p) || !canWork(p)) return null;
      return buyerPlan(board, chain, p, outlets, 'loaf', morning(time) ? CHAINS.buyMorning : CHAINS.buy, CHAINS.buyReach, 'bread:buy');
    },
  };

  const millerPlan = (board: Board, p: Person, m: Post, b: Post, store: Store): Plan | null => {
    if (board.now < millAt || board.count(store) >= store.spots.length) return null;
    const fill = board.stepIn(m.structure!, { cell: m.cell, linger: 3, tag: 'bread:fill' });
    if (!fill) return null;
    millAt = board.now + CHAINS.millGap;
    const at = standAt(board, b, 0.05);
    return {
      chain,
      at: 0,
      steps: [
        fill,
        board.stepAt(b.cell, {
          ...at,
          pose: 'tend',
          linger: 1.2,
          load: 'sack',
          tag: 'bread:sack',
          done: (q) => {
            if (!board.put(store, 'sack')) return false;
            q.load = null;
          },
        }),
      ],
    };
  };

  const bakerPlan = (board: Board, p: Person, b: Post): Plan | null => {
    if (board.now < bakeAt) return null;
    // Where the tray goes: the place with the most room, then the nearest.
    const to = roomiest(board, p, outlets, b.cell);
    if (!to) return null;
    const steps: PlanStep[] = [];
    if (sacks) {
      if (board.count(sacks, 'sack') === 0) return null;
      const store = sacks;
      steps.push(
        board.stepAt(b.cell, {
          ...standAt(board, b, 0.05),
          pose: 'tend',
          linger: 1,
          tag: 'bread:lift',
          done: (q) => {
            if (!board.take(store, 'sack')) return false;
            q.load = 'sack';
          },
        }),
      );
    }
    const bake = board.stepIn(b.structure!, { cell: b.cell, linger: CHAINS.bake, load: sacks ? 'sack' : null, tag: 'bread:bake', done: (q) => void (q.load = null) });
    const back = board.stepIn(b.structure!, { cell: b.cell, linger: 3, tag: 'bread:back' });
    if (!bake || !back) return null;
    bakeAt = board.now + CHAINS.bakeGap;
    steps.push(bake, deliverStep(board, to, 'tray', 'loaf', CHAINS.tray, 'bread:deliver'), back);
    return { chain, at: 0, steps };
  };

  return chain;
}
