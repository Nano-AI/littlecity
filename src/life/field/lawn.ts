// The slow games (design section 7, "Field"): bowls on a bowling green,
// boules on a gravel strip, croquet on a lawn, and races down a running
// track. Played slowly, by turns. What a watcher sees:
//
//   bowls    the small white jack is rolled up the green; then, by turns,
//            each player steps onto the mat, crouches and rolls a bowl that
//            curls in toward it. When all are bowled everyone walks up to
//            look, the side with the nearest bowl claps, the bowls are picked
//            up and the next end is played back the other way
//   boules   the same with steel balls, tossed underarm in a short arc to
//            land and roll a little
//   croquet  each player in turn taps their coloured ball with a mallet
//            toward the next of the six hoops; through it, on to the next
//   races    children line up at the start in their lanes, crouch, and race
//            to the finish; the winner cheers, the rest clap, they walk back
//
// Every ball is always somewhere: in a hand, rolling, or lying on the grass.

import { courtLocal, courtPoint, type Court } from '@/rules/roles/field.lib';
import { GAME } from '@/style/field';
import type { BallKind } from '@/parts/field/balls';
import { chance, dist, go, hand, hold, inside, launch, makeBall, makePlayer, movePlayers, play, roll, stepBall, SUBSTEP, toward, type Athlete, type Ball, type Game, type GameEvent, type Player } from './kit';

export interface LawnOptions {
  seed: number;
  length?: number;
  ball?: { x: number; z: number };
  /** Where the other balls lie to begin (a game of bowls: its woods, from the last game). */
  lying?: { x: number; z: number }[];
}

function shell(court: Court, players: Player[], balls: Ball[], events: GameEvent[], score: [number, number], update: (dt: number) => void, st: { clock: number; phase: Game['phase']; mode: string; finishing: boolean }): Game {
  return {
    sport: court.role,
    court,
    players,
    balls,
    events,
    get phase() {
      return st.phase;
    },
    get clock() {
      return st.clock;
    },
    score,
    get state() {
      return st.mode;
    },
    step(dt) {
      let left = dt;
      while (left > 1e-9) {
        const h = Math.min(SUBSTEP, left);
        update(h);
        left -= h;
      }
    },
    finish() {
      st.finishing = true;
    },
  };
}

/** Handshakes in the middle, then over: shared by the slow games. */
function shaking(court: Court, players: Player[], st: { phase: Game['phase']; mode: string; t: number; shook: number }, events: GameEvent[], clock: number, dt: number): void {
  if (st.phase === 'play') {
    st.phase = 'shake';
    st.mode = 'shake';
    st.t = 0;
    players.forEach((p, i) => {
      go(p, (i % 2 ? 0.13 : -0.13) * (court.rl > 0.6 ? 1 : 0.5), (Math.floor(i / 2) - 0.5) * 0.3 * (court.rw > 0.6 ? 1 : 0.2), GAME.jog);
      p.look = i % 2 ? Math.PI : 0;
      p.idle = 'stand';
    });
    events.push({ t: clock, kind: 'shake' });
  }
  st.t += dt;
  const ready = players.every((p) => dist(p.u, p.v, p.tu, p.tv) < 0.06);
  if ((ready || st.t > 9) && st.shook < 0) {
    st.shook = st.t;
    for (const p of players) play(p, 'shake', 2.2);
  }
  if (st.shook >= 0 && st.t - st.shook > 2.4) {
    st.phase = 'over';
    st.mode = 'over';
    events.push({ t: clock, kind: 'end' });
  }
}

// ──────────────────────────────────────────────────────── bowls, boules ──

export function bowls(court: Court, athletes: readonly Athlete[], opts: LawnOptions): Game {
  const seed = opts.seed;
  const length = opts.length ?? GAME.length;
  const boules = court.role === 'boules-court';
  const players: Player[] = athletes.map((a, i) => makePlayer(a, (i % 2) as 0 | 1, court));
  const lim = inside(court);
  const events: GameEvent[] = [];
  const score: [number, number] = [0, 0];
  const st = { clock: 0, phase: 'play' as Game['phase'], mode: 'gather', finishing: false, t: 0, shook: -1 };
  const r0 = GAME.bowl * (boules ? 0.9 : 1);
  const start = opts.ball ?? { x: court.cx, z: court.cz };
  const jack = makeBall('jack', GAME.bowl * 0.55, start.x, court.y + GAME.bowl * 0.55, start.z);
  jack.drag = 1.2;
  /** Two each; whose is whose by index (ball i belongs to player i % n). */
  const per = players.length <= 2 ? 2 : 1;
  const mine: Ball[] = [];
  for (let i = 0; i < players.length * per; i++) {
    const p = players[i % players.length]!;
    const kind: BallKind = boules ? 'boule' : p.team === 0 ? 'bowl' : 'bowl-b';
    const lay = opts.lying?.[i];
    const [x, z] = lay ? [lay.x, lay.z] : courtPoint(court, -court.hl * 0.5 + (i % 4) * 0.1, (Math.floor(i / 4) - 0.5) * 0.12 + (p.team ? 0.15 : -0.15));
    const b = makeBall(kind, r0, x, court.y + r0, z);
    b.drag = boules ? 3.5 : 0.9;
    b.bounce = boules ? 0.15 : 0.3;
    mine.push(b);
  }
  const balls = [jack, ...mine];
  const owner = (b: Ball): Player => players[mine.indexOf(b) % players.length]!;
  let s: 1 | -1 = 1; // the end is played toward +u from the mat at −u (then back)
  let turn = 0;
  let count = 0;
  let carrying: Map<Ball, Player> = new Map();
  let fetchers: Player[] = [];
  const r = (...parts: (string | number)[]): number => chance(seed, 'lawn', count, ...parts);
  const clampU = (u: number): number => Math.max(-lim.u, Math.min(lim.u, u));
  const clampV = (v: number): number => Math.max(-lim.v, Math.min(lim.v, v));
  const at = (b: Ball): [number, number] => courtLocal(court, b.x, b.z);
  const toMode = (m: string): void => {
    st.mode = m;
    st.t = 0;
  };
  const matU = (): number => clampU(-s * (court.rl - 0.28));

  const update = (dt: number): void => {
    st.clock += dt;
    st.t += dt;
    if (st.clock >= length) st.finishing = true;
    const mode = st.mode;
    if (mode === 'gather') {
      // Everyone picks up a ball of theirs (and the first the jack) and comes to the mat.
      if (fetchers.length === 0) {
        carrying = new Map();
        fetchers = players.slice();
      }
      let done = true;
      for (const p of players) {
        const want = [...(p === players[0] ? [jack] : []), ...mine.filter((b) => owner(b) === p)].filter((b) => !carrying.has(b));
        const next = want.sort((a, b) => dist(p.u, p.v, ...at(a)) - dist(p.u, p.v, ...at(b)))[0];
        if (next) {
          done = false;
          const [bu, bv] = at(next);
          go(p, clampU(bu), clampV(bv), GAME.jog * 0.8);
          p.look = toward(p.u, p.v, bu, bv);
          const h = hand(court, p, 0.1, 0);
          if (Math.hypot(h.x - next.x, h.z - next.z) < 0.14 && next.state === 'rest') {
            hold(next, p);
            carrying.set(next, p);
            play(p, 'tend', 0.5);
          }
        } else {
          // To the mat end, standing aside.
          const i = players.indexOf(p);
          go(p, clampU(matU() - s * 0.1), clampV((i - (players.length - 1) / 2) * 0.22), GAME.jog * 0.8);
          p.look = toward(0, 0, s, 0);
          p.idle = 'stand';
        }
      }
      if (done && players.every((p) => dist(p.u, p.v, p.tu, p.tv) < 0.08)) {
        fetchers = [];
        if (st.finishing) shaking(court, players, st, events, st.clock, dt);
        else toMode('jack');
      }
    } else if (mode === 'jack' || mode === 'turn') {
      // The thrower steps onto the mat; the rest watch from behind it.
      const ballOrder = mode === 'jack' ? jack : mine[turn]!;
      const p = mode === 'jack' ? players[0]! : owner(ballOrder);
      go(p, matU(), 0, GAME.jog * 0.7);
      p.look = toward(0, 0, s, 0);
      for (const q of players) if (q !== p) go(q, clampU(matU() - s * 0.22), clampV((players.indexOf(q) - (players.length - 1) / 2) * 0.24), GAME.jog * 0.7);
      if (dist(p.u, p.v, p.tu, p.tv) < 0.05 && st.t > 1.2 && !p.move) {
        play(p, 'bowl', 0.8);
        toMode(mode === 'jack' ? 'jack-go' : 'turn-go');
      }
    } else if (mode === 'jack-go' || mode === 'turn-go') {
      const b = mode === 'jack-go' ? jack : mine[turn]!;
      const p = mode === 'jack-go' ? players[0]! : owner(b);
      if (b.holder === p && st.t >= 0.3) {
        count++;
        const h = hand(court, p, 0.16, 0.04);
        b.x = h.x;
        b.y = Math.max(court.y + b.r, h.y);
        b.z = h.z;
        let tu: number, tv: number;
        if (b === jack) {
          tu = s * court.hl * (0.2 + r('jack') * 0.45);
          tv = (r('jv') - 0.5) * court.hw * 0.6;
        } else {
          const [ju, jv] = at(jack);
          const err = boules ? 0.22 : 0.3;
          tu = ju + (r('eu') - 0.5) * err * 2;
          tv = jv + (r('ev') - 0.5) * err * 1.2;
        }
        const [x, z] = courtPoint(court, clampU(tu), clampV(tv));
        if (boules && b !== jack) {
          // Underarm: a short arc to land a little short, then it rolls the rest.
          const [lx, lz] = courtPoint(court, clampU(tu - s * 0.12), clampV(tv));
          launch(b, lx, court.y + b.r, lz, 0.75, p.team);
        } else {
          roll(b, x, z, p.team);
          // A bowl curls: it sets off a little wide of where it ends.
          if (!boules && b !== jack) {
            const side = r('curl') < 0.5 ? 1 : -1;
            const k = 0.12 * side;
            const vx = b.vx, vz = b.vz;
            b.vx = vx - vz * k;
            b.vz = vz + vx * k;
          }
        }
        events.push({ t: st.clock, kind: b === jack ? 'jack' : 'bowl', team: p.team, x: b.x, z: b.z });
      }
      if (b.state === 'rest' && b.holder === null) {
        if (mode === 'jack-go') {
          turn = 0;
          toMode('turn');
        } else if (++turn < mine.length) toMode('turn');
        else toMode('look');
      }
    } else if (mode === 'look') {
      // Up to the jack to see who is nearest.
      const [ju, jv] = at(jack);
      players.forEach((p, i) => {
        go(p, clampU(ju - s * 0.2), clampV(jv + (i - (players.length - 1) / 2) * 0.2), GAME.jog * 0.7);
        p.look = toward(p.u, p.v, ju, jv);
        p.idle = 'tend';
      });
      if (st.t > 4 && players.every((p) => dist(p.u, p.v, p.tu, p.tv) < 0.08)) {
        const near = mine.slice().sort((a, b) => dist(...at(a), ju, jv) - dist(...at(b), ju, jv))[0]!;
        const w = owner(near).team;
        score[w]++;
        events.push({ t: st.clock, kind: 'point', team: w, x: near.x, z: near.z });
        for (const p of players) play(p, p.team === w ? 'clap' : 'stand', 1.6);
        s = s === 1 ? -1 : 1;
        toMode('gather');
      }
    } else shaking(court, players, st, events, st.clock, dt);
    for (const b of balls) {
      if (b.holder) {
        const h = hand(court, b.holder, 0.09, b.holder.move === 'tend' ? 0.05 : 0.18, b === jack ? -0.05 : 0.05);
        b.x = h.x;
        b.y = h.y;
        b.z = h.z;
      } else stepBall(b, court, dt);
    }
    movePlayers(court, players, dt);
  };
  return shell(court, players, balls, events, score, update, st);
}

// ─────────────────────────────────────────────────────────────── croquet ──

export function croquet(court: Court, athletes: readonly Athlete[], opts: LawnOptions): Game {
  const seed = opts.seed;
  const length = opts.length ?? GAME.length;
  const players: Player[] = athletes.slice(0, 4).map((a, i) => makePlayer(a, (i % 2) as 0 | 1, court));
  const lim = inside(court);
  const events: GameEvent[] = [];
  const score: [number, number] = [0, 0];
  const st = { clock: 0, phase: 'play' as Game['phase'], mode: 'walk', finishing: false, t: 0, shook: -1 };
  const { hl, hw } = court;
  // The hoops, in the order they are run (courts.ts draws them in these places).
  const hoops: [number, number][] = [[-hl * 0.55, -hw * 0.55], [-hl * 0.2, 0], [hl * 0.55, -hw * 0.55], [hl * 0.55, hw * 0.55], [hl * 0.2, 0], [-hl * 0.55, hw * 0.55]];
  const kinds: BallKind[] = ['croquet-a', 'croquet-b', 'croquet-c', 'croquet-d'];
  const balls = players.map((p, i) => {
    const [x, z] = courtPoint(court, -hl * 0.85, -hw * 0.85 + i * 0.12);
    const b = makeBall(kinds[i]!, GAME.bowl, x, court.y + GAME.bowl, z);
    b.drag = 1.6;
    return b;
  });
  const next = players.map(() => 0);
  let turn = 0;
  let count = 0;
  const r = (...parts: (string | number)[]): number => chance(seed, 'croquet', count, ...parts);
  const clampU = (u: number): number => Math.max(-lim.u, Math.min(lim.u, u));
  const clampV = (v: number): number => Math.max(-lim.v, Math.min(lim.v, v));
  const at = (b: Ball): [number, number] => courtLocal(court, b.x, b.z);
  const update = (dt: number): void => {
    st.clock += dt;
    st.t += dt;
    if (st.clock >= length) st.finishing = true;
    if (st.mode === 'walk' || st.mode === 'hit') {
      const p = players[turn]!, b = balls[turn]!;
      const [bu, bv] = at(b);
      const [hu, hv] = hoops[next[turn]! % hoops.length]!;
      const d = dist(bu, bv, hu, hv) || 1;
      // Behind the ball, in line with the hoop.
      go(p, clampU(bu - ((hu - bu) / d) * 0.14), clampV(bv - ((hv - bv) / d) * 0.14), GAME.jog * 0.7);
      p.look = toward(p.u, p.v, hu, hv);
      for (const q of players) if (q !== p) {
        const [qu, qv] = at(balls[players.indexOf(q)]!);
        go(q, clampU(qu - 0.15), clampV(qv + 0.1), GAME.jog * 0.6);
        q.look = toward(q.u, q.v, bu, bv);
        q.idle = 'stand';
      }
      if (st.mode === 'walk' && dist(p.u, p.v, p.tu, p.tv) < 0.04 && st.t > 1.5) {
        play(p, 'bowl', 0.7);
        st.mode = 'hit';
        st.t = 0;
      }
      if (st.mode === 'hit' && st.t > 0.3 && b.state === 'rest') {
        count++;
        const go2 = Math.min(d + 0.15, 0.6 + r('len') * 0.8);
        const tu = bu + ((hu - bu) / d) * go2 + (r('eu') - 0.5) * 0.2, tv = bv + ((hv - bv) / d) * go2 + (r('ev') - 0.5) * 0.2;
        const [x, z] = courtPoint(court, clampU(tu), clampV(tv));
        roll(b, x, z, p.team);
        events.push({ t: st.clock, kind: 'stroke', team: p.team, x: b.x, z: b.z });
        st.mode = 'rolling';
        st.t = 0;
      }
    } else if (st.mode === 'rolling') {
      const b = balls[turn]!;
      const [hu, hv] = hoops[next[turn]! % hoops.length]!;
      const [bu, bv] = at(b);
      if (dist(bu, bv, hu, hv) < 0.07) {
        next[turn]!++;
        events.push({ t: st.clock, kind: 'hoop', team: players[turn]!.team, x: b.x, z: b.z });
        play(players[turn]!, 'cheer', 0.9);
        if (next[turn]! >= hoops.length) score[players[turn]!.team]++;
      }
      if (b.state === 'rest') {
        turn = (turn + 1) % players.length;
        st.mode = st.finishing ? 'shake' : 'walk';
        st.t = 0;
      }
    } else shaking(court, players, st, events, st.clock, dt);
    for (const b of balls) stepBall(b, court, dt);
    movePlayers(court, players, dt);
  };
  return shell(court, players, balls, events, score, update, st);
}

// ──────────────────────────────────────────────────────────────── races ──

export function race(court: Court, athletes: readonly Athlete[], opts: LawnOptions): Game {
  const seed = opts.seed;
  const length = opts.length ?? GAME.length;
  const players: Player[] = athletes.map((a, i) => makePlayer(a, (i % 2) as 0 | 1, court));
  const events: GameEvent[] = [];
  const score: [number, number] = [0, 0];
  const st = { clock: 0, phase: 'play' as Game['phase'], mode: 'line-up', finishing: false, t: 0, shook: -1 };
  const lanes = players.length;
  const laneV = (i: number): number => (lanes === 1 ? 0 : -court.hw + ((i + 0.5) * court.hw * 2) / lanes);
  let dir: 1 | -1 = 1;
  let races = 0;
  let order: Player[] = [];
  const update = (dt: number): void => {
    st.clock += dt;
    st.t += dt;
    if (st.clock >= length) st.finishing = true;
    const startU = -dir * (court.hl - 0.12), endU = dir * (court.hl - 0.12);
    if (st.mode === 'line-up') {
      players.forEach((p, i) => {
        go(p, startU, laneV(i), GAME.jog);
        p.look = dir > 0 ? 0 : Math.PI;
        p.idle = 'stand';
      });
      if (players.every((p) => dist(p.u, p.v, p.tu, p.tv) < 0.05) && st.t > 1) {
        if (st.finishing) shaking(court, players, st, events, st.clock, dt);
        else {
          for (const p of players) p.idle = 'ready';
          st.mode = 'set';
          st.t = 0;
        }
      }
    } else if (st.mode === 'set') {
      if (st.t > 1.4) {
        events.push({ t: st.clock, kind: 'go' });
        races++;
        order = [];
        players.forEach((p, i) => go(p, endU + dir * 0.05, laneV(i), GAME.run * (1.05 + chance(seed, 'race', races, i) * 0.4)));
        st.mode = 'run';
        st.t = 0;
      }
    } else if (st.mode === 'run') {
      for (const p of players) {
        if (!order.includes(p) && (p.u - endU) * dir >= -0.01) {
          order.push(p);
          if (order.length === 1) {
            events.push({ t: st.clock, kind: 'win', team: p.team, x: p.a.x, z: p.a.z });
            score[p.team]++;
            play(p, 'cheer', 1.5);
          } else play(p, 'clap', 1.2);
        }
      }
      if (order.length === players.length && st.t > 2) {
        dir = dir === 1 ? -1 : 1;
        st.mode = 'line-up';
        st.t = 0;
      }
    } else shaking(court, players, st, events, st.clock, dt);
    movePlayers(court, players, dt);
  };
  return shell(court, players, [], events, score, update, st);
}
