// L05: now and then a leaf lets go of its tree (a fruit tree drops a petal,
// a little more often) and flutters down: it rocks from side to side like
// a falling sheet of paper, drifts with the wind where it is, lies a moment
// on the ground and is gone. One leaf per tree, hidden between falls.
//
// Travel (the drift down) is smooth; the rocking tilt is posed on twos.

import { positionOf, type Mat4 } from '@/core/mat4';
import { defineBehaviour } from '../api';
import { clamp01, easeIn } from '../motion/ease';
import { fly } from '../motion/pose';
import { onTwos } from '../motion/twos';

/** Seconds between one fall and the next, by kind (each fall waits this × 0.6–1.4). */
export const LEAF_EVERY = { leaf: 40, petal: 18 } as const;
/** Columns a second a leaf sinks. */
const SINK = 0.24;
/** Seconds it lies on the ground before it is gone. */
const LIE = 1.6;

interface State {
  /** Seconds until the next fall (counting down), or −1 while falling. */
  wait: number;
  t: number;
  fall: number;
  x: number;
  y: number;
  z: number;
  ground: number;
  yaw: number;
  phase: number;
  n: number;
  shown: boolean;
  m: Mat4;
}

export default defineBehaviour({
  actor: 'leaf',
  create(item, ctx): State {
    ctx.instance.setVisible(false);
    const every = LEAF_EVERY[item.variant === 'petal' ? 'petal' : 'leaf'];
    return { wait: every * (0.2 + 1.2 * ctx.rand('first')), t: 0, fall: 1, x: 0, y: 0, z: 0, ground: 0, yaw: 0, phase: ctx.rand('phase'), n: 0, shown: false, m: new Array<number>(16).fill(0) };
  },
  update(state, dt, signals, ctx) {
    const petal = ctx.item.variant === 'petal';
    if (state.wait >= 0) {
      state.wait -= dt;
      if (state.wait >= 0) return;
      // Let go: from somewhere round the crown's edge.
      const [bx, by, bz] = positionOf(ctx.instance.base);
      const a = ctx.rand('a', state.n) * Math.PI * 2;
      const r = 0.15 + 0.2 * ctx.rand('r', state.n);
      const h = ctx.item.params?.height ?? 0.7;
      state.x = bx + Math.cos(a) * r;
      state.z = bz + Math.sin(a) * r;
      state.y = by + h * (0.65 + 0.3 * ctx.rand('h', state.n));
      state.ground = by + 0.01;
      state.fall = (state.y - state.ground) / SINK;
      state.yaw = a;
      state.t = 0;
      state.wait = -1;
      state.shown = true;
      ctx.instance.setVisible(true);
    }
    state.t += dt;
    const wind = signals.wind(state.x, state.z);
    if (state.t < state.fall) {
      // Sinking, rocking side to side across its drift, carried by the wind.
      const rock = Math.sin(state.t * 3.1 + state.phase * 6);
      state.y -= SINK * dt * (0.75 + 0.5 * Math.abs(rock));
      const carry = 0.55 * wind.strength * dt;
      state.x += wind.dirX * carry + Math.cos(state.yaw) * rock * 0.14 * dt;
      state.z += wind.dirZ * carry + Math.sin(state.yaw) * rock * 0.14 * dt;
      const tilt = Math.sin(onTwos(state.t, state.phase) * 3.1 + state.phase * 6) * 0.7;
      fly(state.x, Math.max(state.ground, state.y), state.z, state.yaw + state.t * 0.6, 0, tilt, petal ? 1.3 : 1, state.m);
      ctx.instance.setMatrix(state.m);
      return;
    }
    const lying = state.t - state.fall;
    if (lying < LIE) {
      // On the ground: flat, and shrinking away at the end.
      const s = (petal ? 1.3 : 1) * (1 - easeIn(clamp01((lying - LIE * 0.5) / (LIE * 0.5))));
      fly(state.x, state.ground, state.z, state.yaw, 0, 0, Math.max(0.001, s), state.m);
      ctx.instance.setMatrix(state.m);
      return;
    }
    state.n++;
    state.wait = LEAF_EVERY[petal ? 'petal' : 'leaf'] * (0.6 + 0.8 * ctx.rand('wait', state.n));
    state.shown = false;
    ctx.instance.setVisible(false);
  },
});
