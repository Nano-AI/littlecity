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

import { DIR4, keyY, opposite, CELL_H } from '@/core/grid';
import { rand } from '@/core/rand';
import { STALL } from '@/style/props';
import { CHAINS } from '@/style/town-life';
import type { Person } from '../../people/crowd';
import { wallSpots, type Board, type Chain, type Plan, type PlanStep, type Post, type Spot, type Store } from '../board';
import { canWork, keepHand, reaches, standAt } from '../hands';

interface Outlet {
  post: Post;
  store: Store;
  /** Buyers on their way to it now. */
  coming: number;
}

export function breadChain(): Chain {
  let mill: Post | undefined;
  let bakery: Post | undefined;
  let outlets: Outlet[] = [];
  let sacks: Store | null = null;
  let miller: Person | null = null;
  let baker: Person | null = null;
  let millAt = 0;
  let bakeAt = 0;

  /** Where the loaves lie at a selling place: on a stall's counter, or by a door. */
  const outletSpots = (board: Board, post: Post): Spot[] => {
    const out = opposite(post.dir ?? 0);
    const [fx, fz] = DIR4[out]!;
    if (post.ref === 'stall' && post.structure !== undefined) {
      const s = board.shape?.structures.get(post.structure);
      const cell = s?.cells[0];
      if (cell !== undefined) {
        const c = board.centre(cell);
        const y = keyY(cell) * CELL_H + STALL.counter;
        return [-0.24, 0, 0.24].map((side, i) => ({ x: c.x + fx * 0.3 - fz * side, y, z: c.z + fz * 0.3 + fx * side, yaw: Math.atan2(fx, fz) + Math.PI / 2 + i * 0.3 }));
      }
    }
    // By a door: the side away from where the sacks go.
    return wallSpots(post.cell, out, 6, board.centre(post.cell).y).slice(post.cell === bakery?.cell ? 3 : 0).slice(0, 3);
  };

  const chain: Chain = {
    id: 'bread',
    sync(board) {
      mill = board.posts('bread').find((p) => p.role === 'mill');
      bakery = board.posts('bread').find((p) => p.role === 'bakery');
      const sells = board.posts('bread').filter((p) => p.role === 'sell');
      const before = new Map(outlets.map((o) => [o.post.id, o]));
      outlets = sells.map((post) => ({ post, store: board.store(`bread:sell:${post.structure ?? post.cell}:${post.ref}`, outletSpots(board, post)), coming: before.get(post.id)?.coming ?? 0 }));
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
      return buyerPlan(board, p, time);
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
    const to = outlets
      .filter((o) => o.store.items.filter((x) => x === null).length >= Math.min(2, o.store.spots.length) && reaches(board, p, o.post.cell))
      .sort((x, y) => board.count(x.store) - board.count(y.store) || board.dist(x.post.cell, b.cell) - board.dist(y.post.cell, b.cell))[0];
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
    const at = standAt(board, to.post, to.post.ref === 'stall' ? 0.18 : 0.05);
    steps.push(
      bake,
      board.stepAt(to.post.cell, {
        ...at,
        pose: 'tend',
        linger: 1.4,
        load: 'tray',
        tag: 'bread:deliver',
        done: (q) => {
          let n = 0;
          for (let i = 0; i < CHAINS.tray; i++) if (board.put(to.store, 'loaf')) n++;
          if (n === 0) return false;
          q.load = null;
        },
      }),
      back,
    );
    return { chain, at: 0, steps };
  };

  const buyerPlan = (board: Board, p: Person, time: { phase: number; isDawn: boolean }): Plan | null => {
    const morning = time.isDawn || time.phase < 0.2;
    if (rand(p.seed, 'bread', p.trips) >= (morning ? CHAINS.buyMorning : CHAINS.buy)) return null;
    const here = p.cell;
    const to = outlets
      .filter((o) => board.count(o.store, 'loaf') > o.coming && board.dist(o.post.cell, here) <= CHAINS.buyReach && reaches(board, p, o.post.cell))
      .sort((x, y) => board.dist(x.post.cell, here) - board.dist(y.post.cell, here) || x.post.cell - y.post.cell)[0];
    if (!to) return null;
    const home = board.homeStep(p, { tag: 'bread:home', load: 'loaf' });
    if (!home) return null;
    to.coming++;
    let counted = true;
    const arrived = (): void => {
      if (counted) to.coming = Math.max(0, to.coming - 1);
      counted = false;
    };
    const side = (rand(p.seed, 'bread-side', p.trips) - 0.5) * 0.4;
    return {
      chain,
      at: 0,
      steps: [
        board.stepAt(to.post.cell, {
          ...standAt(board, to.post, to.post.ref === 'stall' ? 0.18 : 0.05, side),
          pose: 'chat',
          linger: 2.2,
          tag: 'bread:buy',
          done: (q) => {
            arrived();
            if (!board.take(to.store, 'loaf')) return false;
            q.load = 'loaf';
          },
        }),
        home,
      ],
      fail: arrived,
    };
  };

  return chain;
}
