// Swifts (L13). They loop fast round the tallest things in town, each on a
// figure-eight of its own: one lobe goes round the tower's top, the other
// swings out over the roofs, and the whole eight turns slowly about the
// tower so no two passes are the same. They flicker their wings, then
// glide, banking hard.
//
// Most active at dusk: every swift is out and faster then. By day some are
// in; at night nearly all. A swift that goes in dives to the eaves of its
// tower and is gone; it comes out the same way.
//
// Their tower wrecked (or under scaffolding): all of them come out and keep
// out, on a wider, higher eight over the wreck, until it stands again. A
// change in the town never moves a swift in a frame: its eight drifts to
// where the town now puts it (town.ts, drift). A fright makes it climb, once
// however many frights come at once.
//
// Travel and banking are smooth; the wing flicker is on twos.

import { CELL_H, keyX, keyY, keyZ } from '@/core/grid';
import type { Mat4 } from '@/core/mat4';
import type { ActorOf, DressingPlan, ShapePlan } from '@/resolve/plan';
import { BIRDS } from '@/style/birds';
import { defineBehaviour, type LifeContext, type Signals } from '../api';
import { approach, easeInOut, glide, lerp } from '../motion/ease';
import { fly, yawOf } from '../motion/pose';
import { onTwos } from '../motion/twos';
import { attitude, steer, Wings, type Attitude } from './flight';
import { scareDistance, scaresOf } from './scare';
import { drift, tallestNear, wrecked } from './town';

type Ctx = LifeContext<ActorOf<'swift'>>;

export interface SwiftState {
  wings: Wings;
  body: Attitude;
  m: Mat4;
  phase: number;
  t: number;
  /** Place on the eight, and which way the eight lies. */
  theta: number;
  phi: number;
  spin: number;
  p1: number;
  r1: number;
  /** The eight: half-length and half-width; the tower's top; how far above it this swift keeps. */
  a: number;
  b: number;
  cx: number;
  cz: number;
  top: number;
  lift: number;
  /** Where the town puts the eight now (the ones above drift here). */
  want: { a: number; b: number; cx: number; cz: number; top: number };
  /** Its tower is a wreck: out, wide and high, until it stands again. */
  homeless: boolean;
  /** The height climbed for a fright so far. */
  rise: number;
  /** 0 in its roost, 1 out and flying. */
  out: number;
  shown: boolean;
  hold: boolean;
  shape: ShapePlan | null;
  dressing: DressingPlan | null;
  seen: number;
  fresh: boolean;
  startle: number;
  boost: number;
  drawn: number;
  wing: number;
}

const TAU = Math.PI * 2;
/** On x = a cos θ, z = b sin 2θ the lobes are centred a / √2 either side of the crossing. */
const LOBE = Math.SQRT1_2;

function survey(s: SwiftState, ctx: Ctx): void {
  const shape = ctx.shape;
  s.shape = shape;
  const params = ctx.item.params ?? {};
  const home = params.home;
  let half = 0.5;
  const w = s.want;
  const around = params.around === undefined ? undefined : shape.structures.get(params.around);
  s.homeless = around !== undefined && wrecked(shape).has(around.id);
  if (around && around.cells.length > 0) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y1 = 0;
    for (const c of around.cells) {
      x0 = Math.min(x0, keyX(c));
      x1 = Math.max(x1, keyX(c));
      z0 = Math.min(z0, keyZ(c));
      z1 = Math.max(z1, keyZ(c));
      y1 = Math.max(y1, keyY(c));
    }
    // Round the highest part of it.
    let n = 0, sx = 0, sz = 0;
    for (const c of around.cells) {
      if (keyY(c) !== y1) continue;
      sx += keyX(c) + 0.5;
      sz += keyZ(c) + 0.5;
      n++;
    }
    w.cx = sx / n;
    w.cz = sz / n;
    half = Math.min(2, Math.sqrt(n) / 2);
    w.top = (y1 + 1) * CELL_H;
  } else if (home !== undefined) {
    w.cx = keyX(home) + 0.5;
    w.cz = keyZ(home) + 0.5;
    w.top = ((params.height ?? keyY(home) + 3) as number) * CELL_H;
  }
  // The near side of the lobe passes (1 − 1/√2) × a from the middle: keep that clear of the walls.
  w.a = Math.max(BIRDS.swiftLoop * (0.85 + 0.3 * s.r1), (half + 0.4) / (1 - LOBE));
  w.b = Math.max(BIRDS.swiftLoopWide * (0.8 + 0.4 * s.r1), half + 0.5);
  // Round its own tower's top, but over everything else its eight sweeps across.
  w.top = Math.max(w.top, clearTop(shape, params.around ?? -1, w.cx, w.cz) + 0.2);
  if (s.homeless) {
    // Over the wreck, wide and high: scattered, not gone.
    w.a *= 1.5;
    w.b *= 1.6;
    w.top += 1.2;
  }
}

/** The eight drifts toward where the town puts it. */
function settleHome(s: SwiftState, dt: number): void {
  const w = s.want;
  s.a = drift(s.a, w.a, dt);
  s.b = drift(s.b, w.b, dt);
  s.cx = drift(s.cx, w.cx, dt);
  s.cz = drift(s.cz, w.cz, dt);
  s.top = drift(s.top, w.top, dt);
}
function snapHome(s: SwiftState): void {
  const w = s.want;
  s.a = w.a;
  s.b = w.b;
  s.cx = w.cx;
  s.cz = w.cz;
  s.top = w.top;
}

/** One answer per town and roost: every swift of a tower asks the same thing. */
const clearTops = new WeakMap<ShapePlan, Map<number, number>>();
function clearTop(shape: ShapePlan, around: number, x: number, z: number): number {
  let byRoost = clearTops.get(shape);
  if (!byRoost) clearTops.set(shape, (byRoost = new Map()));
  const k = around * 4096 + Math.floor(x) * 64 + Math.floor(z);
  let top = byRoost.get(k);
  if (top === undefined) {
    // The widest any eight reaches from its tower.
    const reach = BIRDS.swiftLoop * 1.15 * (1 + LOBE) + BIRDS.swiftLoopWide * 1.2 + 1;
    top = tallestNear(shape, x, z, reach, around);
    byRoost.set(k, top);
  }
  return top;
}

const at = { x: 0, y: 0, z: 0 };
function eight(s: SwiftState): void {
  const u = s.a * (Math.cos(s.theta) + LOBE), v = s.b * Math.sin(2 * s.theta);
  const c = Math.cos(s.phi), n = Math.sin(s.phi);
  at.x = s.cx + u * c - v * n;
  at.z = s.cz + u * n + v * c;
  at.y = s.top + s.lift + 0.3 * Math.sin(s.theta + s.p1) + s.rise;
}

/** The share of the swifts that are out at this time of day. */
function activity(signals: Signals): number {
  const t = signals.time;
  return t.isDusk ? 1 : t.isNight ? BIRDS.swiftNight : t.isDawn ? BIRDS.swiftDawn : BIRDS.swiftDay;
}

export function updateSwift(s: SwiftState, dt: number, signals: Signals, ctx: Ctx): void {
  if (ctx.shape !== s.shape) survey(s, ctx);
  settleHome(s, dt);
  s.t += dt;
  const q = onTwos(s.t, s.phase);
  // The town was just redrawn: every instance is back where the plan has it, and showing.
  const reset = ctx.dressing !== s.dressing;
  const redraw = q !== s.drawn || reset;
  s.drawn = q;
  s.dressing = ctx.dressing;

  if (s.hold) {
    if (!redraw) return;
    const hold = ctx.item.params?.hold ?? 'sit';
    const base = ctx.instance.base;
    fly(base[12]!, base[13]! + (hold === 'sit' ? 0.02 : 0.3), base[14]!, yawOf(base), 0, 0, 1, s.m);
    ctx.instance.setMatrix(s.m);
    s.wings.show(hold !== 'sit');
    s.wings.pose(s.m, hold === 'up' ? 0.55 : hold === 'down' ? -0.35 : -0.06);
    return;
  }

  // In or out?
  const params = ctx.item.params ?? {};
  const index = params.index ?? 0, count = Math.max(1, params.count ?? 1);
  // A wrecked roost has no eaves to go into: they all keep out.
  const want = s.homeless || index < Math.max(1, Math.ceil(count * activity(signals) - 1e-9)) ? 1 : 0;
  s.out = approach(s.out, want, dt / 1.4);
  // Gone in at the eaves (a swift going in is not drawn smaller: it is simply in, once it gets there).
  if (s.out <= 0.02) {
    if (s.shown || reset) {
      s.shown = false;
      ctx.instance.setVisible(false);
      s.wings.show(false);
    }
    s.seen = scaresOf(ctx.stage).seq;
    return;
  }
  if (!s.shown) {
    s.shown = true;
    ctx.instance.setVisible(true);
    s.wings.show(true);
  }

  // L16: a block landing close under it makes it jink up and away.
  const scares = scaresOf(ctx.stage);
  if (scares.seq !== s.seen) {
    for (const e of scares.since(s.seen)) {
      if (e.person || (s.fresh && signals.time.seconds - e.at > 0.6)) continue;
      if (scareDistance(e, s.body.x, s.body.z) > e.radius) continue;
      // Once, however many frights come together.
      s.startle = Math.max(s.startle, 0.4);
      s.boost = 1.2;
    }
    s.seen = scares.seq;
  }
  s.fresh = false;
  s.startle *= Math.exp(-1.3 * dt);
  s.rise += (s.startle - s.rise) * glide(6, dt);
  s.boost = Math.max(0, s.boost - dt);

  const speed = BIRDS.swiftSpeed * (0.88 + 0.24 * s.r1) * (signals.time.isDusk ? BIRDS.swiftDusk : 1) * (s.boost > 0 ? 1.45 : 1);
  // Even speed along the eight: step the angle by distance over the curve's own stretch there.
  const stretch = Math.hypot(s.a * Math.sin(s.theta), 2 * s.b * Math.cos(2 * s.theta));
  s.theta += (speed / Math.max(0.4, stretch)) * dt;
  s.phi += s.spin * dt;
  eight(s);
  const w = easeInOut(s.out);
  const b = s.body;
  // Going in or coming out: between the eight and the eaves of its tower.
  steer(b, lerp(s.cx, at.x, w), lerp(s.top - 0.2, at.y, w), lerp(s.cz, at.z, w), dt, 0.3, 0.95);
  if (redraw) {
    const cycle = (q + s.p1) % 2.3;
    const frame = Math.floor(q * 12 + 0.5);
    s.wing = cycle < 1 || s.boost > 0 ? (frame & 1 ? 0.5 : -0.3) : -0.06 + 0.03 * Math.sin(q * 2 + s.p1);
  }
  fly(b.x, b.y, b.z, b.yaw, b.pitch, b.roll, 1, s.m);
  ctx.instance.setMatrix(s.m);
  s.wings.pose(s.m, s.wing);
}

export default defineBehaviour<'swift', SwiftState>({
  actor: 'swift',
  create(item, ctx) {
    const index = item.params?.index ?? 0, count = Math.max(1, item.params?.count ?? 1);
    const s: SwiftState = {
      wings: new Wings(ctx.stage, 'swift'),
      body: attitude(),
      m: new Array<number>(16).fill(0),
      phase: ctx.rand('twos'),
      t: ctx.rand('clock') * 30,
      theta: ctx.rand('theta') * TAU,
      phi: (index / count + ctx.rand('phi') * 0.3) * TAU,
      spin: (ctx.rand('spin') < 0.5 ? -1 : 1) * (0.03 + 0.04 * ctx.rand('spin-rate')),
      p1: ctx.rand('p1') * TAU,
      r1: ctx.rand('r1'),
      a: BIRDS.swiftLoop, b: BIRDS.swiftLoopWide, cx: 0, cz: 0, top: 3,
      want: { a: BIRDS.swiftLoop, b: BIRDS.swiftLoopWide, cx: 0, cz: 0, top: 3 },
      homeless: false,
      rise: 0,
      lift: 0.15 + 0.55 * ctx.rand('lift'),
      // The first ones start out, so a town is never seen with none.
      out: index < Math.max(1, Math.ceil(count * BIRDS.swiftDay - 1e-9)) ? 1 : 0,
      shown: true,
      hold: Boolean(item.params?.hold),
      shape: null, dressing: null,
      seen: scaresOf(ctx.stage).seq,
      fresh: true,
      startle: 0, boost: 0,
      drawn: NaN,
      wing: -0.06,
    };
    if (s.hold) return s;
    survey(s, ctx);
    snapHome(s);
    eight(s);
    s.wings.show(true);
    return s;
  },
  update: updateSwift,
  changed(s, ctx) {
    s.hold = Boolean(ctx.item.params?.hold);
    s.shape = null;
  },
  dispose(s) {
    s.wings.release();
  },
});
