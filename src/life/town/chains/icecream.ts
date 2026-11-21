// L63 · The ice-cream cart at the beach (the beach day's `beach|back` post).
// While a beach day is on, somebody wheels the ice-cream cart down from
// their house (a white cart with a pink lid and a striped umbrella), parks
// it behind the sand and stands behind it; people about the town come down
// and queue, one by one get a cone, and walk off with it held up; when the
// beach day ends the cart is wheeled home.
//
// Cost per step: a few comparisons per person queueing (four at most).

import { DIR4, keyX, keyZ } from '@/core/grid';
import { rand } from '@/core/rand';
import type { InstanceHandle } from '@/life/api';
import { carriedMesh } from '@/parts/people/loads';
import { PERSON } from '@/style/people';
import { fxOf } from '../../fx/fx';
import { place } from '../../motion/pose';
import type { Person } from '../../people/crowd';
import { DIR_HEADING, type Board, type Chain, type Post } from '../board';
import { canWork, homeCell, reaches, unbusy } from '../hands';
import type { BeachChain } from './beach';

interface Stand {
  post: Post;
  vendor: Person | null;
  cart: InstanceHandle | null;
  queue: Person[];
  servedAt: number;
}

export interface IceCreamChain extends Chain {
  /** Carts parked now, people queueing, cones sold so far. */
  readonly parked: number;
  readonly queueing: number;
  readonly sold: number;
}

const QUEUE = 4;

export function iceCreamChain(): IceCreamChain {
  let stands: Stand[] = [];
  let sold = 0;
  let reassigning = false;

  const geom = (board: Board, s: Stand): { cx: number; cy: number; cz: number; fx: number; fz: number } => {
    const c = board.centre(s.post.cell);
    const [fx, fz] = DIR4[s.post.dir ?? 0]!;
    return { cx: c.x, cy: c.y, cz: c.z, fx, fz };
  };
  /** The queue's places, from the front: two in a line from the cart, then round to the side. */
  const slot = (board: Board, s: Stand, i: number): { x: number; z: number; face: number } => {
    const { cx, cz, fx, fz } = geom(board, s);
    const [a, side] = ([[-0.27, 0], [-0.43, 0.02], [-0.36, 0.26], [-0.2, 0.38]] as const)[Math.min(QUEUE - 1, i)]!;
    const x = cx + fx * a - fz * side, z = cz + fz * a + fx * side;
    return { x, z, face: Math.atan2(cx - x, cz - z) };
  };
  const beachOn = (board: Board, s: Stand): boolean => {
    const beach = board.chains.find((c) => c.id === 'beach') as BeachChain | undefined;
    return beach?.on.some((d) => d.beach === Number(s.post.ref) && d.mode === 'on' && d.until < Infinity) ?? false;
  };
  const puff = (board: Board, x: number, y: number, z: number): void => {
    if (!board.stage) return;
    fxOf(board.stage).play({ actor: 'puff', variant: 'dust' }, 0.45, (k, m) => place(x, y + 0.04 + k * 0.1, z, 0, 0.3 + k * 0.4, 0.3 + k * 0.4, 0.3 + k * 0.4, m));
  };

  const park = (board: Board, s: Stand, on: boolean): void => {
    const { cx, cy, cz, fx, fz } = geom(board, s);
    if (on && !s.cart) {
      const sc = PERSON.height / 0.42;
      // The cart's handles toward the beach, where the seller stands; the umbrella over it.
      s.cart = board.stage ? board.stage.spawnMesh(carriedMesh('icecart'), place(cx + fx * 0.05, cy, cz + fz * 0.05, DIR_HEADING[((s.post.dir ?? 0) + 2) % 4 as 0 | 1 | 2 | 3], sc, sc, sc)) : ({ setMatrix() {}, setVisible() {}, setParams() {}, release() {} } as unknown as InstanceHandle);
      puff(board, cx, cy, cz);
    } else if (!on && s.cart) {
      s.cart.release();
      s.cart = null;
      puff(board, cx, cy, cz);
    }
  };

  const sendHome = (board: Board, p: Person): void => {
    const home = board.homeStep(p, { tag: 'ice:home', linger: 0.5, load: p.load, done: (q) => void ((q.load = null), board.claimedBy(q) === chain && board.unclaim(q)) });
    reassigning = true;
    if (home) board.assign(p, { chain, at: 0, steps: [home] });
    else board.drop(p);
    reassigning = false;
  };

  const start = (board: Board, s: Stand): void => {
    const cell = s.post.cell;
    const far = (p: Person): number => {
      const h = homeCell(board, p);
      return h === null ? Infinity : board.dist(h, cell);
    };
    const who = board.crowd.people
      .filter((p) => canWork(p) && unbusy(board, p) && !p.load && !p.party && !p.scuffle && reaches(board, p, cell) && far(p) <= 30)
      .sort((a, b) => far(a) - far(b) || (a.id < b.id ? -1 : 1))[0];
    if (!who) return;
    const { cx, cz, fx, fz } = geom(board, s);
    const sell = board.stepAt(cell, { spot: { x: cx + fx * 0.36, z: cz + fz * 0.36 }, face: DIR_HEADING[((s.post.dir ?? 0) + 2) % 4 as 0 | 1 | 2 | 3], pose: 'wave', linger: 1e6, load: s.cart ? null : 'icecart', tag: 'ice:sell', done: (q) => {
      park(board, s, true);
      q.load = null;
    } });
    const home = board.homeStep(who, { tag: 'ice:home', linger: 0.5, load: 'icecart', done: (q) => void ((q.load = null), board.claimedBy(q) === chain && board.unclaim(q)) });
    if (!home) return;
    board.claim(who, chain);
    s.vendor = who;
    reassigning = true;
    board.assign(who, { chain, at: 0, steps: [sell, home], fail: () => {
      if (reassigning) return;
      s.vendor = null;
    } });
    reassigning = false;
  };

  /** The day is over: the cart wheeled home, the queue goes off. */
  const close = (board: Board, s: Stand): void => {
    for (const q of s.queue) if (board.plans.get(q)?.chain === chain) sendHome(board, q);
    s.queue = [];
    const v = s.vendor;
    s.vendor = null;
    if (!v) {
      park(board, s, false);
      return;
    }
    if (s.cart) {
      park(board, s, false);
      v.load = 'icecart';
    }
    const plan = board.plans.get(v);
    if (plan?.chain === chain && v.mode === 'linger') {
      for (let i = plan.at; i < plan.steps.length; i++) plan.steps[i]!.load = v.load;
      v.timer = Math.min(v.timer, 0.5);
    } else if (plan?.chain === chain) sendHome(board, v);
  };

  const chain: IceCreamChain = {
    id: 'icecream',
    get parked() {
      return stands.filter((s) => s.cart).length;
    },
    get queueing() {
      return stands.reduce((n, s) => n + s.queue.length, 0);
    },
    get sold() {
      return sold;
    },
    sync(board) {
      const posts = board.posts('beach').filter((p) => p.role === 'back');
      for (const s of stands) if (!posts.some((p) => p.cell === s.post.cell)) close(board, s);
      stands = posts.map((post) => stands.find((s) => s.post.cell === post.cell) ?? { post, vendor: null, cart: null, queue: [], servedAt: 0 });
    },
    step(dt, _time, board) {
      for (const s of stands) {
        const on = beachOn(board, s);
        if (!on) {
          if (s.vendor || s.cart) close(board, s);
          continue;
        }
        if (!s.vendor) {
          start(board, s);
          continue;
        }
        const v = s.vendor;
        if (board.plans.get(v)?.chain !== chain) {
          // Called away: the cart goes back with whoever comes for it next time; for now it stays parked.
          s.vendor = null;
          continue;
        }
        s.queue = s.queue.filter((q) => board.plans.get(q)?.chain === chain && q.goal?.errand?.tag === 'ice:queue');
        // Each in the queue shuffles up to their place in it.
        s.queue.forEach((q, i) => {
          if (q.mode !== 'linger') return;
          const at = slot(board, s, i);
          const dx = at.x - q.x, dz = at.z - q.z, d = Math.hypot(dx, dz);
          if (d > 0.01) {
            const k = Math.min(d, 0.4 * dt);
            const cx = keyX(q.cell), cz = keyZ(q.cell);
            q.x = Math.max(cx + 0.03, Math.min(cx + 0.97, q.x + (dx / d) * k));
            q.z = Math.max(cz + 0.03, Math.min(cz + 0.97, q.z + (dz / d) * k));
            q.heading = Math.atan2(dx, dz);
            q.pose = q.child ? 'run' : 'walk';
            q.stride += k * PERSON.stepsPerCell * 0.5;
          } else {
            q.heading = at.face;
            q.pose = q.child ? 'hop' : 'stand';
          }
        });
        // Serving the one at the front: a scoop (the seller bends to the tub), and the cone handed over.
        const front = s.queue[0];
        if (s.cart && v.mode === 'linger' && front && front.mode === 'linger' && Math.hypot(front.x - slot(board, s, 0).x, front.z - slot(board, s, 0).z) < 0.03) {
          if (s.servedAt === 0) s.servedAt = board.now;
          v.pose = 'tend';
          if (board.now - s.servedAt > 2.4) {
            front.load = 'cone';
            const plan = board.plans.get(front)!;
            for (let i = plan.at; i < plan.steps.length; i++) plan.steps[i]!.load = 'cone';
            front.timer = Math.min(front.timer, 0.4);
            front.pose = 'cheer';
            s.queue.shift();
            s.servedAt = 0;
            sold++;
          }
        } else if (s.cart && v.mode === 'linger') {
          // Calling out, waving.
          v.pose = Math.floor(board.now / 3) % 3 === 0 ? 'wave' : 'stand';
          s.servedAt = 0;
        }
      }
    },
    offer(p, _time, board) {
      if (p.load || p.party || p.shutIn || p.leaving || board.claimedBy(p)) return null;
      for (const s of stands) {
        if (!s.cart || s.queue.length >= QUEUE) continue;
        if (!reaches(board, p, s.post.cell) || board.dist(p.cell, s.post.cell) > 22) continue;
        if (rand(p.seed, 'icecream', p.trips) >= (p.child ? 0.5 : 0.25)) continue;
        const at = slot(board, s, s.queue.length);
        const queue = board.stepAt(s.post.cell, { spot: { x: at.x, z: at.z }, face: at.face, pose: 'stand', linger: 1e6, tag: 'ice:queue' });
        const home = board.homeStep(p, { tag: 'ice:home', linger: 0.5, done: (q) => void (q.load = null) });
        if (!home) continue;
        s.queue.push(p);
        return { chain, at: 0, steps: [queue, home], fail: (q) => void (s.queue = s.queue.filter((x) => x !== q)) };
      }
      return null;
    },
    dispose(board) {
      for (const s of stands) park(board, s, false);
      stands = [];
    },
  };
  return chain;
}
