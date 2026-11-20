// L58 · Trade from the quay (posts from L58.trade.rule.ts). When a ship has
// landed goods on the quay (the harbour's piles, src/life/ships: they lie
// there until carried), two carters take them into town. A carter's handcart
// stands outside their front door; they wheel it down to the quay, load it
// with up to three of the crates, barrels and sacks lying there (the stack
// on the quay goes down one by one), push it to the shop, inn or market
// stall with the most room, set the goods down by its door or stall, and
// wheel the empty cart home.
//
// The ships code is only read: `harbourOf(stage).piles` for where goods lie,
// and `goodsKindOf` (crew.ts, added for this) for what each piece is. A
// sailor may take a piece aboard that a carter was coming for: the carter
// loads what is left.

import { CELL_H, DIR4, key, keyX, keyZ, opposite, type CellKey } from '@/core/grid';
import { usableDoors } from '@/resolve/nav';
import { CHAINS } from '@/style/town-life';
import type { Person } from '../../people/crowd';
import type { Load } from '../../people/errand';
import { goodsKindOf, type Pile } from '../../ships/crew';
import { harbourOf } from '../../ships/visit';
import { heapSpots, type Board, type Chain, type Plan, type PlanStep, type Post, type Store } from '../board';
import { homeCell, keepHand, reaches, standAt } from '../hands';

interface Dest {
  post: Post;
  store: Store;
}

export interface TradeChain extends Chain {
  readonly carters: readonly (Person | null)[];
}

/** Where goods lie on the quays; the harbour's piles by default (tests give their own). */
export type PileSource = (board: Board) => ReadonlyMap<string, Pile> | null;

const asLoad = (kind: string | undefined): Load => (kind === 'barrel' ? 'barrel' : kind === 'sack' ? 'sack' : 'crate');
const cartOf = (n: number): Load => (n <= 0 ? 'cart' : n === 1 ? 'cart-1' : n === 2 ? 'cart-2' : 'cart-3');

export function tradeChain(piles: PileSource = (board) => (board.stage ? (harbourOf(board.stage)?.piles ?? null) : null)): TradeChain {
  let dests: Dest[] = [];
  let carters: (Person | null)[] = [null, null];
  const carts = new Map<Person, Store>();
  const next = new Map<Person, number>();
  /** Pile spots a carter is on the way to (so two never go for one). */
  const reserved = new Set<string>();

  /** The walking-graph cell to stand in to lift something lying at (x, y, z), and where in it. */
  const pickAt = (board: Board, x: number, y: number, z: number): { cell: CellKey; spot: { x: number; z: number }; face: number } | null => {
    const nav = board.nav;
    if (!nav) return null;
    const level = Math.round(y / CELL_H);
    const cx = Math.floor(x), cz = Math.floor(z);
    let best: CellKey | null = null, bestD = Infinity;
    for (const [dx, dz] of [[0, 0], ...DIR4] as const) {
      const c = key(cx + dx, level, cz + dz);
      if (!nav.nodeAt.has(c)) continue;
      const d = Math.hypot(keyX(c) + 0.5 - x, keyZ(c) + 0.5 - z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best === null) return null;
    const mx = keyX(best) + 0.5, mz = keyZ(best) + 0.5;
    // Beside it, facing it, inside the cell.
    const toX = x - mx, toZ = z - mz, d = Math.hypot(toX, toZ) || 1;
    const k = Math.max(0, Math.min(0.35, d - 0.3));
    return { cell: best, spot: { x: mx + (toX / d) * k, z: mz + (toZ / d) * k }, face: Math.atan2(toX, toZ) };
  };

  /** The carter's cart, parked by their front door. */
  const cartStore = (board: Board, p: Person): Store | null => {
    const nav = board.nav;
    const door = nav ? usableDoors(nav, p.home).find((d) => d.dir !== undefined) : undefined;
    if (!nav || !door) return null;
    const cell = nav.nodes[door.node]!.cell;
    return board.store(`trade:cart:${p.id}`, heapSpots(cell, door.dir!, board.centre(cell).y, -1, 0.3).slice(1, 2));
  };

  const chain: TradeChain = {
    id: 'trade',
    get carters() {
      return carters;
    },
    sync(board) {
      dests = board
        .posts('trade')
        .filter((p) => p.role === 'to')
        .map((post) => ({ post, store: board.store(`trade:to:${post.structure ?? post.cell}`, heapSpots(post.cell, opposite(post.dir ?? 0), board.centre(post.cell).y, 1, 0.19)) }));
      if (dests.length === 0) {
        for (const c of carters) if (c && board.claimedBy(c) === chain) board.unclaim(c);
        carters = [null, null];
        return;
      }
      const near = dests[0]!.post.cell;
      carters = carters.map((had) => keepHand(board, chain, had, near, (p) => p.work === null));
      carts.clear();
      for (const c of carters) {
        if (!c) continue;
        const store = cartStore(board, c);
        if (!store) continue;
        carts.set(c, store);
        // The cart is there from the start (unless it is out on the streets with them).
        if (board.count(store) === 0 && !(c.load ?? '').startsWith('cart')) board.put(store, 'cart');
      }
    },
    offer(p, time, board) {
      const i = carters.indexOf(p);
      if (i < 0 || !(time.isDay || time.isDawn) || board.now < (next.get(p) ?? 0)) return null;
      const all = piles(board);
      if (!all) return null;
      // Goods lying on a quay that nobody is coming for.
      const free: { key: string; pile: Pile; index: number }[] = [];
      for (const [k, pile] of all) pile.items.forEach((it, index) => it && !reserved.has(`${k}:${index}`) && free.push({ key: k, pile, index }));
      if (free.length === 0) return null;
      const home = homeCell(board, p);
      const cart = carts.get(p);
      if (home === null || !cart) return null;
      // The nearest pieces to the first, at most three.
      const first = free[0]!;
      const sp0 = first.pile.spots[first.index]!;
      const pickedUp = free
        .filter((f) => f.key === first.key)
        .sort((a, b) => Math.hypot(a.pile.spots[a.index]!.x - sp0.x, a.pile.spots[a.index]!.z - sp0.z) - Math.hypot(b.pile.spots[b.index]!.x - sp0.x, b.pile.spots[b.index]!.z - sp0.z))
        .slice(0, 3);
      const picks = pickedUp.map((f) => ({ f, at: pickAt(board, f.pile.spots[f.index]!.x, f.pile.spots[f.index]!.y, f.pile.spots[f.index]!.z) })).filter((x) => x.at && reaches(board, p, x.at.cell));
      if (picks.length === 0) return null;
      const dest = dests
        .filter((d) => d.store.items.filter((x) => x === null).length >= picks.length && board.walk(picks[0]!.at!.cell, d.post.cell) < Infinity)
        .sort((a, b) => board.count(a.store) - board.count(b.store) || board.walk(picks[0]!.at!.cell, a.post.cell) - board.walk(picks[0]!.at!.cell, b.post.cell))[0];
      if (!dest) return null;
      next.set(p, board.now + CHAINS.cartGap);
      const keys = picks.map((x) => `${x.f.key}:${x.f.index}`);
      for (const k of keys) reserved.add(k);
      const release = (): void => {
        for (const k of keys) reserved.delete(k);
      };
      const loaded: Load[] = [];
      const steps: PlanStep[] = [];
      const cartSpot = cart.spots[0]!;
      // Standing beside the parked cart, between it and the middle of the doorstep.
      const hc = board.centre(home);
      const byCart = { x: (cartSpot.x + hc.x) / 2, z: (cartSpot.z + hc.z) / 2 };
      // Out to the cart by the door: take it by the handles.
      steps.push(
        board.stepAt(home, {
          spot: byCart,
          face: Math.atan2(cartSpot.x - byCart.x, cartSpot.z - byCart.z),
          pose: 'tend',
          linger: 0.8,
          tag: 'trade:cart',
          done: (q) => {
            board.take(cart);
            q.load = 'cart';
          },
        }),
      );
      // Down to the quay, loading piece after piece.
      const pickSteps = picks.map(({ f, at }, j) =>
        board.stepAt(at!.cell, {
          spot: at!.spot,
          face: at!.face,
          pose: 'tend',
          linger: 1,
          load: 'cart',
          brisk: j === 0,
          tag: 'trade:load',
          done: (q) => {
            const h = f.pile.items[f.index];
            if (h) {
              loaded.push(asLoad(goodsKindOf(h)));
              f.pile.items[f.index] = null;
              h.release();
            }
            reserved.delete(`${f.key}:${f.index}`);
            q.load = cartOf(loaded.length);
            // What the rest of the walk carries.
            for (const s of steps.slice(steps.indexOf(pickSteps[j]!) + 1)) if (s.tag !== 'trade:home') s.load = cartOf(loaded.length);
          },
        }),
      );
      steps.push(...pickSteps);
      // Into town, and the goods down by the door or the stall.
      steps.push(
        board.stepAt(dest.post.cell, {
          ...standAt(board, dest.post, dest.post.ref === 'stall' ? 0.15 : 0.05, 0.12),
          pose: 'tend',
          linger: 1.6,
          load: 'cart',
          tag: 'trade:unload',
          done: (q) => {
            while (loaded.length > 0 && board.put(dest.store, loaded[loaded.length - 1]!)) loaded.pop();
            q.load = cartOf(loaded.length);
            steps[steps.length - 1]!.load = q.load;
          },
        }),
        // And the cart home to its place by the door.
        board.stepAt(home, {
          spot: byCart,
          face: Math.atan2(cartSpot.x - byCart.x, cartSpot.z - byCart.z),
          pose: 'tend',
          linger: 0.8,
          load: 'cart',
          tag: 'trade:home',
          done: (q) => {
            if (q.load === 'cart' && board.put(cart, 'cart')) q.load = null;
          },
        }),
      );
      const plan: Plan = { chain, at: 0, steps, fail: release };
      return plan;
    },
  };
  return chain;
}
