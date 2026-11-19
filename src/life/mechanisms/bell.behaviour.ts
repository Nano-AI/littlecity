// L29: bells swing at dusk. When the evening comes (the moment lamps can
// first be lit) each belfry rings a peal: the bell swings up to
// MECHANISMS.bellSwing either side, eases off and hangs still again. A
// town's bells start a beat apart (seeded), and a bell already swinging
// when the town opens joins in where it would be. Posed on twos (a swing
// is a drawing); a bounce carries it.
//
// Frame: the 'bell' socket, the pivot under the beam; the bell hangs down
// −Y and swings about X.

import { multiply, rotationX } from '@/core/mat4';
import { MECHANISMS } from '@/style/animation';
import { defineBehaviour, type TimeSignal } from '../api';
import { eveningSeconds } from '../dusk/evening';
import { carryOf } from '../feedback/carry';
import { easeIn, easeOut } from '../motion/ease';
import { onTwos } from '../motion/twos';

/** The swing (radians) of a bell `delay` seconds behind the town's first, at a time. 0 outside its peal. */
export function bellAngle(time: TimeSignal, delay: number, seconds: number): number {
  if (!time.isDusk && !time.isNight) return 0;
  const t = eveningSeconds(time) - delay;
  const len = MECHANISMS.pealTime;
  if (t <= 0 || t >= len) return 0;
  // Rung up over two swings, held, and let die away over the last third.
  const up = easeOut(Math.min(1, t / (MECHANISMS.bellPeriod * 2)));
  const down = t > len * 0.66 ? 1 - easeIn((t - len * 0.66) / (len * 0.34)) : 1;
  return MECHANISMS.bellSwing * up * down * Math.sin((seconds * Math.PI * 2) / MECHANISMS.bellPeriod);
}

export default defineBehaviour({
  actor: 'bell',
  create(_item, ctx) {
    return { delay: ctx.rand('delay') * 2.5, phase: ctx.rand('twos'), still: false };
  },
  update(state, _dt, signals, ctx) {
    const angle = bellAngle(signals.time, state.delay, onTwos(signals.time.seconds, state.phase));
    const carry = carryOf(ctx.stage, ctx.item.home);
    // A still bell is left where the plan put it.
    if (angle === 0 && !carry) {
      if (!state.still) ctx.instance.setMatrix(ctx.instance.base);
      state.still = true;
      return;
    }
    state.still = false;
    const pose = multiply(ctx.instance.base, rotationX(angle));
    ctx.instance.setMatrix(carry ? multiply(carry, pose) : pose);
  },
});
