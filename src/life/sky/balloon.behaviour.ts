// L30: rarely, a hot-air balloon drifts across far behind the island. Every
// few minutes (seeded), by day, it rises in at one end of a line beyond the
// back corner of the map, drifts slowly along it with a gentle sway, and
// sinks away at the other end. Hidden the rest of the time.
//
// Travel is smooth; the sway is posed on twos.

import { compose, rotationZ, scaling, translation } from '@/core/mat4';
import { defineBehaviour } from '../api';
import { easeInOut } from '../motion/ease';
import { onTwos } from '../motion/twos';

/** Seconds between one crossing and the next (each waits this × 0.7–1.3), and how long one lasts. */
export const BALLOON_EVERY = 210;
export const BALLOON_CROSSING = 95;
/** The line it crosses along: beyond the map's north-west edge, the far side in the default view. */
const FROM: readonly [number, number] = [-16, 14];
const TO: readonly [number, number] = [14, -16];

interface State {
  wait: number;
  t: number;
  n: number;
  shown: boolean;
  phase: number;
}

/** Where along its crossing (0–1) and how high, at a time into it. */
export function balloonAt(t: number): { along: number; up: number } {
  const u = t / BALLOON_CROSSING;
  const rise = easeInOut(Math.min(1, u / 0.15)) * (1 - easeInOut(Math.max(0, (u - 0.85) / 0.15)));
  return { along: u, up: rise };
}

export default defineBehaviour({
  actor: 'balloon',
  create(_item, ctx): State {
    ctx.instance.setVisible(false);
    return { wait: BALLOON_EVERY * (0.15 + 0.5 * ctx.rand('first')), t: 0, n: 0, shown: false, phase: ctx.rand('phase') };
  },
  update(state, dt, signals, ctx) {
    if (!state.shown) {
      state.wait -= dt;
      if (state.wait > 0 || !signals.time.isDay) return;
      state.shown = true;
      state.t = 0;
      ctx.instance.setVisible(true);
    }
    state.t += dt;
    if (state.t >= BALLOON_CROSSING) {
      state.shown = false;
      state.wait = BALLOON_EVERY * (0.7 + 0.6 * ctx.rand('wait', state.n++));
      ctx.instance.setVisible(false);
      return;
    }
    const { along, up } = balloonAt(state.t);
    const x = FROM[0] + (TO[0] - FROM[0]) * along, z = FROM[1] + (TO[1] - FROM[1]) * along;
    const y = 3 + 7 * up + 0.25 * Math.sin(state.t * 0.31 + state.phase * 6);
    const sway = 0.05 * Math.sin(onTwos(signals.time.seconds, state.phase) * 0.9 + state.phase * 4);
    ctx.instance.setMatrix(compose(translation(x, y, z), rotationZ(sway), scaling(1.6)));
  },
});
