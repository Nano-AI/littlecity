// L19: a sailboat under way. It follows the sea lane round the island
// (src/rules/life/sea-lanes.fact.ts), faster on a reach than close to the
// wind, heeling away from the breeze, its sails trimmed to it and changing
// sides when the wind crosses the boat (sails.ts). It leaves a trail of
// spreading rings.
//
// Travel (where the boat is on its lane, which way it heads) is smooth,
// every frame. Poses (bob, heel, pitch, the set of the sails) are redrawn on
// twos. Boats on one lane keep their distance: each slows as it comes up on
// the one ahead.
//
// A sailboat anchored to a cell does not sail: it lies there with its sails
// trimmed to the wind (the gallery).

import { SEA_Y } from '@/core/grid';
import type { Mat4 } from '@/core/mat4';
import type { ActorOf, DressingPlan, ShapePlan } from '@/resolve/plan';
import { seaLane, type SeaLane } from '@/rules/life/sea-lanes.fact';
import { BOATS } from '@/style/boats';
import { defineBehaviour, type LifeContext, type LifeStage, type Signals } from '../api';
import { angleDelta, clamp01, glide } from '../motion/ease';
import { fly } from '../motion/pose';
import { Twos } from '../motion/twos';
import { swellAt, wakeRing, type Swell } from './afloat';
import { floatingAt, poseFloating, refloat, type Floating } from './floating';
import { alongRoute, routeLength, waterMask, type Pt } from '@/rules/life/waterway';
import { entryRoute, notePose, townLive } from '../ships/ferry.system';
import { giveWay } from '../ships/news';
import { Sails } from './sails';

/** Boats closer than this to the one ahead slow down; at half of it they stop gaining altogether. */
const GAP = 6;

const smooth = (t: number): number => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/** The boats sailing a stage's lane, by item id: how far along it each is. */
const fleets = new WeakMap<LifeStage, Map<string, { s: number }>>();
function fleetOf(stage: LifeStage): Map<string, { s: number }> {
  let f = fleets.get(stage);
  if (!f) fleets.set(stage, (f = new Map()));
  return f;
}

/** Sails in along its way from the edge; at the end it is on its lane and carries on round it. */
function sailIn(state: SailboatState, ctx: LifeContext<ActorOf<'sailboat'>>, signals: Signals, dt: number): void {
  const c = state.coming!;
  c.s = Math.min(c.len, c.s + BOATS.speed * 0.8 * dt);
  const p = alongRoute(c.route, c.s);
  state.x = p.x;
  state.z = p.z;
  state.yaw += angleDelta(state.yaw, Math.atan2(p.dx, p.dz)) * glide(BOATS.turn * 2, dt);
  const wind = signals.wind(state.x, state.z);
  const sin = Math.sin(state.yaw), cos = Math.cos(state.yaw);
  const step = state.twos.tick(dt);
  if (step > 0) {
    swellAt(signals.time.seconds, state.phase, BOATS.sailLength, wind.strength, state.swell);
    state.sails.trim(step, wind.dirX * cos - wind.dirZ * sin, wind.dirX * sin + wind.dirZ * cos, wind.strength);
  }
  fly(state.x, SEA_Y + state.swell.heave, state.z, state.yaw, state.swell.pitch, state.swell.roll * 0.5, 1, state.m);
  ctx.instance.setMatrix(state.m);
  notePose(ctx.stage, ctx.item.id, state.m);
  state.sails.pose(state.m);
  if (c.s >= c.len - 1e-6) state.coming = null;
}

export interface SailboatState {
  /** Lying at a cell instead of sailing. */
  moored: Floating | null;
  shape: ShapePlan | null;
  dressing: DressingPlan | null;
  lane: SeaLane | null;
  /** Distance along the lane; shared with the fleet. */
  place: { s: number };
  x: number;
  z: number;
  /** Where the boat is off its lane (after the lane moved); it eases back to nothing. */
  offX: number;
  offZ: number;
  yaw: number;
  speed: number;
  /** Poses, held between drawings. */
  heel: number;
  swell: Swell;
  twos: Twos;
  phase: number;
  /** Columns sailed since the last ring of the wake. */
  wake: number;
  sails: Sails;
  started: boolean;
  /** Sailing in from the edge of the map (a sailboat that comes to a town already shown). */
  coming: { route: Pt[]; len: number; s: number } | null;
  m: Mat4;
}

/** How fast a boat sails with the wind `off` radians off its bow, as a fraction of its best. */
export function pointOfSail(off: number): number {
  // Slow close to the wind, best on a reach, a little less dead before it.
  const reach = smooth((off - 0.35) / 1.1);
  const run = 1 - 0.18 * smooth((off - 2.3) / 0.8);
  return (BOATS.beatSpeed + (1 - BOATS.beatSpeed) * reach) * run;
}

function follow(state: SailboatState, ctx: LifeContext<ActorOf<'sailboat'>>, signals: Signals, dt: number): void {
  // The town changed: the lane may have moved. Pick it up from where the boat is.
  if (ctx.shape !== state.shape) {
    state.shape = ctx.shape;
    const lane = seaLane(ctx.shape.facts);
    if (lane.kind === 'none') state.lane = null;
    else {
      if (!state.started) {
        const params = ctx.item.params;
        const count = Math.max(1, params?.count ?? 1);
        state.place.s = (((params?.index ?? 0) + 0.35 * ctx.rand('berth')) / count) * lane.length;
        const p = lane.at(state.place.s);
        state.x = p.x;
        state.z = p.z;
        state.yaw = Math.atan2(p.dx, p.dz);
        state.started = true;
        // A sailboat that comes to a town already shown sails in from the edge of the map to its place on the lane.
        if (townLive(ctx.stage)) {
          const route = entryRoute(waterMask(ctx.shape.facts), p.x, p.z);
          if (route) {
            state.coming = { route, len: routeLength(route), s: 0 };
            state.x = route[0]![0];
            state.z = route[0]![1];
          }
        }
      } else {
        state.place.s = lane.nearest(state.x, state.z);
        const p = lane.at(state.place.s);
        state.offX = state.x - p.x;
        state.offZ = state.z - p.z;
      }
      state.lane = lane;
    }
  }
  const lane = state.lane;
  if (!lane) return;
  if (state.coming) {
    sailIn(state, ctx, signals, dt);
    return;
  }

  const wind = signals.wind(state.x, state.z);
  const sin = Math.sin(state.yaw), cos = Math.cos(state.yaw);
  // The wind in the boat's own frame: across it (+ toward its +X side) and along it (+ from astern).
  const lee = wind.dirX * cos - wind.dirZ * sin;
  const along = wind.dirX * sin + wind.dirZ * cos;
  const off = Math.acos(Math.min(1, Math.max(-1, -along)));

  // ── travel: smooth, every frame ──
  let want = Math.max(BOATS.speedMin, BOATS.speed * pointOfSail(off) * (0.4 + 0.6 * Math.min(1, wind.strength / 0.55)));
  // Keep clear of the boat ahead.
  let gap = Infinity;
  for (const other of fleetOf(ctx.stage).values()) {
    if (other === state.place) continue;
    let d = (other.s - state.place.s) % lane.length;
    if (d < 0) d += lane.length;
    gap = Math.min(gap, d);
  }
  if (gap < GAP) want *= smooth((gap - GAP / 2) / (GAP / 2));
  // Big ships (L38–L42): slow for one ahead, and stand aside out of its way.
  const yieldTo = giveWay(ctx.stage, state.x, state.z, state.yaw);
  want *= yieldTo.slow;
  state.offX += yieldTo.px * dt;
  state.offZ += yieldTo.pz * dt;
  state.speed += (want - state.speed) * glide(0.9, dt);
  state.place.s = (state.place.s + state.speed * dt) % lane.length;
  const p = lane.at(state.place.s);
  // (Not while standing aside for a big ship: it keeps out of the way until the ship has passed.)
  const fade = yieldTo.px !== 0 || yieldTo.pz !== 0 ? 1 : 1 - glide(0.8, dt);
  state.offX *= fade;
  state.offZ *= fade;
  const px = state.x, pz = state.z;
  state.x = p.x + state.offX;
  state.z = p.z + state.offZ;
  state.yaw += angleDelta(state.yaw, Math.atan2(p.dx, p.dz)) * glide(BOATS.turn, dt);
  state.wake += Math.hypot(state.x - px, state.z - pz);

  // ── poses: on twos ──
  const step = state.twos.tick(dt);
  if (step > 0) {
    swellAt(signals.time.seconds, state.phase, BOATS.sailLength, wind.strength, state.swell);
    state.sails.trim(step, lee, along, wind.strength);
    // The hull heels away from the wind, by how hard the sail is drawing across the boat.
    const heel = -BOATS.heel * Math.min(1, wind.strength) * state.sails.fill * Math.sin(off);
    state.heel += (heel - state.heel) * Math.min(1, step * 3);
    if (state.wake > 0.55) {
      state.wake = 0;
      // Left at the stern, where the water closes behind the hull.
      wakeRing(ctx.stage, state.x - sin * BOATS.sailLength * 0.4, state.z - cos * BOATS.sailLength * 0.4, 0.1, 3.4, 1.9);
    }
  }
  const sw = state.swell;
  // Sailing, the bow lifts a touch with speed.
  fly(state.x, SEA_Y + sw.heave, state.z, state.yaw, sw.pitch + 0.03 * Math.min(1, state.speed / BOATS.speed), sw.roll * 0.5 + state.heel, 1, state.m);
  ctx.instance.setMatrix(state.m);
  notePose(ctx.stage, ctx.item.id, state.m);
  state.sails.pose(state.m);
}

export default defineBehaviour<'sailboat', SailboatState>({
  actor: 'sailboat',
  create(item, ctx) {
    const phase = ctx.rand('swell');
    const state: SailboatState = {
      moored: item.at ? floatingAt(ctx.instance.base, phase, BOATS.sailLength, BOATS.sailBeam) : null,
      shape: null,
      dressing: null,
      lane: null,
      place: { s: 0 },
      x: 0,
      z: 0,
      offX: 0,
      offZ: 0,
      yaw: 0,
      speed: BOATS.speed * 0.6,
      heel: 0,
      swell: { heave: 0, roll: 0, pitch: 0 },
      twos: new Twos(ctx.rand('twos')),
      phase,
      wake: 0,
      sails: new Sails(ctx.stage, Math.abs(Math.round(item.params?.look ?? 0)), ctx.instance.base),
      started: false,
      coming: null,
      m: new Array<number>(16).fill(0),
    };
    if (!item.at) fleetOf(ctx.stage).set(item.id, state.place);
    return state;
  },
  changed(state, ctx) {
    if (state.moored) refloat(state.moored, ctx.instance.base);
  },
  update(state, dt, signals, ctx) {
    const f = state.moored;
    if (!f) {
      follow(state, ctx, signals, dt);
      return;
    }
    // Lying at a cell: trim the sails to the wind where it lies.
    const wind = signals.wind(f.x, f.z);
    const sin = Math.sin(f.yaw), cos = Math.cos(f.yaw);
    const lee = wind.dirX * cos - wind.dirZ * sin, along = wind.dirX * sin + wind.dirZ * cos;
    const step = state.twos.tick(dt);
    if (step > 0) state.sails.trim(step, lee, along, wind.strength);
    const heel = -BOATS.heel * 0.5 * Math.min(1, wind.strength) * state.sails.fill * Math.sqrt(Math.max(0, 1 - along * along));
    if (poseFloating(f, signals, ctx.instance, ctx.stage, ctx.dressing, heel)) state.sails.pose(f.m);
  },
  dispose(state, ctx) {
    state.sails.release();
    fleetOf(ctx.stage).delete(ctx.item.id);
  },
});
