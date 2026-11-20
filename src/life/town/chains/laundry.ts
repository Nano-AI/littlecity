// L60 · Washing day (posts from L60.laundry.rule.ts). Somebody from the
// house a laundry line hangs from carries the wash out in a basket on their
// head in the morning, stands under the line reaching up, and the washing is
// on the line; at dusk, or when it rains, somebody comes out again, reaches
// up, and carries the wash home. When the rain stops it goes out again.
//
// The line (D05's prop: rope and washing in one drawing) is shown while the
// wash is out and hidden while it is in, with a puff as it goes up or comes
// down. A line whose house is gone has nobody to see to it: it stays as it is.

import { rand } from '@/core/rand';
import type { TimeSignal } from '@/life/api';
import { fxOf } from '../../fx/fx';
import { place } from '../../motion/pose';
import type { Person } from '../../people/crowd';
import type { Board, Chain, Post } from '../board';
import { canWork, homeCell, reaches, standAt } from '../hands';

interface Line {
  post: Post;
  /** The wash is on the line. */
  out: boolean;
  /** Somebody is on the way to see to it. */
  busy: Person | null;
}

/** Whether the wash should be out now. */
export function washOut(time: TimeSignal, rain: number): boolean {
  return (time.isDay || time.isDawn) && rain < 0.25;
}

export interface LaundryChain extends Chain {
  readonly lines: readonly Line[];
}

export function laundryChain(): LaundryChain {
  let lines: Line[] = [];
  let first = true;

  const show = (board: Board, l: Line): void => {
    const h = board.stage?.instance(l.post.ref);
    h?.setVisible(l.out);
  };
  const puff = (board: Board, l: Line): void => {
    if (!board.stage) return;
    const c = board.centre(l.post.cell);
    fxOf(board.stage).play({ actor: 'puff', variant: 'dust' }, 0.5, (t, m) => place(c.x, c.y + 0.9 + t * 0.2, c.z, 0, 0.5 + t * 0.6, 0.5 + t * 0.6, 0.5 + t * 0.6, m));
  };

  const chain: LaundryChain = {
    id: 'laundry',
    get lines() {
      return lines;
    },
    sync(board) {
      const before = new Map(lines.map((l) => [l.post.ref, l]));
      // D05's lines, and the fill builder's drying lines and washing poles (`activity` / hang-washing).
      lines = [...board.posts('laundry').filter((p) => p.role === 'line'), ...board.posts('activity').filter((p) => p.role === 'hang-washing' && p.ref)]
        .map((post) => {
          const had = before.get(post.ref);
          return { post, out: had?.out ?? true, busy: had?.busy ?? null };
        });
    },
    step(_dt, time, board) {
      // The town as first seen keeps its washing as it is drawn, out by day and in by night.
      if (first && lines.length > 0) {
        first = false;
        for (const l of lines) l.out = washOut(time, board.weather.rain);
      }
      for (const l of lines) {
        if (l.busy && !board.plans.has(l.busy)) l.busy = null;
        show(board, l);
      }
    },
    offer(p, time, board) {
      if (!canWork(p) || board.claimedBy(p)) return null;
      const want = washOut(time, board.weather.rain);
      const homeAt = homeCell(board, p);
      // The house it hangs from does it; a drying green, whoever lives within a dozen steps.
      const l = lines.find((x) => x.out !== want && !x.busy && (x.post.structure !== undefined ? x.post.structure === p.home : homeAt !== null && board.dist(homeAt, x.post.cell) <= 12) && reaches(board, p, x.post.cell));
      if (!l) return null;
      // Not all at once along a street: a little seeded hesitation.
      if (rand(p.seed, 'wash', p.trips) < 0.3) return null;
      const home = board.homeStep(p, { tag: 'laundry:home', load: 'washing' });
      if (!home) return null;
      l.busy = p;
      const up = board.stepAt(l.post.cell, {
        ...standAt(board, l.post, 0.28, 0.25), // close to the wall, out of the way of the lane
        pose: 'wave',
        linger: 3,
        load: want ? 'washing' : null,
        tag: want ? 'laundry:hang' : 'laundry:take-in',
        done: (q) => {
          l.out = want;
          l.busy = null;
          puff(board, l);
          // The basket goes home on the head, empty or full.
          q.load = 'washing';
        },
      });
      return { chain, at: 0, steps: [up, home], fail: () => (l.busy = null) };
    },
  };
  return chain;
}
