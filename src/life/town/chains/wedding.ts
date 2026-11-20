// L57 · A wedding at the chapel (posts from L57.wedding.rule.ts). Once on a
// seeded share of days, in the morning:
//
//   gather      a couple walks to the chapel and goes in; up to eight guests
//               (children too) come and stand outside the door, looking at it
//   vows        a few seconds after the guests are there, the couple comes
//               out, the bride in white with her flowers and the groom in a
//               dark coat and hat; the bells peal and petals burst over the
//               doorstep
//   procession  the couple walks to the square (or street) and the guests
//               follow, children running ahead; at the square everybody
//               stands about cheering and chatting a while, then goes home
//
// Everybody in it is in the party (never drawn into a scuffle). The chapel
// erased, or the couple unable to get there: it is called off and everybody
// goes about their day.

import { DIR4 } from '@/core/grid';
import { rand } from '@/core/rand';
import { WEDDING } from '@/style/town-life';
import { fxOf } from '../../fx/fx';
import { ringPeal } from '../../mechanisms/peal';
import { place } from '../../motion/pose';
import type { Person } from '../../people/crowd';
import { DIR_HEADING, type Board, type Chain, type Plan, type Post } from '../board';
import { canWork, homeCell, reaches } from '../hands';

type Phase = 'none' | 'gather' | 'vows' | 'procession';

export interface WeddingChain extends Chain {
  readonly phase: Phase;
  readonly couple: readonly Person[];
  readonly guests: readonly Person[];
  /** Weddings held so far. */
  readonly held: number;
  /** Starts one now if there is not one on (fixtures, sequences). */
  begin(board: Board): boolean;
}

export function weddingChain(): WeddingChain {
  let door: Post | undefined;
  let square: Post | undefined;
  let phase: Phase = 'none';
  let t = 0;
  let couple: Person[] = [];
  let guests: Person[] = [];
  let held = 0;
  let day = 0;
  let lastPart = '';
  let doneDay = -1;
  let seen = -1;

  const all = (): Person[] => [...couple, ...guests];

  const finish = (board: Board): void => {
    for (const p of all()) {
      p.party = false;
      if (board.claimedBy(p) === chain) board.unclaim(p);
    }
    // Anybody still waiting for a procession that will not come goes about their day.
    for (const g of guests) if (board.plans.get(g)?.chain === chain && board.plans.get(g)!.steps[board.plans.get(g)!.at]?.tag === 'wedding:wait') board.drop(g);
    couple = [];
    guests = [];
    phase = 'none';
    t = 0;
  };

  const hurry = (p: Person): void => {
    // Come now (they will ask for their part as soon as they choose what to do next).
    if (p.mode === 'home' || p.mode === 'linger' || p.mode === 'visit') p.timer = Math.min(p.timer, 0.3 + p.rank * 1.5);
  };

  const begin = (board: Board): boolean => {
    if (phase !== 'none' || !door || !square) return false;
    const d = door;
    const near = (p: Person): number => board.dist(homeCell(board, p) ?? p.cell, d.cell);
    const free = board.crowd.people.filter((p) => canWork(p) && !board.claimedBy(p) && !board.plans.has(p) && !p.scuffle && reaches(board, p, d.cell) && homeCell(board, p) !== null);
    const adults = free.filter((p) => !p.child).sort((a, b) => near(a) - near(b) || (a.id < b.id ? -1 : 1));
    if (adults.length < 2) return false;
    // The couple: two of the grown-ups living nearest the chapel, from different houses (a new pair each time).
    const pool = adults.slice(0, 6);
    const bride = pool[Math.floor(rand(board.seed, 'bride', held) * pool.length)]!;
    const rest = pool.filter((p) => p !== bride && p.home !== bride.home);
    const groom = rest[Math.floor(rand(board.seed, 'groom', held) * rest.length)] ?? adults.find((p) => p !== bride)!;
    couple = [bride, groom];
    const others = board.crowd.people
      .filter((p) => !couple.includes(p) && !p.shutIn && !p.leaving && p.mode !== 'gone' && !board.claimedBy(p) && !board.plans.has(p) && !p.scuffle && reaches(board, p, d.cell) && board.dist(homeCell(board, p) ?? p.cell, d.cell) <= WEDDING.reach)
      .sort((a, b) => near(a) - near(b) || (a.id < b.id ? -1 : 1));
    guests = others.slice(0, Math.max(0, Math.round(WEDDING.guests)));
    for (const p of all()) {
      board.claim(p, chain);
      p.party = true;
      hurry(p);
    }
    phase = 'gather';
    t = 0;
    held++;
    doneDay = day;
    return true;
  };

  const petals = (board: Board): void => {
    if (!board.stage || !door) return;
    const c = board.centre(door.cell);
    const [dx, dz] = DIR4[door.dir ?? 0]!;
    // Over the doorstep (the door is ahead, the way the post faces).
    const x0 = c.x + dx * 0.3, z0 = c.z + dz * 0.3;
    for (let i = 0; i < 16; i++) {
      const a = rand(board.seed, 'petal', held, i) * Math.PI * 2, r = 0.2 + rand(board.seed, 'petal-r', held, i) * 0.5;
      const up = 0.5 + rand(board.seed, 'petal-up', held, i) * 0.4;
      fxOf(board.stage).play(
        { actor: 'leaf', variant: 'petal' },
        1.8,
        (k, m) => place(x0 + Math.cos(a) * r * k, c.y + 0.45 + up * Math.sin(k * Math.PI * 0.8) - k * 0.35, z0 + Math.sin(a) * r * k, a + k * 6, 1.3, 1.3, 1.3, m),
        { delay: i * 0.04 },
      );
    }
  };

  const chain: WeddingChain = {
    id: 'wedding',
    get phase() {
      return phase;
    },
    get couple() {
      return couple;
    },
    get guests() {
      return guests;
    },
    get held() {
      return held;
    },
    begin,
    sync(board) {
      const posts = board.posts('wedding');
      door = posts.find((p) => p.role === 'door');
      square = posts.find((p) => p.role === 'square');
      if (phase !== 'none' && (!door || !square)) {
        for (const p of couple) board.drop(p);
        finish(board);
      }
    },
    step(dt, time, board) {
      if (seen < 0) seen = board.now;
      if (time.isDawn && lastPart !== '' && lastPart !== 'dawn') day++;
      lastPart = time.part;
      t += dt;
      if (phase === 'none') {
        if (!door || !square || doneDay === day || !time.isDay) return;
        const today = day === 0 || rand(board.seed, 'wedding-day', day) < WEDDING.chance;
        const when = day === 0 ? board.now - seen >= WEDDING.first + rand(board.seed, 'wedding-at', 0) * 20 : time.phase >= rand(board.seed, 'wedding-at', day) * WEDDING.latest;
        if (today && when) begin(board);
        return;
      }
      // The couple gone, or nowhere to be had: called off.
      if (couple.some((p) => p.mode === 'gone' || p.leaving) || (phase === 'vows' && couple.some((p) => !board.plans.has(p)))) {
        for (const p of couple) board.drop(p);
        finish(board);
        return;
      }
      if (phase === 'gather') {
        // (Arrived inside, their plan is on to the next step: coming out.)
        const inside = couple.every((p) => p.mode === 'visit' && board.plans.get(p)?.steps[board.plans.get(p)!.at]?.tag === 'wedding:out');
        // Those not yet on their way are called again (somebody who went home just now comes out).
        for (const p of all()) if (!board.plans.has(p)) hurry(p);
        const waiting = guests.filter((g) => g.mode === 'linger' && g.goal?.errand?.tag === 'wedding:wait').length;
        if (inside && (waiting >= Math.min(4, guests.length) || t > WEDDING.gather)) {
          phase = 'vows';
          t = 0;
        }
        if (t > WEDDING.gather * 2.5) {
          for (const p of couple) board.drop(p);
          finish(board);
        }
      } else if (phase === 'vows' && t > WEDDING.vows) {
        // Out they come.
        for (const p of couple) if (p.mode === 'visit') p.timer = 0;
      } else if (phase === 'procession') {
        // Over when the couple have gone home (or a good while has passed).
        if (couple.every((p) => !board.plans.has(p)) || t > 120) finish(board);
      }
    },
    offer(p, _time, board) {
      if (phase === 'none' || !door || !square) return null;
      const d = door, sq = square;
      const atSquare = (q: Person, pose: 'chat' | 'cheer' | 'wave', linger: number, tag: string) => {
        const c = board.centre(sq.cell);
        const a = rand(q.seed, 'wed-sq', held) * Math.PI * 2, r = 0.1 + rand(q.seed, 'wed-sq-r', held) * 0.25;
        return board.stepAt(sq.cell, { spot: { x: c.x + Math.cos(a) * r, z: c.z + Math.sin(a) * r }, face: NaN, pose, linger, tag });
      };
      if (couple.includes(p) && phase === 'gather') {
        const bride = p === couple[0];
        const vows = board.stepIn(d.structure!, { cell: d.cell, linger: 1e6, tag: 'wedding:vows', done: (q) => void ((q.costume = bride ? 'bride' : 'groom'), (q.load = bride ? 'bouquet' : null)) });
        const home = board.homeStep(p, { tag: 'wedding:home', load: bride ? 'bouquet' : null, done: (q) => void ((q.costume = null), (q.load = null)) });
        if (!vows || !home) return null;
        const [dx, dz] = DIR4[d.dir ?? 0]!;
        const c = board.centre(d.cell);
        const side = bride ? 0.14 : -0.14;
        const plan: Plan = {
          chain,
          at: 0,
          steps: [
            vows,
            board.stepAt(d.cell, {
              // On the doorstep, side by side, facing out.
              spot: { x: c.x + dx * 0.1 - dz * side, z: c.z + dz * 0.1 + dx * side },
              face: DIR_HEADING[(((d.dir ?? 0) + 2) % 4) as 0 | 1 | 2 | 3],
              pose: 'wave',
              linger: WEDDING.step,
              load: bride ? 'bouquet' : null,
              tag: 'wedding:out',
              done: () => {
                if (phase === 'procession') return;
                phase = 'procession';
                t = 0;
                if (board.stage) {
                  ringPeal(board.stage, board.now);
                  petals(board);
                }
                // The guests follow them.
                for (const g of guests) if (g.mode === 'linger' && g.goal?.errand?.tag === 'wedding:wait') g.timer = 0.6 + g.rank * 1.2;
              },
            }),
            { ...atSquare(p, 'chat', WEDDING.square, 'wedding:square'), load: bride ? 'bouquet' : null },
            home,
          ],
          fail: (q) => {
            q.costume = null;
            if (q.load === 'bouquet') q.load = null;
          },
        };
        return plan;
      }
      if (guests.includes(p) && (phase === 'gather' || phase === 'vows')) {
        const c = board.centre(d.cell);
        const [dx, dz] = DIR4[d.dir ?? 0]!;
        // A loose half-ring a step back from the door, looking at it.
        const k = guests.indexOf(p);
        const side = ((k % 5) - 2) * 0.17;
        const back = -0.15 - Math.floor(k / 5) * 0.2;
        return {
          chain,
          at: 0,
          steps: [
            board.stepAt(d.cell, { spot: { x: c.x + dx * back - dz * side, z: c.z + dz * back + dx * side }, face: DIR_HEADING[d.dir ?? 0], pose: 'look', linger: 1e6, tag: 'wedding:wait' }),
            atSquare(p, p.child || rand(p.seed, 'wed-cheer', held) < 0.5 ? 'cheer' : 'chat', WEDDING.square * (0.6 + rand(p.seed, 'wed-stay', held) * 0.5), 'wedding:follow'),
          ],
        };
      }
      return null;
    },
    dispose(board) {
      if (phase !== 'none') finish(board);
    },
  };
  return chain;
}
