// L34: the paddock's grazing animals (U02 'grazer' props, drawn standing
// with their heads down) come alive a little: every so often one shuffles
// round to fresh grass, easing about a quarter turn over a second, and
// grazes on. No new animals: the paddock's own, moved.
//
// Frame: the prop's floor slot. The turn is about the slot (the animal
// stands within a hand of it), smooth while it lasts, still otherwise.

import { multiply, rotationY } from '@/core/mat4';
import { defineBehaviour } from '../api';
import { easeInOut } from '../motion/ease';

interface State {
  turn: number;
  from: number;
  to: number;
  t: number;
  wait: number;
  n: number;
}

export default defineBehaviour({
  prop: 'grazer',
  create(_item, ctx): State {
    return { turn: 0, from: 0, to: 0, t: 1, wait: 5 + 15 * ctx.rand('wait'), n: 0 };
  },
  update(state, dt, signals, ctx) {
    if (state.t >= 1) {
      if (signals.time.isNight) return;
      state.wait -= dt;
      if (state.wait > 0) return;
      const k = state.n++;
      state.from = state.turn;
      // Never far from how it was put: it wanders back as often as away.
      state.to = Math.max(-1, Math.min(1, state.turn + (ctx.rand('turn', k) - 0.5) * 1.4));
      state.t = 0;
      state.wait = 10 + 20 * ctx.rand('wait', k);
    }
    state.t = Math.min(1, state.t + dt / 1.1);
    state.turn = state.from + (state.to - state.from) * easeInOut(state.t);
    ctx.instance.setMatrix(multiply(ctx.instance.base, rotationY(state.turn)));
  },
});
