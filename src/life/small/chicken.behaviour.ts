// L34: chickens by the vegetable patch. A hen potters about near her spot
// in short dashes, stops, pecks two or three times (a dip on twos), looks
// round, and potters on. At night she sits still (roosting).
//
// Travel is smooth; pecks and looks are posed on twos.

import { positionOf, type Mat4 } from '@/core/mat4';
import { defineBehaviour } from '../api';
import { angleDelta, easeOut, glide } from '../motion/ease';
import { fly } from '../motion/pose';
import { onTwos } from '../motion/twos';

/** How far from her spot a hen wanders, in columns. */
export const HEN_RANGE = 0.45;

interface State {
  x: number;
  z: number;
  yaw: number;
  fx: number;
  fz: number;
  tx: number;
  tz: number;
  t: number;
  dashing: boolean;
  wait: number;
  n: number;
  phase: number;
  drawn: number;
  m: Mat4;
}

export default defineBehaviour({
  actor: 'chicken',
  create(_item, ctx): State {
    const [x, , z] = positionOf(ctx.instance.base);
    return { x, z, yaw: ctx.rand('yaw') * Math.PI * 2, fx: x, fz: z, tx: x, tz: z, t: 1, dashing: false, wait: ctx.rand('wait') * 2, n: 0, phase: ctx.rand('phase'), drawn: NaN, m: new Array<number>(16).fill(0) };
  },
  update(state, dt, signals, ctx) {
    const [bx, by, bz] = positionOf(ctx.instance.base);
    const night = signals.time.isNight;
    if (state.dashing) {
      state.t = Math.min(1, state.t + dt / 0.45);
      const u = easeOut(state.t);
      state.x = state.fx + (state.tx - state.fx) * u;
      state.z = state.fz + (state.tz - state.fz) * u;
      if (state.t >= 1) {
        state.dashing = false;
        state.wait = 1.2 + 2.5 * ctx.rand('stay', state.n);
      }
    } else if (!night) {
      state.wait -= dt;
      if (state.wait <= 0) {
        const k = state.n++;
        const a = ctx.rand('a', k) * Math.PI * 2, r = HEN_RANGE * Math.sqrt(ctx.rand('r', k));
        state.fx = state.x;
        state.fz = state.z;
        state.tx = bx + Math.sin(a) * r;
        state.tz = bz + Math.cos(a) * r;
        state.t = 0;
        state.dashing = true;
      }
    }
    const heading = state.dashing ? Math.atan2(state.tx - state.fx, state.tz - state.fz) : state.yaw;
    state.yaw += angleDelta(state.yaw, heading) * glide(10, dt);
    // Pecking while she stands (on twos): a quick dip forward, two or three in a row, then a look about.
    const p = onTwos(signals.time.seconds, state.phase);
    const beat = Math.floor(p * 12 + state.phase * 12) % 14;
    const peck = state.dashing || night ? 0 : beat < 6 && beat % 2 === 0 ? 0.5 : 0;
    const look = state.dashing || night ? 0 : beat >= 9 && beat < 12 ? 0.5 : 0;
    const key = state.x * 7.1 + state.z * 3.3 + state.yaw * 5.9 + peck * 13 + look * 17;
    if (key === state.drawn) return;
    state.drawn = key;
    fly(state.x, by, state.z, state.yaw + look, peck, 0, 1, state.m);
    ctx.instance.setMatrix(state.m);
  },
});
