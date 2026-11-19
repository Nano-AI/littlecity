// Advances the short-lived effects (fx.ts) once a frame, before anything
// else moves, and clears them away with the town.

import { defineSystem } from '../api';
import { fxOf } from './fx';

export default defineSystem({
  id: 'fx',
  order: -100,
  create: (ctx) => fxOf(ctx.stage),
  update(fx, dt) {
    fx.update(dt);
  },
  dispose(fx) {
    fx.dispose();
  },
});
