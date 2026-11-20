// Selling places shared by the chains: where goods lie at a stall's counter
// or by a door, and the resident who comes to buy one and carries it home.

import { CELL_H, DIR4, keyY, opposite } from '@/core/grid';
import { rand } from '@/core/rand';
import type { TimeSignal } from '@/life/api';
import { STALL } from '@/style/props';
import type { Person } from '../people/crowd';
import type { Load } from '../people/errand';
import { wallSpots, type Board, type Chain, type Plan, type Post, type Spot, type Store } from './board';
import { reaches, standAt } from './hands';

export interface Outlet {
  post: Post;
  store: Store;
  /** Buyers on their way to it now. */
  coming: number;
}

/** Where goods lie at a selling post: on a stall's counter (ref 'stall'), or against the wall by a door. `skip` wall spots first. */
export function outletSpots(board: Board, post: Post, skip = 0): Spot[] {
  const out = opposite(post.dir ?? 0);
  const [fx, fz] = DIR4[out]!;
  if (post.ref === 'stall' && post.structure !== undefined) {
    const cell = board.shape?.structures.get(post.structure)?.cells[0];
    if (cell !== undefined) {
      const c = board.centre(cell);
      const y = keyY(cell) * CELL_H + STALL.counter;
      return [-0.24, 0, 0.24].map((side, i) => ({ x: c.x + fx * 0.3 - fz * side, y, z: c.z + fz * 0.3 + fx * side, yaw: Math.atan2(fx, fz) + Math.PI / 2 + i * 0.3 }));
    }
  }
  return wallSpots(post.cell, out, 3 + skip, board.centre(post.cell).y).slice(skip, skip + 3);
}

/** The outlets of a chain's `sell` posts, keeping who was on the way across a change of the town. */
export function outletsOf(board: Board, chain: string, before: readonly Outlet[], skipAt?: (post: Post) => number): Outlet[] {
  const was = new Map(before.map((o) => [o.post.id, o]));
  return board
    .posts(chain)
    .filter((p) => p.role === 'sell')
    .map((post) => ({ post, store: board.store(`${chain}:sell:${post.structure ?? post.cell}:${post.ref}`, outletSpots(board, post, skipAt?.(post) ?? 0)), coming: was.get(post.id)?.coming ?? 0 }));
}

/** Where a delivery goes: the outlet with the most room (at least `room` free spots), then the nearest to `from`. */
export function roomiest(board: Board, p: Person, outlets: readonly Outlet[], from: number, room = 2): Outlet | null {
  return (
    outlets
      .filter((o) => o.store.items.filter((x) => x === null).length >= Math.min(room, o.store.spots.length) && reaches(board, p, o.post.cell))
      .sort((x, y) => board.count(x.store) - board.count(y.store) || board.dist(x.post.cell, from) - board.dist(y.post.cell, from))[0] ?? null
  );
}

/** A delivery step: stand at the outlet, set out up to `n` of `item` (what was carried was `load`). */
export function deliverStep(board: Board, to: Outlet, load: Load, item: Load, n: number, tag: string) {
  return board.stepAt(to.post.cell, {
    ...standAt(board, to.post, to.post.ref === 'stall' ? 0.18 : 0.05),
    pose: 'tend',
    linger: 1.4,
    load,
    tag,
    done: (q: Person) => {
      let k = 0;
      for (let i = 0; i < n; i++) if (board.put(to.store, item)) k++;
      if (k === 0) return false;
      q.load = null;
    },
  });
}

/**
 * A resident goes to buy one `item` at the nearest outlet that has one (more than buyers already on the
 * way), within `reach`, stops at it a moment and walks home with it. `chance` is rolled per choice.
 */
export function buyerPlan(board: Board, chain: Chain, p: Person, outlets: readonly Outlet[], item: Load, chance: number, reach: number, tag: string): Plan | null {
  if (rand(p.seed, tag, p.trips) >= chance) return null;
  const here = p.cell;
  const to = outlets
    .filter((o) => board.count(o.store, item) > o.coming && board.dist(o.post.cell, here) <= reach && reaches(board, p, o.post.cell))
    .sort((x, y) => board.dist(x.post.cell, here) - board.dist(y.post.cell, here) || x.post.cell - y.post.cell)[0];
  if (!to) return null;
  const home = board.homeStep(p, { tag: `${tag}:home`, load: item });
  if (!home) return null;
  to.coming++;
  let counted = true;
  const arrived = (): void => {
    if (counted) to.coming = Math.max(0, to.coming - 1);
    counted = false;
  };
  const side = (rand(p.seed, `${tag}-side`, p.trips) - 0.5) * 0.4;
  return {
    chain,
    at: 0,
    steps: [
      board.stepAt(to.post.cell, {
        ...standAt(board, to.post, to.post.ref === 'stall' ? 0.18 : 0.05, side),
        pose: 'chat',
        linger: 2.2,
        tag,
        done: (q) => {
          arrived();
          if (!board.take(to.store, item)) return false;
          q.load = item;
        },
      }),
      home,
    ],
    fail: arrived,
  };
}

/** Mornings (dawn and the first third of the day) are when people shop most. */
export function morning(time: TimeSignal): boolean {
  return time.isDawn || (time.isDay && time.phase < 0.2);
}
