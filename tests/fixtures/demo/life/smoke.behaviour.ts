// DEMO FIXTURE. A behaviour: the smoke instance bobs above its chimney.
import { multiply, translation } from '@/core/mat4';
import { defineBehaviour } from '@/life/api';

export default defineBehaviour({
  actor: 'smoke',
  create(_item, ctx) {
    return { age: ctx.rand('phase') * 3, updates: 0 };
  },
  update(state, dt, signals, ctx) {
    state.age += dt;
    state.updates++;
    const lean = signals.wind(0, 0).strength * 0.2;
    ctx.instance.setMatrix(multiply(ctx.instance.base, translation(lean * state.age, (state.age % 3) * 0.3, 0)));
  },
});
