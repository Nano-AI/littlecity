// L03: windmill sails turn at a speed set by the wind where the mill
// stands. The wheel has weight: it gathers speed in a gust and runs on
// after it. It turns fastest when the wind blows straight into its face.
//
// Frame: the 'mill-hub' socket (+Z along the windshaft, out of the cap); the
// wheel lies in the socket's XY plane and turns about Z. Posed on twos.
//
// The cap does not yaw: it is baked into the windmill's own mesh by its
// generator (see docs/swarm/requests/animation.md).

import { multiply, positionOf, rotationZ } from '@/core/mat4';
import { WINDY } from '@/style/animation';
import { defineBehaviour } from '../api';
import { carryOf } from '../feedback/carry';
import { glide } from '../motion/ease';
import { Twos } from '../motion/twos';

/** How fast a wheel wants to turn (radians a second) in wind of this strength meeting it at this cosine. */
export function sailSpeed(strength: number, facing: number): number {
  // Even side-on the sails catch something; face-on they take it all.
  const bite = 0.35 + 0.65 * Math.abs(facing);
  return WINDY.sailIdle + WINDY.sailSpeed * strength * bite;
}

export default defineBehaviour({
  actor: 'windmill-sails',
  create(_item, ctx) {
    return { angle: ctx.rand('angle') * Math.PI * 2, speed: WINDY.sailIdle, twos: new Twos(ctx.rand('twos')), carried: false };
  },
  update(state, dt, signals, ctx) {
    const step = state.twos.tick(dt);
    const carry = carryOf(ctx.stage, ctx.item.home);
    // While the mill bounces from a landing the wheel rides with it, every frame.
    if (step === 0 && !carry && !state.carried) return;
    const base = ctx.instance.base;
    if (step > 0) {
      const [x, , z] = positionOf(base);
      const wind = signals.wind(x, z);
      // The windshaft's direction on the ground is the frame's +Z.
      const len = Math.hypot(base[8]!, base[10]!) || 1;
      const facing = (wind.dirX * base[8]! + wind.dirZ * base[10]!) / len;
      state.speed += (sailSpeed(wind.strength, facing) - state.speed) * glide(WINDY.sailInertia, step);
      state.angle = (state.angle - state.speed * step) % (Math.PI * 2);
    }
    const pose = multiply(base, rotationZ(state.angle));
    ctx.instance.setMatrix(carry ? multiply(carry, pose) : pose);
    state.carried = carry !== null;
  },
});
