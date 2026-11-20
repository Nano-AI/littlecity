// Football (design section 7, "Field"): a few a side on a grass pitch with
// goals, or a kickabout on a plain green between piles of jumpers. Team 0
// shoots at the +u goal. What a watcher sees:
//
//   kick-off   both sides in their own halves, the ball on the centre spot;
//              one taps it to a team-mate and they are off
//   play       the player with the ball runs with it at their feet (it rolls
//              a little ahead of each touch); the nearest opponent comes to
//              close them down and may win it; team-mates run on ahead into
//              space. The ball is passed along the ground, rolling, to a
//              team-mate who runs to meet it; near goal it is shot
//   the shot   a hard low kick at the goal: the goalkeeper (with three or
//              more a side on a pitch) dives across; a save pushes it away,
//              a miss rolls past the post, a goal ends up in the net
//   a goal     the scorer runs off with both fists up, team-mates crowd
//              round, the watchers cheer; then kick-off again by the others
//   the end    handshakes in the middle; the ball is left lying
//
// On a green (children, no goalkeepers) the goals are the jumpers R-G03's
// generator draws at each end.

import { courtLocal, courtPoint, goalOf, type Court } from '@/rules/roles/field.lib';
import { GAME } from '@/style/field';
import { chance, dist, go, hand, hold, inside, jump, launch, makeBall, makePlayer, movePlayers, play, roll, stepBall, SUBSTEP, toward, type Athlete, type Ball, type Game, type GameEvent, type Player } from './kit';

type Mode = 'kickoff' | 'play' | 'shot' | 'goal' | 'shake' | 'over';

export interface FootballOptions {
  seed: number;
  length?: number;
  ball?: { x: number; z: number };
}

/** The goal: on a pitch its posts; on a green the jumpers (courts.ts `green`). */
export function goalMouth(c: Court): { u: number; half: number; height: number } {
  if (c.role === 'kickabout-green') return { u: c.hl, half: Math.min(0.3, c.hw * 0.55), height: 0.2 };
  return goalOf(c);
}

export function football(court: Court, athletes: readonly Athlete[], opts: FootballOptions): Game {
  const seed = opts.seed;
  const length = opts.length ?? GAME.length;
  const green = court.role === 'kickabout-green';
  const goal = goalMouth(court);
  const lim = inside(court);
  const players: Player[] = athletes.map((a, i) => makePlayer(a, (i % 2) as 0 | 1, court));
  const team = (k: 0 | 1): Player[] => players.filter((p) => p.team === k);
  const keeperOf = (k: 0 | 1): Player | null => (!green && team(k).length >= 3 ? team(k)[0]! : null);
  const start = opts.ball ?? { x: court.cx, z: court.cz };
  const ball: Ball = makeBall('football', GAME.football, start.x, court.y + GAME.football, start.z);
  ball.bounce = 0.55;
  ball.drag = 1.1;
  const events: GameEvent[] = [];
  const score: [number, number] = [0, 0];
  let clock = 0;
  let mode: Mode = 'kickoff';
  let modeT = 0;
  let phase: Game['phase'] = 'play';
  let finishing = false;
  let kickoff: 0 | 1 = 0;
  /** At somebody's feet, or loose. */
  let carrier: Player | null = null;
  let decide = 1;
  let touch = 0;
  let count = 0;
  let pressT = 0;
  let scorer: Player | null = null;
  let receiver: Player | null = null;
  let shotBy: 0 | 1 = 0;
  let shooter: Player | null = null;
  let shook = -1;

  const emit = (kind: string, k?: number): void => void events.push({ t: clock, kind, ...(k !== undefined ? { team: k } : {}), x: ball.x, z: ball.z });
  const r = (...parts: (string | number)[]): number => chance(seed, 'fb', count, ...parts);
  const dirOf = (k: 0 | 1): 1 | -1 => (k === 0 ? 1 : -1);
  const other = (k: 0 | 1): 0 | 1 => (k === 0 ? 1 : 0);
  const clampU = (u: number): number => Math.max(-lim.u, Math.min(lim.u, u));
  const clampV = (v: number): number => Math.max(-lim.v, Math.min(lim.v, v));
  const toMode = (m: Mode): void => {
    mode = m;
    modeT = 0;
  };
  const ballUV = (): [number, number] => courtLocal(court, ball.x, ball.z);
  const foot = (p: Player): { x: number; y: number; z: number } => hand(court, p, 0.11, 0);

  /** Home places: a keeper in goal, the rest spread over their half (attacking: further up). */
  const home = (p: Player, attacking: boolean): [number, number] => {
    const k = p.team, s = dirOf(k);
    if (p === keeperOf(k)) return [-s * (court.hl - 0.12), 0];
    const outfield = team(k).filter((q) => q !== keeperOf(k));
    const i = outfield.indexOf(p), n = outfield.length;
    const v = (i - (n - 1) / 2) * Math.min(0.7, (court.hw * 1.5) / Math.max(1, n));
    const depth = ((i % 2) * 0.3 + 0.25) * court.hl;
    return [clampU(s * (attacking ? depth : -depth * 0.8)), clampV(v)];
  };

  /** Passes this side has made since it got the ball. */
  let moves = 0;
  let holding: 0 | 1 = 0;
  const take = (p: Player): void => {
    if (p.team !== holding) moves = 0;
    holding = p.team;
    carrier = p;
    ball.holder = null;
    ball.state = 'roll';
    ball.vx = ball.vz = 0;
    ball.touch = p.team;
    decide = 0.8 + r('decide', clock) * 1.4;
    receiver = null;
    pressT = 0;
  };

  const kickOff = (k: 0 | 1): void => {
    kickoff = k;
    carrier = null;
    const [x, z] = courtPoint(court, 0, 0);
    ball.x = x;
    ball.z = z;
    toMode('kickoff');
  };

  /** A shot: hard and low at the goal; it may be wide, high, saved or in. */
  const shoot = (p: Player): void => {
    count++;
    const s = dirOf(p.team);
    const aim = (r('aim') * 2 - 1) * goal.half * 0.85;
    const miss = r('miss') < 0.4;
    const tv = miss ? Math.sign(aim || 1) * (goal.half + 0.08 + r('wide') * 0.12) : aim;
    const [x, z] = courtPoint(court, s * (court.hl + 0.08), tv);
    const t = 0.45 + dist(p.u, p.v, s * court.hl, tv) * 0.12;
    launch(ball, x, court.y + ball.r + (miss && r('high') < 0.3 ? goal.height + 0.05 : 0.05 + r('h') * 0.1), z, t, p.team);
    play(p, 'kick', 0.4);
    carrier = null;
    shotBy = p.team;
    shooter = p;
    kicker = p;
    kickedAt = clock;
    emit('shot', p.team);
    // The keeper goes for it.
    const kp = keeperOf(other(p.team));
    if (kp) {
      const save = !miss && r('save') < 0.4;
      go(kp, kp.u, clampV(save ? tv : tv * 0.4), GAME.run * 1.4);
      if (Math.abs(tv - kp.v) > 0.12) {
        play(kp, 'dive', 0.7);
        jump(kp, 0.05, 0.45);
      }
      keeperSave = save;
    } else keeperSave = false;
    toMode('shot');
  };
  let keeperSave = false;

  let kicker: Player | null = null;
  let kickedAt = -1;
  const pass = (p: Player, q: Player): void => {
    kicker = p;
    kickedAt = clock;
    moves++;
    count++;
    // Lead the runner a little.
    const s = dirOf(p.team);
    const tu = clampU(q.u + s * 0.25), tv = q.v;
    const [x, z] = courtPoint(court, tu, tv);
    roll(ball, x, z, p.team);
    play(p, 'kick', 0.35);
    carrier = null;
    receiver = q;
    go(q, tu, tv, GAME.run);
    emit('pass', p.team);
  };

  /** Everyone without the ball: attackers to space ahead, defenders back toward goal, one pressing. */
  const arrange = (): void => {
    const [bu, bv] = ballUV();
    const att = carrier ? carrier.team : ball.touch === 1 ? 1 : 0;
    for (const k of [0, 1] as const) {
      const mine = team(k);
      const kp = keeperOf(k);
      // The one of this side nearest the ball goes to it (presses, or chases it loose).
      const near = mine.filter((p) => p !== kp && p !== receiver && p !== carrier).sort((a, b) => dist(a.u, a.v, bu, bv) - dist(b.u, b.v, bu, bv))[0];
      for (const p of mine) {
        if (p === carrier || p === receiver) continue;
        p.idle = 'ready';
        p.look = toward(p.u, p.v, bu, bv);
        if (p === kp) {
          go(p, -dirOf(k) * (court.hl - 0.12), clampV(Math.max(-goal.half, Math.min(goal.half, bv * 0.5))), GAME.jog);
          continue;
        }
        if (p === near && (k !== att || !carrier)) {
          go(p, clampU(bu), clampV(bv), GAME.run);
          continue;
        }
        const [hu, hv] = home(p, k === att);
        // Shift with the ball.
        go(p, clampU(hu + (bu - hu) * 0.3), clampV(hv + (bv - hv) * 0.25), GAME.run * 0.8);
      }
    }
  };

  const loose = (): void => {
    // Whoever's foot reaches it first has it.
    if (ball.y > court.y + ball.r + 0.08) return;
    let best: Player | null = null, bd = 0.13;
    for (const p of players) {
      if (p === kicker && clock - kickedAt < 0.5) continue;
      const f = foot(p);
      const d = Math.hypot(f.x - ball.x, f.z - ball.z);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    if (best) {
      if (best === keeperOf(best.team) && !green) {
        // The keeper gathers it and rolls it out to a team-mate.
        hold(ball, best);
        play(best, 'pass', 0.4);
        keeperHold = 1;
        carrier = best;
      } else take(best);
      emit('control', best.team);
    }
  };
  let keeperHold = 0;

  const shake = (): void => {
    phase = 'shake';
    toMode('shake');
    carrier = null;
    if (ball.holder) {
      ball.holder = null;
      ball.state = 'flight';
    }
    const n = Math.max(team(0).length, team(1).length);
    for (const p of players) {
      const i = team(p.team).indexOf(p);
      go(p, -dirOf(p.team) * 0.13, clampV((i - (n - 1) / 2) * 0.3), GAME.jog);
      p.look = toward(0, 0, dirOf(p.team), 0);
      p.idle = 'stand';
    }
    emit('shake');
  };

  const update = (dt: number): void => {
    clock += dt;
    modeT += dt;
    if (clock >= length) finishing = true;
    if (finishing && phase === 'play' && (mode === 'kickoff' || (mode === 'play' && modeT > 1))) shake();
    switch (mode) {
      case 'kickoff': {
        carrier = null;
        receiver = null;
        for (const p of players) {
          const [u, v] = home(p, false);
          go(p, u, v, GAME.jog);
          p.look = toward(p.u, p.v, 0, 0);
          p.idle = 'ready';
        }
        // The taker stands at the ball; a team-mate beside.
        const taker = team(kickoff).filter((q) => q !== keeperOf(kickoff))[0] ?? team(kickoff)[0]!;
        go(taker, -dirOf(kickoff) * 0.12, 0, GAME.jog);
        const [bu, bv] = ballUV();
        // The ball rolls back to the spot if it is not on it (it was carried there).
        if (dist(bu, bv, 0, 0) > 0.05 && ball.state !== 'flight') {
          const [x, z] = courtPoint(court, 0, 0);
          if (dist(taker.u, taker.v, bu, bv) < 0.2) {
            ball.x = x;
            ball.z = z;
          } else go(taker, clampU(bu), clampV(bv), GAME.jog);
        }
        const set = players.every((p) => dist(p.u, p.v, p.tu, p.tv) < 0.08);
        if ((set && modeT > 1.2) || modeT > 8) {
          const mate = team(kickoff).filter((q) => q !== taker && q !== keeperOf(kickoff))[0];
          if (mate) pass(taker, mate);
          else take(taker);
          emit('kickoff', kickoff);
          toMode('play');
        }
        break;
      }
      case 'play': {
        arrange();
        const c = carrier;
        if (keeperHold > 0 && c && ball.holder === c) {
          keeperHold -= dt;
          const h = hand(court, c, 0.08, 0.22);
          ball.x = h.x;
          ball.y = h.y;
          ball.z = h.z;
          if (keeperHold <= 0) {
            const mate = team(c.team).filter((q) => q !== c).sort((a, b) => dist(a.u, a.v, c.u, c.v) - dist(b.u, b.v, c.u, c.v))[0];
            ball.holder = null;
            ball.state = 'roll';
            ball.y = court.y + ball.r;
            if (mate) pass(c, mate);
            else take(c);
          }
          break;
        }
        if (c) {
          // Running with it: toward goal, swerving a little.
          const s = dirOf(c.team);
          const tu = clampU(s * (court.hl - 0.35)), tv = clampV(c.v * 0.6 + Math.sin(clock * 0.9 + c.a.seed) * court.hw * 0.25);
          go(c, tu, tv, GAME.run * 0.85);
          c.look = NaN;
          // The ball a touch ahead: each touch pushes it on, it rolls, the foot catches up.
          touch += dt;
          const ahead = 0.03 + (touch % 0.45) * 0.12;
          const cu = Math.cos(c.face), cv = Math.sin(c.face);
          const [x, z] = courtPoint(court, Math.max(-court.rl + 0.03, Math.min(court.rl - 0.03, c.u + cu * (0.11 + ahead))), Math.max(-court.rw + 0.03, Math.min(court.rw - 0.03, c.v + cv * (0.11 + ahead))));
          ball.x = x;
          ball.z = z;
          ball.y = court.y + ball.r;
          // Pressed: a defender at the ball for long enough wins it.
          const opp = team(other(c.team)).filter((q) => q !== keeperOf(q.team));
          const close = opp.find((q) => Math.hypot(foot(q).x - ball.x, foot(q).z - ball.z) < 0.15);
          pressT = close ? pressT + dt : 0;
          if (close && pressT > 0.5 && r('tackle', Math.floor(clock * 2)) < 0.6) {
            count++;
            emit('tackle', close.team);
            take(close);
            break;
          }
          decide -= dt;
          const toGoal = dist(c.u, c.v, s * court.hl, 0);
          if (toGoal < Math.min(1.1, court.hl * 0.55) && decide < 0.4 && (moves >= 2 || toGoal < 0.55)) shoot(c);
          else if (decide <= 0) {
            const ahead2 = team(c.team).filter((q) => q !== c && q !== keeperOf(q.team) && (q.u - c.u) * s > -0.3);
            const q = ahead2.sort((a, b) => dist(a.u, a.v, c.u, c.v) - dist(b.u, b.v, c.u, c.v))[Math.floor(r('who', clock) * Math.min(2, ahead2.length))];
            if (q && dist(q.u, q.v, c.u, c.v) > 0.4) pass(c, q);
            else decide = 0.6;
          }
        } else {
          if (receiver) {
            const [bu, bv] = ballUV();
            go(receiver, clampU(bu), clampV(bv), GAME.run);
            receiver.look = toward(receiver.u, receiver.v, bu, bv);
          }
          loose();
          if (ball.state === 'rest' && !carrier) receiver = null;
        }
        break;
      }
      case 'shot': {
        arrange();
        const [bu, bv] = ballUV();
        const s = dirOf(shotBy);
        const kp = keeperOf(other(shotBy));
        // The keeper gets a hand to it.
        if (kp && keeperSave && Math.abs(bu - kp.u) < 0.14 && ball.state === 'flight') {
          ball.vx *= -0.35;
          ball.vz = ball.vz * -0.3 + (r('parry') - 0.5) * 0.8;
          ball.vy = Math.abs(ball.vy) * 0.3 + 0.4;
          keeperSave = false;
          emit('save', kp.team);
          toMode('play');
          break;
        }
        if (Math.abs(bu) >= court.hl && Math.sign(bu) === s) {
          if (Math.abs(bv) < goal.half && ball.y < court.y + goal.height) {
            // In! The net takes it.
            ball.vx *= 0.15;
            ball.vz *= 0.15;
            ball.vy = Math.min(ball.vy, 0);
            score[shotBy]++;
            emit('goal', shotBy);
            scorer = shooter;
            toMode('goal');
          } else {
            emit('wide', shotBy);
            toMode('play');
          }
          break;
        }
        if (modeT > 2.5 || ball.state !== 'flight') toMode('play');
        break;
      }
      case 'goal': {
        // The scorer runs off cheering; team-mates crowd round.
        const sc = scorer;
        for (const p of players) {
          if (p.team === shotBy) {
            if (p === sc) {
              go(p, clampU(p.u - dirOf(shotBy) * 0.6), clampV(p.v * 0.5), GAME.run);
              if (!p.move) play(p, 'cheer', 1.2);
            } else if (sc) {
              go(p, clampU(sc.u - dirOf(shotBy) * 0.15), clampV(sc.v + (players.indexOf(p) % 2 ? 0.16 : -0.16)), GAME.run);
              if (modeT > 1 && !p.move) play(p, 'cheer', 0.9);
            }
          } else {
            go(p, p.u, p.v);
            p.idle = 'stand';
          }
        }
        if (modeT > 3) {
          // The ball is carried back to the middle by the side that kicks off.
          const k = other(shotBy);
          const [x, z] = courtPoint(court, 0, 0);
          ball.x = x;
          ball.z = z;
          ball.y = court.y + ball.r;
          ball.vx = ball.vy = ball.vz = 0;
          ball.state = 'rest';
          kickOff(k);
        }
        break;
      }
      case 'shake': {
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
    if (!(carrier && mode === 'play') && !ball.holder) stepBall(ball, court, dt);
    else if (carrier && ball.state === 'flight') ball.state = 'roll';
    movePlayers(court, players, dt);
  };

  return {
    sport: court.role,
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
