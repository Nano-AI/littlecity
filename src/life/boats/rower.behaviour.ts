// L20: the rower. A rowboat waits off one pier end, riding the swell; now
// and then, by day, its rower pulls across to the other pier, waits there a
// while, and rows back. The way across keeps to open water (waterway.ts) and
// is worked out afresh for every crossing, so a dock built in the way is
// rowed round. Under way the boat surges with each stroke and leaves a few
// rings behind it.
//
// Travel is smooth, every frame; the swell is posed on twos.

import { notePose } from '../ships/ferry.system';
import { standAside } from '../ships/news';
import { SEA_Y } from '@/core/grid';
import type { Mat4 } from '@/core/mat4';
import type { ShapePlan } from '@/resolve/plan';
import { alongRoute, routeLength, waterMask, waterRoute, type Pt } from '@/rules/life/waterway';
import { BOATS } from '@/style/boats';
import { defineBehaviour } from '../api';
import { angleDelta, glide } from '../motion/ease';
import { fly } from '../motion/pose';
import { onTwos } from '../motion/twos';
import { swellAt, wakeRing, type Swell } from './afloat';

/** Columns a second, on average, under way. */
export const ROW_SPEED = 0.5;
/** Strokes a second. */
const STROKES = 0.55;
/** Seconds waiting at a pier: the least, and how much longer it may be. */
const WAIT = 30;
const WAIT_MORE = 60;

interface State {
  shape: ShapePlan | null;
  water: Uint8Array | null;
  ends: [Pt, Pt];
  /** The end it waits at, or is rowing to. */
  at: 0 | 1;
  rowing: boolean;
  waitLeft: number;
  waits: number;
  route: Pt[];
  leg: number;
  legLen: number;
  stroke: number;
  x: number;
  z: number;
  yaw: number;
  wake: number;
  phase: number;
  swell: Swell;
  drawn: number;
  m: Mat4;
  /** How much it eased up last frame for a boat in its way (1 not at all). */
  slow: number;
}

const endsOf = (p: { ax?: number; az?: number; bx?: number; bz?: number }): [Pt, Pt] => [
  [p.ax ?? 0, p.az ?? 0],
  [p.bx ?? 0, p.bz ?? 0],
];

export default defineBehaviour({
  actor: 'rower',
  create(item, ctx): State {
    const ends = endsOf(item.params ?? {});
    const [a, b] = ends;
    return {
      shape: null, water: null, ends, at: 0, rowing: false,
      // The first crossing comes sooner than the rest.
      waitLeft: 6 + ctx.rand('first') * 20, waits: 0,
      route: [a], leg: 0, legLen: 1, stroke: 0,
      x: a[0], z: a[1], yaw: Math.atan2(b[0] - a[0], b[1] - a[1]), wake: 0,
      phase: ctx.rand('swell'), swell: { heave: 0, roll: 0, pitch: 0 }, drawn: NaN, m: new Array<number>(16).fill(0), slow: 1,
    };
  },
  changed(state, ctx) {
    state.ends = endsOf(ctx.item.params ?? {});
  },
  update(state, dt, signals, ctx) {
    if (ctx.shape !== state.shape) {
      state.shape = ctx.shape;
      state.water = waterMask(ctx.shape.facts);
      // Under way when the town changed: find the way again from here, if there is one.
      if (state.rowing) {
        const route = waterRoute(state.water, [state.x, state.z], state.ends[state.at], 0.15);
        if (route) {
          state.route = route;
          state.leg = 0;
          state.legLen = Math.max(0.01, routeLength(route));
        }
      }
    }
    const px = state.x, pz = state.z;
    let heading = state.yaw;
    let surge = 0;
    if (!state.rowing) {
      // Waiting: hold off the pier end.
      const [tx, tz] = state.ends[state.at];
      const k = glide(0.8, dt);
      state.x += (tx - state.x) * k;
      state.z += (tz - state.z) * k;
      state.waitLeft -= dt;
      if (state.waitLeft <= 0) {
        const to: 0 | 1 = state.at === 0 ? 1 : 0;
        const route = signals.time.isDay && state.water ? waterRoute(state.water, [state.x, state.z], state.ends[to], 0.15) : null;
        if (route) {
          state.route = route;
          state.leg = 0;
          state.legLen = Math.max(0.01, routeLength(route));
          state.at = to;
          state.rowing = true;
        } else state.waitLeft = 10; // night, or no way across now: look again later
      }
    } else {
      // Under way: each stroke drives the boat on, and it slows between strokes.
      state.stroke += STROKES * dt;
      const pull = Math.max(0, Math.sin(state.stroke * Math.PI * 2));
      surge = pull;
      state.leg = Math.min(state.legLen, state.leg + ROW_SPEED * (0.45 + 1.1 * pull) * dt * state.slow);
      const p = alongRoute(state.route, state.leg);
      state.x = p.x;
      state.z = p.z;
      heading = Math.atan2(p.dx, p.dz);
      if (state.leg >= state.legLen) {
        state.rowing = false;
        state.waitLeft = WAIT + ctx.rand('wait', state.waits++) * WAIT_MORE;
      }
    }
    state.yaw += angleDelta(state.yaw, heading) * glide(BOATS.turn, dt);
    state.wake += Math.hypot(state.x - px, state.z - pz);
    if (state.wake > 0.9) {
      state.wake = 0;
      wakeRing(ctx.stage, state.x - Math.sin(state.yaw) * 0.3, state.z - Math.cos(state.yaw) * 0.3, BOATS.rowBeam * 0.6, 1.8, BOATS.wakeLife);
    }
    const now = onTwos(signals.time.seconds, state.phase);
    if (now !== state.drawn) {
      state.drawn = now;
      swellAt(now, state.phase, BOATS.rowLength, signals.wind(state.x, state.z).strength, state.swell);
    }
    // The bow lifts a little on each pull.
    // Big ships (L38–L42) have the way: it stands aside out of one's way.
    const aside = standAside(ctx.stage, state, state.x, state.z, state.yaw, dt, ctx.item.id);
    state.slow = aside.slow;
    fly(aside.x, SEA_Y + state.swell.heave, aside.z, state.yaw, state.swell.pitch - surge * 0.035, state.swell.roll, 1, state.m);
    ctx.instance.setMatrix(state.m);
    notePose(ctx.stage, ctx.item.id, state.m, 'rower');
  },
});
