// Tennis (design section 7, "Field"): singles, or doubles with four. What a
// watcher sees:
//
//   the serve   the server stands behind the baseline, tosses the ball up and
//               hits it over the net into the box across the court; now and
//               then it goes into the net (a fault) and they serve again
//   the rally   the ball goes back and forth over the net in arcs, bouncing
//               once on each side; whoever's side it lands on runs to where
//               it will be after the bounce and swings their racket through
//               it; the longer the rally the likelier a mistake
//   the point   ends when a ball goes into the net, lands out, or bounces
//               twice because nobody got to it; whoever is nearest the ball
//               fetches it, and it is knocked back to the server
//   games       first to four points wins a game; the serve goes to the
//               other side, and after every odd game the players change
//               ends, walking round the end of the net
//   the end     they meet at the net and shake hands; the ball is left lying
//
// Team 0 begins on the −u end. A side's players: the one nearer the ball
// plays it; a partner in doubles stands up at the net.

import { courtLocal, courtPoint, tennisOf, type Court } from '@/rules/roles/field.lib';
import { GAME } from '@/style/field';
import { chance, dist, go, hand, hold, inside, launch, makeBall, makePlayer, movePlayers, play, stepBall, SUBSTEP, toward, type Athlete, type Ball, type Game, type GameEvent, type Player } from './kit';

type Mode = 'fetch' | 'ready' | 'toss' | 'rally' | 'dead' | 'swap' | 'shake' | 'over';

export interface TennisOptions {
  seed: number;
  length?: number;
  ball?: { x: number; z: number };
}

/** Racket height (above the ground) where the ball is hit, and how far from the body. */
const STRIKE = 0.2;
const REACH = 0.24;

export function tennis(court: Court, athletes: readonly Athlete[], opts: TennisOptions): Game {
  const seed = opts.seed;
  const length = opts.length ?? GAME.length;
  const t = tennisOf(court);
  const lim = inside(court);
  const doubles = athletes.length >= 4;
  const players: Player[] = athletes.slice(0, doubles ? 4 : 2).map((a, i) => makePlayer(a, (i % 2) as 0 | 1, court));
  const team = (k: 0 | 1): Player[] => players.filter((p) => p.team === k);
  const start = opts.ball ?? { x: court.cx, z: court.cz };
  const ball: Ball = makeBall('tennis', GAME.tennisBall, start.x, court.y + GAME.tennisBall, start.z);
  ball.bounce = 0.72;
  ball.drag = 0.9;
  const events: GameEvent[] = [];
  const score: [number, number] = [0, 0];
  /** Points in the game now, games won. */
  const points: [number, number] = [0, 0];
  let clock = 0;
  let mode: Mode = 'fetch';
  let modeT = 0;
  let phase: Game['phase'] = 'play';
  let finishing = false;
  let swapped = false;
  let serving: 0 | 1 = 0;
  let serverIx = 0;
  let pointNo = 0;
  let faults = 0;
  let rallyLen = 0;
  let shots = 0;
  /** The shot in the air: who hit it, where it should land, whether it is meant to fail, the bounces seen. */
  let shot: { by: 0 | 1; bounces: number; landedOut: boolean; netted: boolean; receiver: Player | null; hitAt: number; hitU: number; hitV: number } | null = null;
  let fetcher: Player | null = null;
  /** The ball's u a step ago (to see it cross the net). */
  let lastU = 0;
  let shook = -1;

  const emit = (kind: string, k?: number): void => void events.push({ t: clock, kind, ...(k !== undefined ? { team: k } : {}), x: ball.x, z: ball.z });
  const r = (...parts: (string | number)[]): number => chance(seed, 'tennis', shots, pointNo, ...parts);
  /** The end a team plays from: −1 or +1. */
  const endOf = (k: 0 | 1): 1 | -1 => ((k === 0) !== swapped ? -1 : 1);
  const other = (k: 0 | 1): 0 | 1 => (k === 0 ? 1 : 0);
  const clampU = (u: number): number => Math.max(-lim.u, Math.min(lim.u, u));
  const clampV = (v: number): number => Math.max(-lim.v, Math.min(lim.v, v));
  const toMode = (m: Mode): void => {
    mode = m;
    modeT = 0;
  };
  const ballUV = (): [number, number] => courtLocal(court, ball.x, ball.z);
  const server = (): Player => team(serving)[serverIx % team(serving).length]!;

  /** Where everyone stands for the serve. */
  const lineUp = (): void => {
    const deuce = pointNo % 2 === 0 ? 1 : -1;
    for (const p of players) {
      const e = endOf(p.team);
      const mine = team(p.team);
      const lead = p === server() || (p.team !== serving && mine.indexOf(p) === (pointNo + serverIx) % mine.length);
      if (lead) {
        const u = p.team === serving ? e * (court.hl + 0.03) : e * (court.hl - 0.08);
        const v = (p.team === serving ? deuce : -deuce) * t.singles * 0.42 * (p.team === serving ? 1 : 1);
        go(p, clampU(u), clampV(p.team === serving ? v : v), GAME.jog);
      } else go(p, clampU(e * court.hl * 0.32), clampV(-deuce * t.singles * 0.45 * (p.team === serving ? 1 : -1)), GAME.jog);
      p.look = toward(0, 0, -e, 0);
      p.idle = 'ready';
    }
  };

  /** Hits the ball from where it is toward the other end: good, into the net, or out. */
  const strike = (p: Player, serve: boolean): void => {
    shots++;
    const e = endOf(p.team);
    const err = serve ? (faults === 0 ? 0.16 : 0.07) : Math.min(0.45, 0.07 + rallyLen * 0.035);
    const roll = r('err');
    const deuce = pointNo % 2 === 0 ? 1 : -1;
    let tu: number, tv: number, tt: number;
    if (serve) {
      tu = -e * t.service * (0.55 + r('su') * 0.35);
      tv = -deuce * t.singles * (0.25 + r('sv') * 0.5);
      tt = 0.85;
    } else {
      tu = -e * court.hl * (0.4 + r('u') * 0.5);
      tv = t.singles * (r('v') * 1.7 - 0.85);
      tt = 0.95 + r('t') * 0.35;
    }
    let net = false;
    if (roll < err) {
      if (r('kind') < 0.55) {
        // Into the net.
        net = true;
        tu = -e * 0.15;
        tt = 0.55;
      } else if (r('long') < 0.5) tu = -e * (court.hl + 0.1 + r('by') * 0.08);
      else tv = Math.sign(tv || 1) * (t.singles + 0.08 + r('by') * 0.06);
    }
    const [x, z] = courtPoint(court, tu, tv);
    const h = hand(court, p, REACH * 0.6, serve ? 0.48 : STRIKE, serve ? 0 : 0.08);
    ball.x = h.x;
    ball.y = h.y;
    ball.z = h.z;
    if (net) launch(ball, x, court.y + 0.04, z, tt, p.team);
    else launch(ball, x, court.y + ball.r, z, tt, p.team);
    // A ball that would graze the net goes higher.
    if (!net) {
      const [bu] = ballUV();
      const cross = Math.abs(bu) / Math.max(1e-3, Math.abs(bu - tu));
      const yAt = ball.y + ball.vy * (cross * tt) - 0.5 * GAME.gravity * (cross * tt) ** 2;
      if (yAt < court.y + t.net + 0.08) {
        const lift = court.y + t.net + 0.1 - yAt;
        ball.vy += lift / Math.max(0.1, cross * tt);
      }
    }
    play(p, serve ? 'serve' : 'swing', serve ? 0.75 : 0.5);
    if (serve) p.moveT = 0.5;
    shot = { by: p.team, bounces: 0, landedOut: false, netted: false, receiver: null, hitAt: Infinity, hitU: 0, hitV: 0 };
    rallyLen++;
    emit(serve ? 'serve' : 'hit', p.team);
    plan();
  };

  /** Who on the other side plays the ball, where they meet it and when. */
  const plan = (): void => {
    if (!shot) return;
    const probe: Ball = { ...ball, rot: ball.rot };
    let bounced = false;
    let at = 0;
    for (; at < 4; at += SUBSTEP) {
      const vy0 = probe.vy;
      stepBall(probe, court, SUBSTEP);
      if (probe.state === 'flight' && vy0 < 0 && probe.vy > 0) bounced = true;
      if (bounced && probe.vy < 0 && probe.y < court.y + STRIKE + 0.04) break;
      if (probe.state !== 'flight') break;
    }
    const [hu, hv] = courtLocal(court, probe.x, probe.z);
    const side = other(shot.by);
    const mates = team(side);
    const who = mates.slice().sort((a, b) => dist(a.u, a.v, hu, hv) - dist(b.u, b.v, hu, hv))[0]!;
    shot.receiver = who;
    shot.hitAt = clock + at;
    // They stand where the ball will be, a racket's reach to its side.
    const e = endOf(side);
    shot.hitU = clampU(hu + e * 0.05);
    shot.hitV = clampV(hv - REACH * 0.7);
    go(who, shot.hitU, shot.hitV, GAME.run);
    for (const m of mates) if (m !== who) go(m, m.u, m.v, GAME.jog);
    // The hitter drifts back toward the middle of their baseline.
    for (const m of team(shot.by)) go(m, clampU(endOf(shot.by) * (team(shot.by).length > 1 && m !== players.find((q) => q.move) ? court.hl * 0.35 : court.hl - 0.12)), clampV(m.v * 0.4), GAME.jog);
  };

  const endPoint = (winner: 0 | 1, why: string): void => {
    points[winner]++;
    pointNo++;
    faults = 0;
    rallyLen = 0;
    shot = null;
    emit('point', winner);
    emit(why, winner);
    if (points[winner] >= 4 && points[winner] - points[other(winner)] >= 2) {
      score[winner]++;
      points[0] = points[1] = 0;
      emit('game', winner);
      serving = other(serving);
      if (serving === 0) serverIx++;
      if ((score[0] + score[1]) % 2 === 1) swapped = !swapped;
    }
    for (const p of players) {
      p.look = toward(p.u, p.v, ...ballUV());
      go(p, p.u, p.v);
    }
    // The winners: a little fist pump.
    for (const p of team(winner)) if (r('pump', p.a.id) < 0.5) play(p, 'cheer', 0.8);
    toMode('dead');
  };

  const update = (dt: number): void => {
    clock += dt;
    modeT += dt;
    if (clock >= length) finishing = true;
    switch (mode) {
      case 'fetch': {
        // The nearest player gets the ball and knocks it to the server (or keeps it, serving).
        const [bu, bv] = ballUV();
        if (!fetcher) fetcher = players.slice().sort((a, b) => dist(a.u, a.v, bu, bv) - dist(b.u, b.v, bu, bv))[0]!;
        const f = fetcher;
        if (ball.holder !== f) {
          go(f, clampU(bu), clampV(bv), GAME.jog);
          f.look = toward(f.u, f.v, bu, bv);
          for (const p of players) if (p !== f) go(p, p.u, p.v);
          const h = hand(court, f, 0.1, 0);
          if (Math.hypot(h.x - ball.x, h.z - ball.z) < 0.14 && ball.y < court.y + 0.3) {
            hold(ball, f);
            play(f, 'shoot', 0.25);
            f.moveT = 0.12;
          }
          break;
        }
        if (finishing || phase !== 'play') {
          toMode('shake');
          break;
        }
        const sv = server();
        if (f === sv) {
          fetcher = null;
          toMode('ready');
          break;
        }
        // A gentle lob to the server.
        if (modeT > 0.4 && !f.move) {
          const h = hand(court, sv, 0.08, 0.25);
          launch(ball, h.x, h.y, h.z, Math.max(0.6, dist(f.u, f.v, sv.u, sv.v) / 2), f.team);
          play(f, 'swing', 0.45);
          fetcher = null;
          toMode('ready');
        }
        break;
      }
      case 'ready': {
        lineUp();
        const sv = server();
        if (ball.holder !== sv) {
          // Catching the lob (or picking it up).
          sv.look = toward(sv.u, sv.v, ...ballUV());
          const h = hand(court, sv, 0.08, 0.25);
          if (Math.hypot(h.x - ball.x, h.z - ball.z) < 0.16 && Math.abs(h.y - ball.y) < 0.25) hold(ball, sv);
          else if (ball.state === 'rest' || ball.state === 'roll' || modeT > 4) {
            fetcher = sv;
            toMode('fetch');
          }
          break;
        }
        const set = players.every((p) => dist(p.u, p.v, p.tu, p.tv) < 0.05);
        if ((set && modeT > 0.8) || modeT > 6) {
          toMode('toss');
          play(sv, 'serve', 0.9);
          go(sv, sv.u, sv.v);
        }
        break;
      }
      case 'toss': {
        const sv = server();
        // Up out of the left hand, and hit at the top.
        const h = hand(court, sv, 0.1, 0.25, -0.05);
        const k = Math.min(1, modeT / 0.5);
        ball.x = h.x;
        ball.z = h.z;
        ball.y = h.y + Math.sin(k * Math.PI * 0.9) * 0.32;
        if (modeT >= 0.5) {
          strike(sv, true);
          toMode('rally');
        }
        break;
      }
      case 'rally': {
        if (!shot) break;
        const rcv = shot.receiver;
        if (rcv) rcv.look = toward(rcv.u, rcv.v, ...ballUV());
        // Over the net? A ball too low is stopped by it.
        const [bu, bv] = ballUV();
        if (!shot.netted && shot.bounces === 0 && (Math.sign(bu) !== Math.sign(lastU) || Math.abs(bu) < 0.03) && ball.y < court.y + t.net + ball.r && Math.abs(bv) < court.hw + 0.05 && ball.vy !== 0) {
          shot.netted = true;
          ball.vx *= -0.12;
          ball.vz *= -0.12;
          ball.vy = Math.min(0, ball.vy);
          emit('net', shot.by);
        }
        // The bounce: in or out.
        if (ball.state === 'flight' && ball.y <= court.y + ball.r + 1e-4 && ball.vy > 0) {
          shot.bounces++;
          if (shot.netted) {
            endPoint(other(shot.by), 'into-net');
            break;
          }
          if (shot.bounces === 1) {
            const out = Math.abs(bu) > court.hl + 0.01 || Math.abs(bv) > t.singles + 0.01 || Math.sign(bu) === endOf(shot.by);
            if (out) {
              endPoint(other(shot.by), 'out');
              break;
            }
            emit('bounce', shot.by);
          } else {
            // Twice: nobody got to it.
            endPoint(shot.by, 'winner');
            break;
          }
        }
        // The swing: when the ball comes to them, if they are there.
        if (rcv && clock >= shot.hitAt - 0.15 && !rcv.move && shot.bounces === 1) play(rcv, 'swing', 0.5);
        if (rcv && clock >= shot.hitAt && shot.bounces === 1) {
          const h = hand(court, rcv, REACH * 0.6, STRIKE, 0.08);
          if (Math.hypot(h.x - ball.x, h.z - ball.z) < 0.3) {
            if (finishing && r('last') < 0.4) {
              // Time: they catch it instead.
              hold(ball, rcv);
              endPoint(rcv.team, 'caught');
            } else strike(rcv, false);
          } else shot.receiver = null;
        }
        if (ball.state === 'rest' || ball.state === 'roll') endPoint(shot.bounces >= 1 && !shot.netted ? shot.by : other(shot.by), 'dead');
        break;
      }
      case 'dead': {
        if (modeT > 1.2 && ball.state !== 'flight') {
          if (finishing) {
            toMode('shake');
            break;
          }
          // Change ends if due: everyone walks round the end of the net.
          const wrong = players.some((p) => Math.sign(p.u) !== endOf(p.team) && Math.abs(p.u) > 0.2);
          if (wrong) toMode('swap');
          else toMode('fetch');
        }
        break;
      }
      case 'swap': {
        let all = true;
        for (const p of players) {
          const e = endOf(p.team);
          const there = Math.sign(p.u) === e && Math.abs(p.u) > 0.3;
          if (there) {
            go(p, clampU(e * (court.hl - 0.15)), clampV(p.v), GAME.jog);
            continue;
          }
          all = false;
          // Round the end of the net: out to the side, along it, and in.
          const edge = -lim.v;
          if (Math.abs(p.v - edge) > 0.06 && Math.abs(p.u) > 0.15) go(p, p.u, edge, GAME.jog);
          else go(p, clampU(e * (court.hl - 0.15)), edge, GAME.jog);
        }
        if (all || modeT > 14) toMode('fetch');
        break;
      }
      case 'shake': {
        if (phase === 'play') {
          phase = 'shake';
          emit('shake');
          if (ball.holder) {
            const [x, z] = courtPoint(court, endOf(0) * court.hl * 0.6, -t.singles * 0.8);
            launch(ball, x, court.y + ball.r, z, 0.6, ball.touch);
          }
          for (const p of players) {
            const e = endOf(p.team);
            const i = team(p.team).indexOf(p);
            go(p, e * 0.12, clampV((i - (team(p.team).length - 1) / 2) * 0.35), GAME.jog);
            p.look = toward(0, 0, -e, 0);
            p.idle = 'stand';
          }
        }
        const ready = players.every((p) => dist(p.u, p.v, p.tu, p.tv) < 0.06);
        if ((ready || modeT > 9) && shook < 0) {
          shook = modeT;
          for (const p of players) play(p, 'shake', 2.2);
        }
        if (shook >= 0 && modeT - shook > 2.4) {
          phase = 'over';
          toMode('over');
          emit('end');
        }
        break;
      }
      case 'over':
        break;
    }
    if (ball.holder && mode !== 'toss') {
      const h = hand(court, ball.holder, 0.08, 0.25, -0.05);
      ball.x = h.x;
      ball.y = h.y;
      ball.z = h.z;
    } else if (!ball.holder) stepBall(ball, court, dt);
    movePlayers(court, players, dt);
    lastU = ballUV()[0];
  };

  return {
    sport: 'tennis-court',
    court,
    players,
    balls: [ball],
    events,
    get phase() {
      return phase;
    },
    get clock() {
      return clock;
    },
    score,
    get state() {
      return mode;
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
      finishing = true;
    },
  };
}

