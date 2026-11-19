// L33: a cat on its doorstep. By day it naps, curled low and long beside
// the door, breathing slowly, its ear twitching now and then. As dusk comes
// it wakes with a stretch, sits up and watches the street, turning its head
// to whatever caught its eye; at night it sits on. Dawn: back to sleep.
//
// Poses (breath, twitch, stretch, looks) are on twos; it does not travel.
// Frame: the 'door' socket (on the ground outside the door, +Z out); it sits
// a little to one side of the threshold.

import { compose, multiply, rotationY, scaling, translation } from '@/core/mat4';
import { defineBehaviour, type TimeSignal } from '../api';
import { easeInOut } from '../motion/ease';
import { onTwos } from '../motion/twos';

/** Awake (sitting up) at dusk and through the night; asleep by day and at dawn. */
export const catAwake = (time: TimeSignal): boolean => time.isDusk || time.isNight;

interface State {
  side: number;
  awake: number;
  phase: number;
  drawn: number;
}

export default defineBehaviour({
  actor: 'cat',
  create(_item, ctx): State {
    return { side: ctx.rand('side') < 0.5 ? -1 : 1, awake: -1, phase: ctx.rand('phase'), drawn: NaN };
  },
  update(state, dt, signals, ctx) {
    const want = catAwake(signals.time) ? 1 : 0;
    // Waking and settling take a couple of seconds (a stretch, a turn round).
    state.awake = state.awake < 0 ? want : state.awake + Math.sign(want - state.awake) * Math.min(Math.abs(want - state.awake), dt / 2);
    const p = onTwos(signals.time.seconds, state.phase);
    const w = easeInOut(state.awake);
    const breath = 1 + 0.03 * Math.sin(p * 1.6 + state.phase * 9) * (1 - w);
    const look = w * Math.sin(Math.floor(p / 2.3) * 2.1 + state.phase * 7) * 0.7;
    // Asleep: low and long, head turned along the step. Awake: upright, facing out.
    const sx = 1 + 0.3 * (1 - w), sy = (0.55 + 0.45 * w) * breath, sz = 1 + 0.25 * (1 - w);
    const turn = (1 - w) * state.side * 1.3 + look;
    const key = sx * 3.1 + sy * 7.3 + turn * 11.1;
    if (key === state.drawn) return;
    state.drawn = key;
    ctx.instance.setMatrix(multiply(ctx.instance.base, compose(translation(state.side * 0.24, 0, 0.12), rotationY(turn), scaling(sx, sy, sz))));
  },
});
