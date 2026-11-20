// The playing field's games (design section 7, "Field"): what every game is
// made of. A GAME runs on a court (field.lib.ts) with PLAYERS (residents,
// moved by the game's own choreography while they play) and BALLS (always
// somewhere: in flight, in a hand, at a foot, or lying on the court).
//
// Pure of the clock and of the renderer: time comes from `step(dt)`, chance
// from rand(seed, …), and the chain (src/life/town/chains/field.ts) draws
// what this says. The same seed stepped the same way plays the same game.
//
// Motion follows src/life/MOTION.md: positions glide, drawings are held (a
// run is the crowd's run cycle, its stride advanced by distance so feet do
// not slide; a shot or a swing is a few held drawings played once).

import { rand } from '@/core/rand';
import type { PoseName } from '@/parts/people/pose';
import type { BallKind } from '@/parts/field/balls';
import { courtHeading, courtLocal, courtPoint, type Court } from '@/rules/roles/field.lib';
import { GAME } from '@/style/field';
import { PERSON } from '@/style/people';

/** What a game moves: a resident (crowd.ts Person has all of these), or a stand-in in tests. */
export interface Athlete {
  readonly id: string;
  readonly seed: number;
  readonly child: boolean;
  x: number;
  y: number;
  z: number;
  heading: number;
  pose: PoseName;
  poseTime: number;
  stride: number;
}

export interface Player {
  readonly a: Athlete;
  team: 0 | 1;
  /** Position in court terms (the truth; written to the athlete each step), and the velocity. */
  u: number;
  v: number;
  du: number;
  dv: number;
  /** Where they are going, and how fast they may go (cells a second). */
  tu: number;
  tv: number;
  pace: number;
  /** The court heading to face when not running (NaN: the way they move). */
  look: number;
  /** A move played once (a shot, a pass, a swing), seconds into it, and how long it lasts. */
  move: PoseName | null;
  moveT: number;
  moveLen: number;
  /** The pose when standing still. */
  idle: PoseName;
  /** Seconds in the pose shown now (the drawing's clock; set, never added to, so nobody else's clock can speed it up). */
  poseT: number;
  /** Height off the ground now (a jump), world units, and the jump's clock. */
  lift: number;
  jumpT: number;
  jumpLen: number;
  jumpHigh: number;
  /** Court heading now. */
  face: number;
}

export type BallState = 'held' | 'flight' | 'roll' | 'rest';

export interface Ball {
  readonly kind: BallKind;
  readonly r: number;
  /** World position of its centre and velocity. */
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  state: BallState;
  holder: Player | null;
  /** The team that touched it last (−1: nobody yet). */
  touch: number;
  /** Its turn, as a 3 × 3 rotation (column-major), so seams show it spinning. */
  rot: number[];
  /** How much of a bounce it keeps, and how fast rolling slows (per second). */
  bounce: number;
  drag: number;
}

export interface GameEvent {
  t: number;
  kind: string;
  team?: number;
  /** Where it happened (world x, z), for the watchers. */
  x?: number;
  z?: number;
}

export interface Game {
  readonly sport: Court['role'];
  readonly court: Court;
  readonly players: readonly Player[];
  readonly balls: readonly Ball[];
  /** Everything that happened, in order (the chain reads the new ones each step). */
  readonly events: GameEvent[];
  /** 'play' until time is up, then 'shake' (handshakes), then 'over'. */
  readonly phase: 'play' | 'shake' | 'over';
  readonly clock: number;
  readonly score: readonly [number, number];
  /** What is going on now, in a word (for sequences and tests). */
  readonly state: string;
  step(dt: number): void;
  /** Wind up at the next break in play: shake hands and go. */
  finish(): void;
}

/** The longest step the games take at once (longer ones are cut up), seconds. */
export const SUBSTEP = 1 / 30;

export function makePlayer(a: Athlete, team: 0 | 1, court: Court): Player {
  const [u, v] = courtLocal(court, a.x, a.z);
  const face = Math.atan2(Math.sin(a.heading), Math.cos(a.heading));
  return { a, team, u, v, du: 0, dv: 0, tu: u, tv: v, pace: GAME.jog, look: NaN, move: null, moveT: 0, moveLen: 0, idle: 'ready', poseT: 0, lift: 0, jumpT: 0, jumpLen: 0, jumpHigh: 0, face: faceToCourt(court, face) };
}

/** A world heading as a court heading (both 0 along +z / +u). */
function faceToCourt(c: Court, heading: number): number {
  const dx = Math.sin(heading), dz = Math.cos(heading);
  const [du, dv] = [dx * c.ux + dz * c.uz, dx * c.uz - dz * c.ux];
  return Math.atan2(dv, du);
}

/** The court heading (radians from +u toward +v) that looks from one court point to another. */
export function toward(fu: number, fv: number, tu: number, tv: number): number {
  return Math.atan2(tv - fv, tu - fu);
}

/** Start a move (a shot, a pass, a swing): its drawings play from the start. */
export function play(p: Player, move: PoseName, len: number): void {
  p.move = move;
  p.moveT = 0;
  p.moveLen = len;
}
export function jump(p: Player, high: number, len: number): void {
  p.jumpT = 0;
  p.jumpLen = len;
  p.jumpHigh = high;
}
export function go(p: Player, u: number, v: number, pace: number = GAME.run): void {
  p.tu = u;
  p.tv = v;
  p.pace = pace;
}
export function dist(au: number, av: number, bu: number, bv: number): number {
  return Math.hypot(au - bu, av - bv);
}

/** Bounds a player keeps inside (court terms): the playing rectangle, a body's width in. */
export function inside(c: Court): { u: number; v: number } {
  return { u: c.rl - 0.07, v: c.rw - 0.07 };
}

const TURN = 12;
const ACCEL = 7;
const KEEP = 0.17;

/** Moves every player one step: toward their target, round each other, turning to run, then writes the athletes. */
export function movePlayers(c: Court, players: readonly Player[], dt: number): void {
  const lim = inside(c);
  for (const p of players) {
    // Desired velocity: straight at the target, slowing in the last stretch.
    const dx = p.tu - p.u, dz = p.tv - p.v;
    const d = Math.hypot(dx, dz);
    const pace = (p.a.child ? 0.88 : 1) * p.pace;
    const want = d < 0.02 ? 0 : Math.min(pace, d * 4);
    let wu = d > 1e-6 ? (dx / d) * want : 0, wv = d > 1e-6 ? (dz / d) * want : 0;
    // Round anybody close in the way.
    for (const q of players) {
      if (q === p) continue;
      const ou = p.u - q.u, ov = p.v - q.v, od = Math.hypot(ou, ov);
      if (od < KEEP && od > 1e-6) {
        const push = ((KEEP - od) / KEEP) * 1.6;
        wu += (ou / od) * push;
        wv += (ov / od) * push;
      }
    }
    // A runner turns before going far: no sliding off sideways at speed.
    const sp = Math.hypot(wu, wv);
    if (sp > 0.45) {
      const want = Math.atan2(wv, wu);
      let off = want - p.face;
      off -= Math.round(off / (Math.PI * 2)) * Math.PI * 2;
      if (Math.abs(off) > 1.1) {
        wu *= 0.25;
        wv *= 0.25;
      }
    }
    const k = Math.min(1, ACCEL * dt);
    p.du += (wu - p.du) * k;
    p.dv += (wv - p.dv) * k;
    const pu = p.u, pv = p.v;
    p.u = Math.max(-lim.u, Math.min(lim.u, p.u + p.du * dt));
    p.v = Math.max(-lim.v, Math.min(lim.v, p.v + p.dv * dt));
    const moved = Math.hypot(p.u - pu, p.v - pv);
    const speed = moved / Math.max(dt, 1e-6);
    // Face: the way they run when running, else the way they look (else as they are).
    const wantFace = speed > 0.3 || Number.isNaN(p.look) ? (speed > 0.05 ? Math.atan2(p.v - pv, p.u - pu) : p.face) : p.look;
    let off = wantFace - p.face;
    off -= Math.round(off / (Math.PI * 2)) * Math.PI * 2;
    p.face += Math.max(-TURN * dt, Math.min(TURN * dt, off));
    // Moves and jumps.
    if (p.move) {
      p.moveT += dt;
      if (p.moveT >= p.moveLen) p.move = null;
    }
    if (p.jumpLen > 0) {
      p.jumpT += dt;
      const t = Math.min(1, p.jumpT / p.jumpLen);
      p.lift = Math.sin(t * Math.PI) * p.jumpHigh;
      if (t >= 1) {
        p.jumpLen = 0;
        p.lift = 0;
      }
    }
    // The drawing: the move, else running or walking by speed (stride by distance), else the idle pose.
    const a = p.a;
    let pose: PoseName;
    if (p.move) pose = p.move;
    else if (speed > 0.75) pose = 'run';
    else if (speed > 0.06) pose = 'walk';
    else pose = p.idle;
    if (pose === 'run' || pose === 'walk') {
      a.stride += (moved * PERSON.stepsPerCell * (pose === 'run' ? 0.38 : 0.5)) / (a.child ? 0.8 : 1);
      p.poseT = 0;
    } else if (p.move) p.poseT = p.moveT;
    else p.poseT = pose === a.pose ? p.poseT + dt : 0;
    a.poseTime = p.poseT;
    a.pose = pose;
    const [x, z] = courtPoint(c, p.u, p.v);
    a.x = x;
    a.z = z;
    a.y = c.y + p.lift;
    a.heading = courtHeading(c, Math.cos(p.face), Math.sin(p.face));
  }
}

// ──────────────────────────────────────────────────────────── the ball ──

const IDENTITY3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function makeBall(kind: BallKind, r: number, x: number, y: number, z: number): Ball {
  return { kind, r, x, y, z, vx: 0, vy: 0, vz: 0, state: 'rest', holder: null, touch: -1, rot: IDENTITY3.slice(), bounce: 0.62, drag: 1.4 };
}

/** Turns the ball by `angle` about the unit axis (ax, ay, az) (Rodrigues), in place. */
function turn(b: Ball, ax: number, ay: number, az: number, angle: number): void {
  if (Math.abs(angle) < 1e-7) return;
  const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
  const m = [
    t * ax * ax + c, t * ax * ay + s * az, t * ax * az - s * ay,
    t * ax * ay - s * az, t * ay * ay + c, t * ay * az + s * ax,
    t * ax * az + s * ay, t * ay * az - s * ax, t * az * az + c,
  ];
  const r = b.rot, out = new Array<number>(9);
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 3; row++) out[col * 3 + row] = m[row]! * r[col * 3]! + m[3 + row]! * r[col * 3 + 1]! + m[6 + row]! * r[col * 3 + 2]!;
  }
  b.rot = out;
}

/**
 * The ball loose for one step: falling, bouncing off the court, rolling to a stop. It never leaves the
 * playing rectangle and a margin round it (it stops against the edge, as against the grass). `walls`
 * may add things it bounces off (a net, a goal).
 */
export function stepBall(b: Ball, c: Court, dt: number): void {
  if (b.state === 'held' || b.state === 'rest') return;
  const g = GAME.gravity;
  const floor = c.y + b.r;
  if (b.state === 'flight') {
    b.vy -= g * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    if (b.y <= floor) {
      b.y = floor;
      if (b.vy < -0.35) {
        b.vy = -b.vy * b.bounce;
        b.vx *= 0.86;
        b.vz *= 0.86;
      } else {
        b.vy = 0;
        b.state = 'roll';
      }
    }
  } else {
    const k = Math.exp(-b.drag * dt);
    b.vx *= k;
    b.vz *= k;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.y = floor;
    if (Math.hypot(b.vx, b.vz) < 0.03) {
      b.vx = b.vz = 0;
      b.state = 'rest';
    }
  }
  // The edge of the playing rectangle (and a little grass round it): it stops there.
  const [u, v] = courtLocal(c, b.x, b.z);
  const mu = c.rl + 0.1, mv = c.rw + 0.1;
  if (Math.abs(u) > mu || Math.abs(v) > mv) {
    const [x, z] = courtPoint(c, Math.max(-mu, Math.min(mu, u)), Math.max(-mv, Math.min(mv, v)));
    b.x = x;
    b.z = z;
    b.vx *= 0.2;
    b.vz *= 0.2;
  }
  // Rolling and flying both turn it: about the axis across its motion.
  const sp = Math.hypot(b.vx, b.vz);
  if (sp > 1e-4) turn(b, -b.vz / sp, 0, b.vx / sp, -(sp / b.r) * dt * (b.state === 'roll' ? 1 : 0.4));
}

/** Throws (or hits) the ball from where it is so it reaches (x, y, z) after `t` seconds. */
export function launch(b: Ball, x: number, y: number, z: number, t: number, team = b.touch): void {
  b.holder = null;
  b.state = 'flight';
  b.vx = (x - b.x) / t;
  b.vz = (z - b.z) / t;
  b.vy = (y - b.y + 0.5 * GAME.gravity * t * t) / t;
  b.touch = team;
}

/** Sends the ball rolling along the ground toward (x, z) so it gets about there. */
export function roll(b: Ball, x: number, z: number, team = b.touch): void {
  const dx = x - b.x, dz = z - b.z, d = Math.hypot(dx, dz) || 1;
  // Distance rolled with exponential drag is v / drag: aim a little past so it arrives moving.
  const v = (d * b.drag) * 1.15 + 0.15;
  b.holder = null;
  b.state = 'roll';
  b.vx = (dx / d) * v;
  b.vz = (dz / d) * v;
  b.vy = 0;
  b.touch = team;
}

/** Where a loose ball will be when it is next low enough to take (or where it stops), and how soon. */
export function landing(b: Ball, c: Court, catchHeight: number): { x: number; z: number; t: number } {
  const probe: Ball = { ...b, rot: b.rot };
  let t = 0;
  for (; t < 3; t += SUBSTEP) {
    if (probe.state === 'rest' || probe.state === 'roll' || (probe.vy < 0 && probe.y < c.y + catchHeight)) break;
    stepBall(probe, c, SUBSTEP);
  }
  return { x: probe.x, z: probe.z, t };
}

/** A player's hand (world), `ahead` in front of them at `height` above the ground. */
export function hand(c: Court, p: Player, ahead: number, height: number, side = 0): { x: number; y: number; z: number } {
  const cu = Math.cos(p.face), cv = Math.sin(p.face);
  const [x, z] = courtPoint(c, p.u + cu * ahead - cv * side, p.v + cv * ahead + cu * side);
  return { x, y: c.y + p.lift + height, z };
}

/** Puts the ball in a holder's hands (or at their feet). */
export function hold(b: Ball, p: Player): void {
  b.holder = p;
  b.state = 'held';
  b.vx = b.vy = b.vz = 0;
  b.touch = p.team;
}

/** A seeded chance for a game. */
export function chance(seed: number, ...parts: (number | string)[]): number {
  return rand(seed, 'field-game', ...parts);
}
