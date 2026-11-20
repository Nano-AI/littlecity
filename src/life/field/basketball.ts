// Basketball (design section 7, "Field"): two or three a side on a hard
// court with a hoop at each end. Team 0 shoots at the +u hoop, team 1 at the
// −u hoop. What a watcher sees, in order:
//
//   pick-up    whoever is nearest the ball (lying where the last game left
//              it) jogs over and picks it up
//   bring-up   the ball carrier dribbles up the court (the ball bouncing at
//              their side); team-mates run to spots round the far key, the
//              defenders get back between them and their hoop
//   set        the carrier dribbles to space, team-mates cut from spot to
//              spot, each defender follows the one they mark (closest to
//              the ball carrier); after a moment the carrier passes (an arc
//              to the open team-mate, who stops to take it), drives at the
//              hoop or shoots
//   shot       crouch, jump, the ball off the fingertips on a high arc; a
//              make drops through the net and bounces under the hoop (the
//              scorers cheer, the watchers clap); a miss clangs off the rim
//              and bounces away
//   loose      the nearest of each side run to where it will come down; the
//              first to it has it: a defender who takes it brings it up the
//              other way, an attacker goes again
//   after a basket the other side takes the ball out under the hoop and
//   brings it up
//   at the end everybody meets at the half-way line and shakes hands; the
//   ball is tossed aside and left lying on the court
//
// The ball is always held, in flight, rolling or at rest: never nowhere.

import { courtLocal, courtPoint, hoopOf, type Court } from '@/rules/roles/field.lib';
import { GAME } from '@/style/field';
import { chance, dist, go, hand, hold, inside, jump, landing, launch, makeBall, makePlayer, movePlayers, play, stepBall, SUBSTEP, toward, type Athlete, type Ball, type Game, type GameEvent, type Player } from './kit';

type Mode = 'pickup' | 'bringup' | 'set' | 'pass' | 'shot' | 'loose' | 'inbound' | 'cheer' | 'shake' | 'over';

/** Hand heights (world units above the court): carried, dribbled at the top of a bounce, shot from. */
const CHEST = 0.27;
const DRIBBLE_TOP = 0.2;
const RELEASE = 0.46;

export interface BasketballOptions {
  seed: number;
  /** Seconds of play before the game winds up. */
  length?: number;
  /** Where the ball lies when the game begins (world x, z); default the middle. */
  ball?: { x: number; z: number };
}

export function basketball(court: Court, athletes: readonly Athlete[], opts: BasketballOptions): Game {
  const seed = opts.seed;
  const length = opts.length ?? GAME.length;
  const hoop = hoopOf(court);
  const lim = inside(court);
  const players: Player[] = athletes.map((a, i) => makePlayer(a, (i % 2) as 0 | 1, court));
  const team = (t: 0 | 1): Player[] => players.filter((p) => p.team === t);
  const start = opts.ball ?? { x: court.cx, z: court.cz };
  const ball: Ball = makeBall('basketball', GAME.basketball, start.x, court.y + GAME.basketball, start.z);
  const events: GameEvent[] = [];
  const score: [number, number] = [0, 0];
  let clock = 0;
  let mode: Mode = 'pickup';
  let modeT = 0;
  let phase: Game['phase'] = 'play';
  let finishing = false;
  /** The side with the ball (attacking: 0 → +u, 1 → −u), and the carrier. */
  let side: 0 | 1 = 0;
  let carrier: Player | null = null;
  let receiver: Player | null = null;
  let decide = 0;
  let passes = 0;
  let count = 0;
  let shot: { make: boolean; at: number; t: number; three: boolean; rimHit: boolean; through: boolean } | null = null;
  /** Where each attacker is headed: an index into the spots. */
  const spotOf = new Map<Player, number>();
  let cutClock = 0;
  /** When the handshakes began (seconds into the shake mode), −1 before. */
  let shook = -1;

  const emit = (kind: string, t?: number, at?: { x: number; z: number }): void => void events.push({ t: clock, kind, ...(t !== undefined ? { team: t } : {}), ...(at ? { x: at.x, z: at.z } : {}) });
  const r = (...parts: (string | number)[]): number => chance(seed, 'bb', count, ...parts);
  const dirOf = (t: 0 | 1): 1 | -1 => (t === 0 ? 1 : -1);
  const rimOf = (t: 0 | 1): { u: number; x: number; y: number; z: number } => {
    const u = dirOf(t) * hoop.u;
    const [x, z] = courtPoint(court, u, 0);
    return { u, x, y: court.y + hoop.height, z };
  };
  const clampU = (u: number): number => Math.max(-lim.u, Math.min(lim.u, u));
  const clampV = (v: number): number => Math.max(-lim.v, Math.min(lim.v, v));

  /** Spots round the far key for the side attacking toward s. */
  const spots = (s: 1 | -1): [number, number][] => {
    const hl = court.hl, hw = court.hw;
    return [
      [s * Math.max(0.2, hl - 1.25), 0],
      [s * (hl - 0.85), hw * 0.72],
      [s * (hl - 0.85), -hw * 0.72],
      [s * (hl - 0.15), hw * 0.85],
      [s * (hl - 0.15), -hw * 0.85],
      [s * (hl - 0.5), 0.3],
      [s * (hl - 0.5), -0.3],
    ].map(([u, v]) => [clampU(u!), clampV(v!)] as [number, number]);
  };

  const otherSide = (t: 0 | 1): 0 | 1 => (t === 0 ? 1 : 0);
  /** How far a player's hand (low, in front) is from the ball, along the ground. */
  const reach = (q: Player): number => {
    const h = hand(court, q, 0.08, 0);
    return Math.hypot(h.x - ball.x, h.z - ball.z);
  };
  const nearestTo = (list: readonly Player[]): Player | undefined => list.slice().sort((a, b) => reach(a) - reach(b) || a.a.id.localeCompare(b.a.id))[0];


  const giveTo = (p: Player): void => {
    hold(ball, p);
    carrier = p;
    side = p.team;
    passes = 0;
  };

  /** Everyone without the ball: attackers to their spots, defenders between their man and the hoop. */
  const arrange = (dt: number): void => {
    const s = dirOf(side);
    const att = team(side), def = team(otherSide(side));
    const list = spots(s);
    cutClock -= dt;
    // Now and then somebody cuts to another spot.
    if (cutClock <= 0) {
      cutClock = 1.2 + r('cut', clock) * 1.6;
      const movers = att.filter((p) => p !== carrier);
      if (movers.length > 0) {
        const p = movers[Math.floor(r('who', clock) * movers.length)]!;
        const taken = new Set([...spotOf.entries()].filter(([q]) => q !== p).map(([, i]) => i));
        const free = list.map((_, i) => i).filter((i) => !taken.has(i));
        if (free.length) spotOf.set(p, free[Math.floor(r('spot', clock) * free.length)]!);
      }
    }
    for (const p of att) {
      if (p === carrier || p === receiver) continue;
      if (!spotOf.has(p)) {
        const taken = new Set(spotOf.values());
        spotOf.set(p, list.findIndex((_, i) => !taken.has(i)));
      }
      const [u, v] = list[Math.max(0, spotOf.get(p)!)]!;
      go(p, u, v, GAME.run * 0.85);
      p.idle = 'ready';
      p.look = toward(p.u, p.v, carrier?.u ?? p.u, carrier?.v ?? p.v);
    }
    const rim = rimOf(side);
    for (const d of def) {
      // Mark the attacker in the same place in the other list; the ball carrier's man plays closer.
      const i = def.indexOf(d);
      const m = att[i % att.length] ?? carrier;
      if (!m) continue;
      const close = m === carrier ? 0.24 : 0.36;
      const du = rim.u - m.u, dv = 0 - m.v, dd = Math.hypot(du, dv) || 1;
      go(d, clampU(m.u + (du / dd) * close), clampV(m.v + (dv / dd) * close), GAME.run * 0.92);
      d.idle = 'ready';
      d.look = toward(d.u, d.v, ball.holder ? ball.holder.u : courtLocal(court, ball.x, ball.z)[0], ball.holder ? ball.holder.v : courtLocal(court, ball.x, ball.z)[1]);
    }
  };

  /** The ball in the carrier's hands: bounced at their side while they move or wait, held up to shoot or pass. */
  const carry = (p: Player): void => {
    const dribbling = p.move === null;
    if (dribbling) {
      // The bounce: down to the floor and up to the hand, four times a second.
      const ph = (clock * 2.6) % 1;
      const h = court.y + ball.r + (DRIBBLE_TOP - ball.r) * Math.abs(Math.cos(ph * Math.PI));
      const at = hand(court, p, 0.11, 0, 0.07);
      ball.x = at.x;
      ball.z = at.z;
      ball.y = h + p.lift;
      if (p.idle !== 'dribble') p.idle = 'dribble';
    } else {
      const at = hand(court, p, 0.08, p.move === 'shoot' ? RELEASE : CHEST);
      ball.x = at.x;
      ball.y = at.y;
      ball.z = at.z;
    }
  };

  const toMode = (m: Mode): void => {
    mode = m;
    modeT = 0;
  };

  /** The best team-mate to pass to: the one furthest from any defender, not too near. */
  const openMate = (p: Player): Player | null => {
    const mates = team(p.team).filter((q) => q !== p);
    let best: Player | null = null, bestScore = -Infinity;
    for (const q of mates) {
      const d = dist(p.u, p.v, q.u, q.v);
      if (d < 0.35) continue;
      const free = Math.min(...team(otherSide(p.team)).map((o) => dist(o.u, o.v, q.u, q.v)), 3);
      const sc = free - d * 0.15;
      if (sc > bestScore) {
        bestScore = sc;
        best = q;
      }
    }
    return best;
  };

  const startShot = (p: Player): void => {
    const rim = rimOf(p.team);
    const d = dist(p.u, p.v, rim.u, 0);
    const three = d > Math.min(court.hw * 0.86, court.hl * 0.62, 1.0) + 0.05;
    const odds = d < 0.5 ? 0.62 : three ? 0.34 : 0.46;
    shot = { make: r('make') < odds, at: 0, t: 0.95 + Math.min(0.35, d * 0.18), three, rimHit: false, through: false };
    go(p, p.u, p.v);
    p.look = toward(p.u, p.v, rim.u, 0);
    play(p, 'shoot', 0.75);
    jump(p, 0.055, 0.5);
    toMode('shot');
    emit('shot', p.team, rim);
  };

  const release = (p: Player): void => {
    const rim = rimOf(p.team);
    const at = hand(court, p, 0.08, RELEASE);
    ball.x = at.x;
    ball.y = at.y;
    ball.z = at.z;
    if (shot!.make) {
      // Through the middle of the ring, coming down.
      launch(ball, rim.x, rim.y + ball.r * 0.6, rim.z, shot!.t, p.team);
    } else {
      // At the rim's near or far edge, or a side of it.
      const a = r('miss-angle') * Math.PI * 2;
      const [ex, ez] = [Math.cos(a) * 0.085, Math.sin(a) * 0.085];
      launch(ball, rim.x + ex, rim.y + ball.r * 0.4, rim.z + ez, shot!.t, p.team);
    }
    carrier = null;
    shot!.at = clock;
  };

  /** The ball near the hoop: through it (a make), or off the rim. */
  const watchShot = (): void => {
    if (!shot || ball.state !== 'flight') return;
    const rim = rimOf(side);
    const since = clock - shot.at;
    if (!shot.make && !shot.rimHit && since >= shot.t - 1e-6) {
      // Clang: up off the rim and away.
      shot.rimHit = true;
      const ox = ball.x - rim.x, oz = ball.z - rim.z, od = Math.hypot(ox, oz) || 1;
      const out = 0.55 + r('rim-out') * 0.65;
      ball.vx = (ox / od) * out + (r('rim-x') - 0.5) * 0.3;
      ball.vz = (oz / od) * out + (r('rim-z') - 0.5) * 0.3;
      ball.vy = 0.9 + r('rim-up') * 0.6;
      emit('rim', side, rim);
      toMode('loose');
      return;
    }
    if (shot.make && !shot.through && ball.y < rim.y - 0.02 && Math.hypot(ball.x - rim.x, ball.z - rim.z) < 0.1) {
      // Swish: the net takes its speed and lets it drop.
      shot.through = true;
      ball.vx *= 0.15;
      ball.vz *= 0.15;
      ball.vy = Math.min(ball.vy, -0.5);
      score[side] += shot.three ? 3 : 2;
      emit('basket', side, rim);
      for (const p of team(side)) {
        play(p, 'cheer', 1.1);
        go(p, p.u, p.v);
      }
      toMode('cheer');
    }
  };

  /** A loose ball: the nearest of each side goes for it; the first there has it. */
  const chase = (): void => {
    const land = landing(ball, court, 0.4);
    const [lu, lv] = courtLocal(court, land.x, land.z);
    for (const t of [0, 1] as const) {
      const mine = team(t).slice().sort((a, b) => dist(a.u, a.v, lu, lv) - dist(b.u, b.v, lu, lv));
      mine.forEach((p, i) => {
        if (i === 0) {
          go(p, clampU(lu), clampV(lv), GAME.run);
          p.idle = 'ready';
        } else {
          // The rest drift back toward the middle, watching.
          go(p, p.u * 0.9, p.v * 0.9, GAME.jog);
          p.idle = 'ready';
        }
        const [bu, bv] = courtLocal(court, ball.x, ball.z);
        p.look = toward(p.u, p.v, bu, bv);
      });
    }
    // Taken by whoever's hands are on it, low enough.
    if (ball.y > court.y + 0.42) return;
    let taker: Player | null = null, best = 0.16;
    for (const p of players) {
      const h = hand(court, p, 0.08, CHEST);
      const d = Math.hypot(h.x - ball.x, h.z - ball.z);
      if (d < best) {
        best = d;
        taker = p;
      }
    }
    if (!taker) return;
    const out = (() => {
      const [u, v] = courtLocal(court, ball.x, ball.z);
      return Math.abs(u) > court.hl || Math.abs(v) > court.hw;
    })();
    const last = ball.touch;
    giveTo(taker);
    emit('rebound', taker.team, ball);
    count++;
    if (out && last === taker.team) {
      // Fetched from out of play: it goes to the other side, taken out where it went off.
      const other = team(otherSide(taker.team)).sort((a, b) => dist(a.u, a.v, taker!.u, taker!.v) - dist(b.u, b.v, taker!.u, taker!.v))[0];
      if (other) {
        giveTo(other);
        const [u, v] = courtLocal(court, ball.x, ball.z);
        go(other, clampU(u), clampV(v), GAME.run);
      }
    }
    spotOf.clear();
    toMode(side === taker.team && dist(carrier!.u, carrier!.v, rimOf(side).u, 0) < court.hl ? 'set' : 'bringup');
    decide = 0.6 + r('decide') * 1.2;
  };

  const shakeHands = (): void => {
    phase = 'shake';
    toMode('shake');
    // The ball tossed aside to lie at the edge of the court.
    if (ball.holder) {
      const [x, z] = courtPoint(court, 0, -court.hw * 0.85);
      launch(ball, x, court.y + ball.r, z, 0.7, ball.touch);
    }
    carrier = null;
    const a = team(0), b = team(1);
    const n = Math.max(a.length, b.length);
    a.forEach((p, i) => {
      go(p, -0.13, clampV(((i - (n - 1) / 2) * 0.32)), GAME.jog);
      p.look = 0;
      p.idle = 'stand';
    });
    b.forEach((p, i) => {
      go(p, 0.13, clampV(((i - (n - 1) / 2) * 0.32)), GAME.jog);
      p.look = Math.PI;
      p.idle = 'stand';
    });
    emit('shake');
  };

  const update = (dt: number): void => {
    clock += dt;
    modeT += dt;
    if (clock >= length) finishing = true;
    const breakInPlay = mode === 'pickup' || mode === 'bringup' || mode === 'inbound' || mode === 'cheer' || (mode === 'set' && modeT > 0.4);
    if (finishing && phase === 'play' && breakInPlay && ball.state !== 'flight') shakeHands();

    switch (mode) {
      case 'pickup': {
        // Whoever is nearest the ball jogs over and picks it up.
        const p = nearestTo(players)!;
        const [bu, bv] = courtLocal(court, ball.x, ball.z);
        go(p, clampU(bu), clampV(bv), GAME.jog);
        p.look = toward(p.u, p.v, bu, bv);
        for (const q of players) if (q !== p) go(q, q.u, q.v);
        if (reach(p) < 0.15) {
          giveTo(p);
          play(p, 'pass', 0.3);
          toMode('bringup');
        }
        break;
      }
      case 'inbound':
      case 'bringup': {
        const p = carrier!;
        const s = dirOf(side);
        // Up the court to just past the middle, a little to one side.
        const tu = clampU(s * Math.max(0.2, court.hl - 1.15)), tv = clampV(((count % 3) - 1) * court.hw * 0.35);
        go(p, tu, tv, GAME.run * 0.8);
        p.look = toward(p.u, p.v, rimOf(side).u, 0);
        arrange(dt);
        if (dist(p.u, p.v, tu, tv) < 0.12 || modeT > 6) {
          toMode('set');
          decide = 0.9 + r('decide', clock) * 1.4;
        }
        break;
      }
      case 'set': {
        const p = carrier!;
        const rim = rimOf(side);
        // Dribble to space now and then: a step to one side or the other.
        if (modeT < 0.05 || (Math.floor(modeT / 0.9) !== Math.floor((modeT - dt) / 0.9))) {
          const to = spots(dirOf(side))[Math.floor(r('space', clock) * 3)]!;
          go(p, (p.u + to[0]) / 2, (p.v + to[1]) / 2, GAME.jog);
        }
        p.look = toward(p.u, p.v, rim.u, 0);
        arrange(dt);
        decide -= dt;
        if (decide <= 0) {
          const d = dist(p.u, p.v, rim.u, 0);
          const roll = r('choice', clock);
          const mate = passes < 3 ? openMate(p) : null;
          if (d < 0.55 || (roll < 0.35 && passes > 0) || (!mate && roll < 0.7)) startShot(p);
          else if (mate && roll < 0.8) {
            receiver = mate;
            play(p, 'pass', 0.3);
            go(p, p.u, p.v);
            p.look = toward(p.u, p.v, mate.u, mate.v);
            go(mate, mate.u, mate.v);
            mate.look = toward(mate.u, mate.v, p.u, p.v);
            toMode('pass');
          } else {
            // Drive: straight at the hoop, then up.
            go(p, clampU(rim.u - dirOf(side) * 0.32), clampV(p.v * 0.2), GAME.run);
            decide = 0.9 + r('drive', clock) * 0.4;
          }
        }
        break;
      }
      case 'pass': {
        const p = carrier, q = receiver!;
        arrange(dt);
        if (p && modeT >= 0.12 && ball.holder === p) {
          // The pass: an arc from chest to chest.
          const at = hand(court, p, 0.1, CHEST);
          ball.x = at.x;
          ball.y = at.y;
          ball.z = at.z;
          const to = hand(court, q, 0.08, CHEST);
          const d = Math.hypot(to.x - at.x, to.z - at.z);
          launch(ball, to.x, to.y, to.z, Math.max(0.35, Math.min(0.85, d / 2.2 + 0.15)), side);
          carrier = null;
          passes++;
          emit('pass', side, ball);
        }
        if (!carrier) {
          q.look = toward(q.u, q.v, ...courtLocal(court, ball.x, ball.z));
          const h = hand(court, q, 0.08, CHEST);
          if (Math.hypot(h.x - ball.x, h.z - ball.z) < 0.12 && Math.abs(h.y - ball.y) < 0.14) {
            giveTo(q);
            passes = Math.max(1, passes);
            receiver = null;
            emit('catch', side, ball);
            toMode('set');
            decide = 0.5 + r('decide', clock) * 1.0;
          } else if (ball.state !== 'flight' || modeT > 2) {
            receiver = null;
            toMode('loose');
          }
        }
        break;
      }
      case 'shot': {
        const p = carrier;
        arrange(dt);
        if (p && modeT >= 0.28) release(p);
        watchShot();
        break;
      }
      case 'cheer': {
        // The ball drops through and bounces; the other side takes it as it comes down, and brings it up.
        if (modeT > 0.8) {
          const near = nearestTo(team(otherSide(side)));
          if (near) {
            const [bu, bv] = courtLocal(court, ball.x, ball.z);
            go(near, clampU(bu), clampV(bv), GAME.run);
            near.look = toward(near.u, near.v, bu, bv);
            if (reach(near) < 0.16 && ball.y < court.y + 0.34) {
              giveTo(near);
              count++;
              shot = null;
              spotOf.clear();
              toMode('bringup');
            }
          }
          // The scorers turn and get back.
          for (const p of team(side)) go(p, clampU(p.u - dirOf(side) * 0.5), p.v, GAME.jog);
        }
        break;
      }
      case 'loose':
        chase();
        break;
      case 'shake': {
        const ready = players.every((p) => Math.abs(p.u - p.tu) < 0.06 && Math.abs(p.v - p.tv) < 0.06);
        if ((ready || modeT > 8) && shook < 0) {
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
    // The ball in hand follows the hand; loose, it flies, bounces and rolls.
    if (ball.holder) carry(ball.holder);
    else stepBall(ball, court, dt);
    movePlayers(court, players, dt);
    if (ball.holder) carry(ball.holder);
  };

  return {
    sport: 'basketball-court',
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
