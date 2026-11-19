// L29: shop signs swing in gusts. A hanging sign (D07) is a board on a
// hinge along its bracket: the wind across the board pushes it over, a
// spring brings it back, and it rocks to rest after the gust has passed,
// so a gust front is seen going down a street of shops. Posed on twos.
//
// Frame: the 'sign-bracket' socket: the arm runs out along +Z from the
// wall, the board hangs under it in the YZ plane. It swings about the arm.

import { multiply, rotationZ } from '@/core/mat4';
import { MECHANISMS } from '@/style/animation';
import { defineBehaviour } from '../api';
import { Twos } from '../motion/twos';

/** The push (radians the board would lean) of a wind on a sign whose board faces along world (nx, nz). */
export function signPush(dirX: number, dirZ: number, strength: number, nx: number, nz: number): number {
  return MECHANISMS.signSwing * strength * (dirX * nx + dirZ * nz);
}

interface State {
  angle: number;
  speed: number;
  twos: Twos;
  /** The angle last drawn. */
  shown: number;
}

export default defineBehaviour({
  prop: 'hanging-sign',
  create(_item, ctx): State {
    return { angle: 0, speed: 0, twos: new Twos(ctx.rand('twos')), shown: 0 };
  },
  update(state, dt, signals, ctx) {
    const step = state.twos.tick(dt);
    if (step === 0) return;
    const base = ctx.instance.base;
    const wind = signals.wind(base[12]!, base[14]!);
    // The board's face looks along the frame's +X; the push leans it away from the wind.
    const len = Math.hypot(base[0]!, base[2]!) || 1;
    const push = signPush(wind.dirX, wind.dirZ, wind.strength, base[0]! / len, base[2]! / len);
    // A damped spring toward the pushed angle, integrated in small steps (a step is 1/12 s).
    for (let k = 0; k < 4; k++) {
      const h = step / 4;
      state.speed += ((push - state.angle) * MECHANISMS.signSpring - state.speed * MECHANISMS.signDamp) * h;
      state.angle += state.speed * h;
    }
    state.angle = Math.max(-0.9, Math.min(0.9, state.angle));
    // Redrawn only when it has visibly moved: a sign held over by a steady breeze costs nothing.
    if (Math.abs(state.angle - state.shown) < 0.004) return;
    state.shown = state.angle;
    // Rotating about the arm (+Z) by a positive angle swings the board's foot toward +X: away from a
    // wind blowing along +X.
    ctx.instance.setMatrix(Math.abs(state.angle) < 0.004 ? base : multiply(base, rotationZ(state.angle)));
  },
});
