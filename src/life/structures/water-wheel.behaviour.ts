// R-H16: a watermill's undershot wheel turns steadily with the stream, the
// way the river pushes its lowest paddles (downstream is the wheel's +X at
// the bottom, so it turns about +Z the negative way). Posed on twos, like
// the sails; a landing bounce of the mill carries it.
//
// Frame: the 'wheel-hub' socket (+Z along the axle, out of the wall); the
// wheel lies in the socket's XY plane.

import { multiply, rotationZ } from '@/core/mat4';
import { defineBehaviour } from '../api';
import { carryOf } from '../feedback/carry';
import { Twos } from '../motion/twos';

/** Radians a second: a slow, heavy turn. */
export const WHEEL_SPEED = 0.55;

export default defineBehaviour({
  actor: 'water-wheel',
  create(_item, ctx) {
    return { angle: ctx.rand('angle') * Math.PI * 2, twos: new Twos(ctx.rand('twos')), carried: false };
  },
  update(state, dt, _signals, ctx) {
    const step = state.twos.tick(dt);
    const carry = carryOf(ctx.stage, ctx.item.home);
    if (step === 0 && !carry && !state.carried) return;
    state.angle = (state.angle - WHEEL_SPEED * step) % (Math.PI * 2);
    const pose = multiply(ctx.instance.base, rotationZ(state.angle));
    ctx.instance.setMatrix(carry ? multiply(carry, pose) : pose);
    state.carried = carry !== null;
  },
});
