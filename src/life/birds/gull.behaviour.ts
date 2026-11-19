// Gulls (L11). Each gull circles over the water by its home dock, banking
// into the turn, gliding with a few slow beats now and then; every so often
// it spirals down to its perch (a pile, the crane, the lighthouse rail) or
// onto the water beside the dock, sits and looks about, and climbs away
// again. A block landing nearby puts it up at once (L16). At night it stays
// where it sat.
//
// No two gulls share a radius, a height or a rhythm, and each circle drifts
// and breathes slowly, so the flock never turns like a carousel.
//
// Travel is smooth; the wing beat and the sitting bird's looks are on twos.

import { CELL_H, keyX, keyY, keyZ, SEA_Y } from '@/core/grid';
import { positionOf, type Mat4 } from '@/core/mat4';
import type { ActorOf, DressingPlan, ShapePlan } from '@/resolve/plan';
import { BIRDS } from '@/style/birds';
import { defineBehaviour, type LifeContext, type Signals } from '../api';
import { arc, easeInOut, lerp } from '../motion/ease';
import { fly, yawOf } from '../motion/pose';
import { onTwos } from '../motion/twos';
import { attitude, steer, Wings, type Attitude } from './flight';
import { scareDistance, scaresOf } from './scare';
import { floatSpot, tallestNear, waterCentre } from './town';

type Mode = 'fly' | 'land' | 'sit' | 'rise' | 'hold';
type Ctx = LifeContext<ActorOf<'gull'>>;

export interface GullState {
  wings: Wings;
  body: Attitude;
  m: Mat4;
  /** Which of the twelve drawings a second is this bird's. */
  phase: number;
  /** Its own clock, and its place on the circle. */
  t: number;
  theta: number;
  dir: number;
  p1: number;
  p2: number;
  p3: number;
  mode: Mode;
  modeT: number;
  modeLen: number;
  /** Counts its doings, so each gets its own seeded chance. */
  n: number;
  // The circle.
  cx: number;
  cz: number;
  radius: number;
  height: number;
  // Where it settles: a perch, or a spot on the water.
  hasSpot: boolean;
  afloat: boolean;
  px: number;
  py: number;
  pz: number;
  // Where a climb began.
  sx: number;
  sy: number;
  sz: number;
  // Sitting: which way it looks.
  look: number;
  lookFrom: number;
  lookAt: number;
  lookStart: number;
  nextLook: number;
  shape: ShapePlan | null;
  dressing: DressingPlan | null;
  seen: number;
  fresh: boolean;
  /** A fright: extra height that dies away, and seconds of hard beating still to come. */
  startle: number;
  flurry: number;
  drawn: number;
  wing: number;
}

const TAU = Math.PI * 2;
const spot = { x: 0, y: 0, z: 0 };

/** Where the gull's circle is at its clock and angle (into `spot`). */
function orbit(s: GullState): void {
  const r = s.radius * (1 + 0.16 * Math.sin(0.21 * s.t + s.p1));
  spot.x = s.cx + 0.5 * Math.sin(0.083 * s.t + s.p2) + r * Math.cos(s.theta) * (1 + 0.12 * Math.sin(0.13 * s.t + s.p3));
  spot.z = s.cz + 0.5 * Math.cos(0.061 * s.t + s.p3) + r * Math.sin(s.theta);
  spot.y = s.height + 0.2 * Math.sin(0.37 * s.t + s.p1) + 0.1 * Math.sin(0.9 * s.t + s.p2) + s.startle;
}

/** Reads the town: where to circle, how high, and where to settle. */
function survey(s: GullState, ctx: Ctx): void {
  const shape = ctx.shape;
  s.shape = shape;
  const params = ctx.item.params ?? {};
  const base = positionOf(ctx.instance.base);
  const home = params.home;
  const hx = home === undefined ? Math.floor(base[0]) : keyX(home), hz = home === undefined ? Math.floor(base[2]) : keyZ(home);
  const centre = waterCentre(shape, hx, hz, BIRDS.gullReach);
  s.cx = centre?.x ?? hx + 0.5;
  s.cz = centre?.z ?? hz + 0.5;
  s.radius = BIRDS.gullRadius + BIRDS.gullRadiusMore * ctx.rand('radius');
  const over = tallestNear(shape, s.cx, s.cz, s.radius * 1.3 + 1);
  s.height = Math.max(SEA_Y + BIRDS.gullHeight + BIRDS.gullHeightMore * ctx.rand('height'), over + BIRDS.gullClear + 0.5 * ctx.rand('height'));
  // The perch the rule gave it, if it still stands; else a spot on the water near home.
  const socket = params.perch ? shape.sockets.find((k) => k.id === params.perch) : undefined;
  const frame = socket ? ctx.stage.socket(socket.id) : null;
  if (socket && frame) {
    s.hasSpot = true;
    s.afloat = false;
    s.px = frame[12]!;
    s.py = frame[13]!;
    s.pz = frame[14]!;
  } else {
    const water = centre ? floatSpot(shape, hx, hz, 2.6, ctx.seed) ?? centre : null;
    s.hasSpot = water !== null;
    s.afloat = true;
    if (water) {
      s.px = water.x + (ctx.rand('fx') - 0.5) * 0.5;
      s.py = SEA_Y;
      s.pz = water.z + (ctx.rand('fz') - 0.5) * 0.5;
    }
  }
  if (home !== undefined && !centre) s.height = Math.max(s.height, (keyY(home) + 1) * CELL_H + 1);
}

function takeOff(s: GullState, hard: boolean): void {
  s.sx = s.body.x;
  s.sy = s.body.y;
  s.sz = s.body.z;
  s.mode = 'rise';
  s.modeT = 0;
  s.modeLen = BIRDS.gullRise * (hard ? 0.75 : 1);
  if (hard) s.flurry = 1.6;
  s.wings.show(true);
}

function settle(s: GullState, ctx: Ctx): void {
  s.mode = 'sit';
  s.modeT = 0;
  s.modeLen = BIRDS.gullSit * (0.5 + ctx.rand('sit', s.n++));
  s.look = s.lookFrom = s.lookAt = s.body.yaw;
  s.lookStart = 0;
  s.nextLook = 0.8;
  s.body.pitch = s.body.roll = 0;
  s.wings.show(false);
}

/** The wing's lift for this drawing: mostly a glide, with a few slow beats; hard beating when it must work. */
function wingAt(s: GullState, q: number): number {
  const working = s.flurry > 0 || s.mode === 'rise' || (s.mode === 'land' && s.modeT > s.modeLen * 0.72);
  if (working) return 0.1 + 0.62 * Math.sin(TAU * 3 * q + s.p1);
  const cycle = (q + s.p3 * 2) % (5.5 + s.p1 * 0.4);
  if (cycle < 1.15) return 0.14 + 0.48 * Math.sin(TAU * 2.6 * cycle);
  return 0.17 + 0.05 * Math.sin(q * 1.3 + s.p2);
}

export function updateGull(s: GullState, dt: number, signals: Signals, ctx: Ctx): void {
  if (ctx.shape !== s.shape) {
    survey(s, ctx);
    // Its perch went from under it.
    if (s.mode === 'sit' && (!s.hasSpot || Math.hypot(s.px - s.body.x, s.py - s.body.y, s.pz - s.body.z) > 0.05)) takeOff(s, true);
    if (s.mode === 'land' && !s.hasSpot) takeOff(s, false);
  }
  s.t += dt;
  s.modeT += dt;
  const q = onTwos(s.t, s.phase);
  // A new drawing is due; or the town was just redrawn, which puts every instance back where the plan has it.
  const redraw = q !== s.drawn || ctx.dressing !== s.dressing;
  s.drawn = q;
  s.dressing = ctx.dressing;

  if (s.mode === 'hold') {
    if (!redraw) return;
    const hold = ctx.item.params?.hold ?? 'sit';
    const base = ctx.instance.base;
    const up = hold === 'sit' ? 0 : 0.34;
    fly(base[12]!, base[13]! + up, base[14]!, yawOf(base), 0, 0, 1, s.m);
    ctx.instance.setMatrix(s.m);
    s.wings.show(hold !== 'sit');
    s.wings.pose(s.m, hold === 'up' ? 0.72 : hold === 'down' ? -0.42 : 0.16);
    return;
  }

  // L16: a block landing close by.
  const scares = scaresOf(ctx.stage);
  if (scares.seq !== s.seen) {
    for (const e of scares.since(s.seen)) {
      if (e.person || (s.fresh && signals.time.seconds - e.at > 0.6)) continue;
      if (scareDistance(e, s.body.x, s.body.z) > e.radius) continue;
      if (s.mode === 'sit' || s.mode === 'land') takeOff(s, true);
      else {
        s.startle += 0.45;
        s.flurry = 1.3;
      }
    }
    s.seen = scares.seq;
  }
  s.fresh = false;
  s.startle *= Math.exp(-1.1 * dt);
  s.flurry = Math.max(0, s.flurry - dt);

  const b = s.body;
  if (s.mode === 'sit') {
    const night = signals.time.isNight;
    if (s.modeT >= s.modeLen && !night) {
      takeOff(s, false);
    } else {
      if (!redraw) return; // a sitting bird is one drawing until the next
      if (s.modeT >= s.nextLook) {
        // Turn the head (the whole small bird) to look somewhere else.
        s.lookFrom = s.look;
        s.lookAt = s.look + (ctx.rand('look', s.n++) - 0.5) * (night ? 0.5 : 2.6);
        s.lookStart = s.modeT;
        s.nextLook = s.modeT + (night ? 5 : 1.4) + 2.2 * ctx.rand('wait', s.n);
      }
      s.look = lerp(s.lookFrom, s.lookAt, easeInOut((s.modeT - s.lookStart) / 0.3));
      const bob = s.afloat ? 0.012 * Math.sin(q * 1.7 + s.p1) : 0;
      const rock = s.afloat ? 0.06 * Math.sin(q * 1.3 + s.p2) : 0;
      b.yaw = s.look;
      fly(s.px, s.py + bob, s.pz, s.look, 0, rock, 1, s.m);
      ctx.instance.setMatrix(s.m);
      return;
    }
  }

  // On the wing.
  const speed = BIRDS.gullSpeed * (0.9 + 0.25 * s.p2 / TAU) * (s.flurry > 0 ? 1.25 : 1);
  if (s.mode === 'fly') {
    s.theta += ((s.dir * speed) / s.radius) * dt;
    orbit(s);
    steer(b, spot.x, spot.y, spot.z, dt);
    const wantsDown = s.modeT >= s.modeLen || (signals.time.isNight && s.modeT > 3);
    if (wantsDown && s.hasSpot && s.flurry <= 0) {
      s.mode = 'land';
      s.modeT = 0;
      s.modeLen = BIRDS.gullLand * (0.85 + 0.3 * ctx.rand('land', s.n++));
    }
  } else if (s.mode === 'land') {
    const u = Math.min(1, s.modeT / s.modeLen);
    const w = easeInOut(u);
    s.theta += ((s.dir * speed * (1 - 0.5 * w)) / s.radius) * dt;
    orbit(s);
    steer(b, lerp(spot.x, s.px, w), lerp(spot.y, s.py, w) + arc(u) * 0.12, lerp(spot.z, s.pz, w), dt);
    if (u >= 1) {
      b.x = s.px;
      b.y = s.py;
      b.z = s.pz;
      settle(s, ctx);
    }
  } else {
    // rise
    const u = Math.min(1, s.modeT / s.modeLen);
    const w = easeInOut(u);
    s.theta += ((s.dir * speed * (0.5 + 0.5 * w)) / s.radius) * dt;
    orbit(s);
    steer(b, lerp(s.sx, spot.x, w), lerp(s.sy, spot.y, w) + arc(Math.min(1, u * 2.5)) * 0.14 * (1 - u), lerp(s.sz, spot.z, w), dt);
    if (u >= 1) {
      s.mode = 'fly';
      s.modeT = 0;
      s.modeLen = BIRDS.gullAloft * (0.5 + ctx.rand('aloft', s.n++));
    }
  }
  if (redraw) s.wing = wingAt(s, q);
  fly(b.x, b.y, b.z, b.yaw, b.pitch, b.roll, 1, s.m);
  ctx.instance.setMatrix(s.m);
  s.wings.pose(s.m, s.wing);
}

export default defineBehaviour<'gull', GullState>({
  actor: 'gull',
  create(item, ctx) {
    const params = item.params ?? {};
    const index = params.index ?? 0, count = Math.max(1, params.count ?? 1);
    const s: GullState = {
      wings: new Wings(ctx.stage, 'gull'),
      body: attitude(),
      m: new Array<number>(16).fill(0),
      phase: ctx.rand('twos'),
      t: ctx.rand('clock') * 40,
      theta: (index / count + ctx.rand('theta') * 0.6) * TAU,
      dir: ctx.rand('dir') < 0.3 ? -1 : 1,
      p1: ctx.rand('p1') * TAU,
      p2: ctx.rand('p2') * TAU,
      p3: ctx.rand('p3') * TAU,
      mode: params.hold ? 'hold' : 'fly',
      modeT: 0,
      modeLen: BIRDS.gullAloft * (0.25 + ctx.rand('first')),
      n: 0,
      cx: 0, cz: 0, radius: 1, height: 2,
      hasSpot: false, afloat: false, px: 0, py: 0, pz: 0,
      sx: 0, sy: 0, sz: 0,
      look: 0, lookFrom: 0, lookAt: 0, lookStart: 0, nextLook: 0,
      shape: null,
      dressing: null,
      seen: scaresOf(ctx.stage).seq,
      fresh: true,
      startle: 0,
      flurry: 0,
      drawn: NaN,
      wing: 0.16,
    };
    if (s.mode === 'hold') return s;
    survey(s, ctx);
    orbit(s);
    // Some start the day already sitting.
    if (s.hasSpot && ctx.rand('start') < 0.3) {
      s.body.x = s.px;
      s.body.y = s.py;
      s.body.z = s.pz;
      s.body.yaw = ctx.rand('yaw') * TAU;
      s.body.moving = true;
      settle(s, ctx);
    } else {
      const v = s.dir;
      s.body.yaw = Math.atan2(-Math.sin(s.theta) * v, Math.cos(s.theta) * v);
      s.wings.show(true);
    }
    return s;
  },
  update: updateGull,
  changed(s, ctx) {
    if (s.mode !== 'hold') s.shape = null; // read the town again on the next frame (a new perch, a new home)
    else if (!ctx.item.params?.hold) s.mode = 'fly';
  },
  dispose(s) {
    s.wings.release();
  },
});
