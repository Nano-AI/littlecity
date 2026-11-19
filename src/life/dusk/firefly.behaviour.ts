// L10: fireflies in gardens and groves at dusk. Each drifts about its own
// spot on a slow looping path and blinks: lit for a moment, dark for
// as long, each on its own rhythm. They come out when lights can first be
// lit and are gone by the middle of the night.
//
// The drift is travel (smooth); the blink is a pose (on twos). MOTION.md.

import { positionOf, type Mat4 } from '@/core/mat4';
import { defineBehaviour, type TimeSignal } from '../api';
import { place } from '../motion/pose';
import { onTwos } from '../motion/twos';
import { eveningSeconds, nightProgress } from './evening';
import { canGlow, glowOf } from './glow';

/** Fireflies are out from the first lamp-lighting until this far through the night. */
export const FIREFLY_UNTIL = 0.45;

export function firefliesOut(time: TimeSignal): boolean {
  return canGlow(glowOf(time)) && eveningSeconds(time) > 0 && nightProgress(time) < FIREFLY_UNTIL;
}

/** Whether a firefly with this rhythm is lit at this time: lit for half of each period. */
export function flashing(seconds: number, period: number, offset: number): boolean {
  return (seconds / period + offset) % 1 < 0.5;
}

const scratch: Mat4 = new Array<number>(16).fill(0);

export default defineBehaviour({
  actor: 'firefly',
  create(_item, ctx) {
    ctx.instance.setVisible(false);
    return {
      shown: false,
      // Its own loop: two unrelated turns, a height, a rhythm.
      a: 0.25 + 0.3 * ctx.rand('a'),
      b: 0.17 + 0.25 * ctx.rand('b'),
      reach: 0.45 + 0.5 * ctx.rand('reach'),
      height: 0.18 + 0.35 * ctx.rand('height'),
      phase: ctx.rand('phase') * Math.PI * 2,
      period: 1.3 + 1.6 * ctx.rand('period'),
      offset: ctx.rand('offset'),
    };
  },
  update(state, _dt, signals, ctx) {
    const time = signals.time;
    if (!firefliesOut(time)) {
      if (state.shown) {
        state.shown = false;
        ctx.instance.setVisible(false);
      }
      return;
    }
    const t = time.seconds;
    const [x, y, z] = positionOf(ctx.instance.base);
    place(
      x + Math.sin(t * state.a + state.phase) * state.reach,
      y + state.height + Math.sin(t * 0.9 + state.phase * 2) * 0.07,
      z + Math.cos(t * state.b + state.phase * 1.7) * state.reach,
      0, 1, 1, 1, scratch,
    );
    ctx.instance.setMatrix(scratch);
    const lit = flashing(onTwos(t, state.offset), state.period, state.offset);
    // A shaft-of-light surface shows at (0.10 + 0.42 × page glow) × param: this makes the core full bright.
    ctx.instance.setParams(lit ? 1 / (0.1 + 0.42 * glowOf(time)) : 0);
    // Dark between flashes: not drawn at all, so no unlit speck shows.
    if (lit !== state.shown) {
      state.shown = lit;
      ctx.instance.setVisible(lit);
    }
  },
});
