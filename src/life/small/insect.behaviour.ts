// L35: insects, by day only. A butterfly wanders over its garden in loose
// loops that never repeat (three slow sines of unrelated periods), lifting
// and dipping, and beats its wings on twos (squashed across, then open). A
// bee works close round its flowers, quicker and tighter, with a little
// hover-jitter. Both fade in after dawn and are gone at dusk.
//
// Travel is smooth; the wing beat is on twos.

import { positionOf, type Mat4 } from '@/core/mat4';
import { defineBehaviour, type TimeSignal } from '../api';
import { onTwos } from '../motion/twos';

/** Out by day only. */
export const insectsOut = (time: TimeSignal): boolean => time.isDay;

interface State {
  a: number;
  b: number;
  c: number;
  p: number;
  q: number;
  shown: boolean;
  px: number;
  pz: number;
  m: Mat4;
}

export default defineBehaviour({
  actor: 'insect',
  create(_item, ctx): State {
    ctx.instance.setVisible(false);
    return {
      a: 0.21 + 0.18 * ctx.rand('a'),
      b: 0.13 + 0.15 * ctx.rand('b'),
      c: 0.37 + 0.3 * ctx.rand('c'),
      p: ctx.rand('p') * Math.PI * 2,
      q: ctx.rand('q') * Math.PI * 2,
      shown: false,
      px: NaN,
      pz: NaN,
      m: new Array<number>(16).fill(0),
    };
  },
  update(state, _dt, signals, ctx) {
    const out = insectsOut(signals.time);
    if (out !== state.shown) {
      state.shown = out;
      ctx.instance.setVisible(out);
    }
    if (!out) return;
    const bee = ctx.item.variant === 'bee';
    const t = signals.time.seconds;
    const [bx, by, bz] = positionOf(ctx.instance.base);
    const k = bee ? 3.2 : 1;
    const r = bee ? 0.22 : 0.85;
    const x = bx + r * (Math.sin(t * state.a * k + state.p) + 0.4 * Math.sin(t * state.c * k * 1.7 + state.q));
    const z = bz + r * (Math.cos(t * state.b * k + state.q) + 0.4 * Math.sin(t * state.a * k * 2.3 + state.p));
    const y = by + (bee ? 0.18 + 0.05 * Math.sin(t * 9 + state.p) : 0.32 + 0.22 * Math.sin(t * state.c + state.p) + 0.05 * Math.sin(t * 7.1 + state.q));
    const yaw = Number.isNaN(state.px) ? state.p : Math.atan2(x - state.px, z - state.pz);
    state.px = x;
    state.pz = z;
    const p = onTwos(t, state.p);
    // Wing beat on twos: open, half, closed up, half... (a bee's wings are a blur: it just jiggles).
    const beat = bee ? 1 : [1, 0.55, 0.15, 0.55][Math.floor(p * 12) % 4]!;
    const m = state.m;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    // Yaw about Y, squash across (local X) by the beat.
    m[0] = c * beat; m[1] = 0; m[2] = -s * beat; m[3] = 0;
    m[4] = 0; m[5] = 1; m[6] = 0; m[7] = 0;
    m[8] = s; m[9] = 0; m[10] = c; m[11] = 0;
    m[12] = x; m[13] = y + (bee ? 0 : 0.03 * (1 - beat)); m[14] = z; m[15] = 1;
    ctx.instance.setMatrix(m);
  },
});
