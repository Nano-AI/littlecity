// L03: a weathervane swings its head into the wind where it stands, hunting
// a little either side of it, and more in a gust. Posed on twos.

import { multiply, positionOf } from '@/core/mat4';
import { WINDY } from '@/style/animation';
import { defineBehaviour } from '../api';
import { carryOf } from '../feedback/carry';
import { angleDelta, glide } from '../motion/ease';
import { place } from '../motion/pose';
import { Twos } from '../motion/twos';

export default defineBehaviour({
  actor: 'weathervane',
  create(_item, ctx) {
    return { yaw: ctx.rand('yaw') * Math.PI * 2, twos: new Twos(ctx.rand('twos')), phase: ctx.rand('phase') * 6, carried: false };
  },
  update(state, dt, signals, ctx) {
    const step = state.twos.tick(dt);
    const carry = carryOf(ctx.stage, ctx.item.home);
    if (step === 0 && !carry && !state.carried) return;
    const [x, y, z] = positionOf(ctx.instance.base);
    if (step > 0) {
      const wind = signals.wind(x, z);
      // The head (+Z) points where the wind comes from.
      const into = Math.atan2(-wind.dirX, -wind.dirZ);
      const hunt = Math.sin(signals.time.seconds * 2.3 + state.phase) * WINDY.vaneHunt * (0.3 + wind.strength);
      state.yaw += angleDelta(state.yaw, into + hunt) * glide(WINDY.vaneTurn * (0.4 + wind.strength), step);
    }
    const pose = place(x, y, z, state.yaw);
    ctx.instance.setMatrix(carry ? multiply(carry, pose) : pose);
    state.carried = carry !== null;
  },
});
