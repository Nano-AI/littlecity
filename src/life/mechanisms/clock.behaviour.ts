// L29: tower clocks show the game's time. The day runs from six in the
// morning to six in the evening, dusk to nine, the night to five and dawn
// to six again, so the minute hand creeps round about once every 20 s of
// day and the hour hand is where the light says it is.
//
// The actor is the hour hand; it spawns the minute hand. Both turn about
// the dial's +Z (clockwise seen from the front), smoothly: they travel. A
// bounce carries both.

import { multiply, rotationZ, type Mat4Like } from '@/core/mat4';
import { defineBehaviour, type InstanceHandle, type TimeSignal } from '../api';
import { partPhases } from '../signals';
import { carryOf } from '../feedback/carry';

/** Hours on the clock (0–24) at a time of the loop. */
export function gameHour(time: Pick<TimeSignal, 'phase'>): number {
  const p = partPhases();
  const along = (part: 'day' | 'dusk' | 'night' | 'dawn'): number => (time.phase - p[part].start) / (p[part].end - p[part].start);
  if (time.phase < p.day.end) return 6 + 12 * along('day');
  if (time.phase < p.dusk.end) return 18 + 3 * along('dusk');
  if (time.phase < p.night.end) return (21 + 8 * along('night')) % 24;
  return 5 + along('dawn');
}

interface State {
  minute: InstanceHandle;
}

/** A hand's pose: the dial frame turned clockwise (seen from +Z) by `turns` of a full circle. */
const hand = (base: Mat4Like, turns: number): Mat4Like => multiply(base, rotationZ(-turns * Math.PI * 2));

export default defineBehaviour({
  actor: 'clock-hands',
  create(item, ctx): State {
    return { minute: ctx.stage.spawn({ actor: 'clock-hands', variant: 'minute', params: { radius: item.params?.radius ?? 0.25 } }, ctx.instance.base) };
  },
  update(state, _dt, signals, ctx) {
    const hours = gameHour(signals.time);
    const carry = carryOf(ctx.stage, ctx.item.home);
    const base = carry ? multiply(carry, ctx.instance.base) : ctx.instance.base;
    ctx.instance.setMatrix(hand(base, (hours % 12) / 12));
    state.minute.setMatrix(hand(base, hours % 1));
  },
  dispose(state) {
    state.minute.release();
  },
});
