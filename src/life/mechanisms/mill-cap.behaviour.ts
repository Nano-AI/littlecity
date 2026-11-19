// L03: a windmill's cap comes slowly round to face the wind, as a fantail
// winds it: it closes on the wind's bearing gently and never faster than
// MECHANISMS.capMaxSpeed, so a passing wander of the wind barely moves it.
// The sails at the same hub turn with it (src/life/mechanisms/turn.ts).
//
// Frame: the 'mill-hub' socket; the cap turns about the tower's axis, which
// lies behind the hub by the generator's own hubInNeck. Travel is smooth
// (it is slow); a landing bounce carries it.

import { compose, invertAffine, multiply, rotationY, translation, type Mat4 } from '@/core/mat4';
import { hubInNeck } from '@/gen/windmill/cap';
import { MECHANISMS } from '@/style/animation';
import { WINDMILL } from '@/style/houses';
import { defineBehaviour } from '../api';
import { carryOf } from '../feedback/carry';
import { angleDelta, glide } from '../motion/ease';
import { capTurnTable } from './turn';

interface State {
  /** How far the cap is turned from where it was built (radians, about +Y). */
  turn: number;
  started: boolean;
  /** The tower's axis (world x, z) and the way the built cap faced (yaw). */
  ax: number;
  az: number;
  built: number;
  base: Mat4 | null;
}

/** The turn (about +Y) that brings a cap built facing yaw `built` round into a wind blowing toward (dirX, dirZ). */
export function capTarget(built: number, dirX: number, dirZ: number): number {
  return angleDelta(built, Math.atan2(-dirX, -dirZ));
}

export default defineBehaviour({
  actor: 'mill-cap',
  create(): State {
    return { turn: 0, started: false, ax: 0, az: 0, built: 0, base: null };
  },
  update(state, dt, signals, ctx) {
    const base = ctx.instance.base;
    if (state.base === null || state.base[12] !== base[12] || state.base[14] !== base[14] || state.base[8] !== base[8]) {
      const neck = multiply(base, invertAffine(hubInNeck(WINDMILL.neckR)));
      state.ax = neck[12]!;
      state.az = neck[14]!;
      state.built = Math.atan2(neck[8]!, neck[10]!);
      state.base = Array.from(base);
    }
    const wind = signals.wind(state.ax, state.az);
    const want = capTarget(state.built, wind.dirX, wind.dirZ);
    if (!state.started) {
      // A town opened with the wind already blowing finds its mills already facing it.
      state.turn = want;
      state.started = true;
    } else {
      const d = angleDelta(state.turn, want) * glide(MECHANISMS.capTurn, dt);
      const most = MECHANISMS.capMaxSpeed * dt;
      state.turn += Math.max(-most, Math.min(most, d));
    }
    const turn = compose(translation(state.ax, 0, state.az), rotationY(state.turn), translation(-state.ax, 0, -state.az));
    if (ctx.item.home !== undefined) capTurnTable(ctx.stage).set(ctx.item.home, turn);
    const pose = multiply(turn, base);
    const carry = carryOf(ctx.stage, ctx.item.home);
    ctx.instance.setMatrix(carry ? multiply(carry, pose) : pose);
  },
  dispose(_state, ctx) {
    if (ctx.item.home !== undefined) capTurnTable(ctx.stage).delete(ctx.item.home);
  },
});
