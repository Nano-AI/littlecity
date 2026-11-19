// L29: fountain jets play. The stream itself breathes a little (its reach
// and fall swell and ease, drawn on twos), and beads of water run down it
// from the lip into the pool, one after another, so it reads as water on the
// move. The finial's jet throws its beads up and lets them fall over the
// side. A bounce carries it all.
//
// Frame: the 'water-jet' socket (src/parts/actors/mechanisms/water-jet.part.ts).

import { compose, multiply, scaling, translation, type Mat4Like } from '@/core/mat4';
import { arcPoint, upPoint } from '@/parts/actors/mechanisms/water-jet.part';
import { MECHANISMS } from '@/style/animation';
import { defineBehaviour, type InstanceHandle } from '../api';
import { carryOf } from '../feedback/carry';
import { easeIn } from '../motion/ease';
import { onTwos } from '../motion/twos';

interface State {
  beads: InstanceHandle[];
  phase: number;
  twos: number;
}

/** Where bead `i` of `n` is along its stream at a time: 0 at the lip, 1 in the pool. Beads speed up as they fall. */
export function beadAlong(seconds: number, i: number, n: number, phase: number): number {
  const t = (seconds / Math.max(0.1, MECHANISMS.jetFall) + i / n + phase) % 1;
  return easeIn(t) * 0.7 + t * 0.3;
}

export default defineBehaviour({
  actor: 'water-jet',
  create(_item, ctx): State {
    const n = Math.max(0, Math.round(MECHANISMS.jetBeads));
    const beads: InstanceHandle[] = [];
    for (let i = 0; i < n; i++) beads.push(ctx.stage.spawn({ actor: 'water-jet', variant: 'bead' }, ctx.instance.base));
    return { beads, phase: ctx.rand('phase'), twos: ctx.rand('twos') };
  },
  update(state, _dt, signals, ctx) {
    const s = signals.time.seconds;
    const carry = carryOf(ctx.stage, ctx.item.home);
    const base: Mat4Like = carry ? multiply(carry, ctx.instance.base) : ctx.instance.base;
    const up = ctx.item.variant === 'up';
    const reach = ctx.item.params?.reach ?? 0.09;
    const drop = ctx.item.params?.drop ?? (up ? 0.15 : 0.3);
    // The stream breathes, on twos: a jet pulses taller and shorter; a spill reaches out and back.
    const p = onTwos(s, state.twos);
    const breath = 1 + 0.06 * Math.sin(p * 4.1 + state.phase * 6) + 0.03 * Math.sin(p * 9.7);
    ctx.instance.setMatrix(up ? compose(base, scaling(1, breath, 1)) : compose(base, scaling(1, breath, 1 / breath)));
    const n = state.beads.length;
    for (let i = 0; i < n; i++) {
      const t = beadAlong(s, i, n, state.phase);
      const at = up ? upPoint(0.15 + 0.85 * t, drop * breath, i % 2 === 0 ? 1 : -1) : arcPoint(t, reach * breath, drop / breath);
      const size = 0.7 + 0.5 * Math.sin(t * Math.PI);
      state.beads[i]!.setMatrix(compose(base, translation(at[0], at[1], at[2]), scaling(size)));
    }
  },
  dispose(state) {
    for (const b of state.beads) b.release();
  },
});
