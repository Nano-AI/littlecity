// L34: sheep on the meadow. A sheep grazes a while (its body nods as it
// crops, on twos), then ambles a cell or two to fresh grass on the same
// meadow, hopping up or down where the ground steps between terraces, and
// grazes again. At night they lie still. A block landing near puts nobody
// off: sheep are like that.
//
// Travel is smooth; the nod and the hop's squash are posed on twos.

import { CELL_H, columnIndex, inColumnBounds, keyX, keyZ } from '@/core/grid';
import { positionOf, type Mat4 } from '@/core/mat4';
import type { ShapePlan } from '@/resolve/plan';
import { meadowOf } from '@/rules/life/L34.grazers.rule';
import { defineBehaviour } from '../api';
import { angleDelta, arc, easeInOut, glide } from '../motion/ease';
import { fly } from '../motion/pose';
import { onTwos } from '../motion/twos';
import { critterPose } from '../mischief/critters';

/** Columns a second, ambling. */
const AMBLE = 0.22;

interface State {
  shape: ShapePlan | null;
  meadow: Set<number>;
  cells: number[];
  x: number;
  z: number;
  yaw: number;
  walking: boolean;
  /** Seconds left grazing, or progress along a walk. */
  wait: number;
  fx: number;
  fz: number;
  tx: number;
  tz: number;
  t: number;
  len: number;
  n: number;
  phase: number;
  drawn: number;
  m: Mat4;
}

const groundAt = (shape: ShapePlan, x: number, z: number): number => {
  const cx = Math.floor(x), cz = Math.floor(z);
  return inColumnBounds(cx, cz) ? shape.terrain.height[columnIndex(cx, cz)]! * CELL_H : 0;
};

export default defineBehaviour({
  actor: 'sheep',
  create(_item, ctx): State {
    const [x, , z] = positionOf(ctx.instance.base);
    return {
      shape: null, meadow: new Set(), cells: [], x, z, yaw: ctx.rand('yaw') * Math.PI * 2, walking: false,
      wait: 3 + 10 * ctx.rand('wait'), fx: x, fz: z, tx: x, tz: z, t: 0, len: 1, n: 0, phase: ctx.rand('phase'), drawn: NaN, m: new Array<number>(16).fill(0),
    };
  },
  update(state, dt, signals, ctx) {
    if (ctx.shape !== state.shape) {
      state.shape = ctx.shape;
      state.cells = meadowOf(ctx.shape.facts);
      state.meadow = new Set(state.cells.map((c) => columnIndex(keyX(c), keyZ(c))));
    }
    const shape = ctx.shape;
    // Mischief: blown about or in the Hand (src/life/mischief/critters.ts): drawn where that says, its own state left be.
    const held = critterPose(ctx.stage, ctx.item.id, 'sheep', state.x, groundAt(shape, state.x, state.z), state.z, state.yaw, 0.3);
    if (held) {
      ctx.instance.setMatrix(held);
      state.drawn = NaN;
      return;
    }
    const night = signals.time.isNight;
    let hop = 0;
    if (!state.walking) {
      state.wait -= dt;
      if (state.wait <= 0 && !night) {
        // To fresh grass a cell or two away, on the meadow.
        const k = state.n++;
        const a = ctx.rand('dir', k) * Math.PI * 2;
        const d = 0.8 + 1.4 * ctx.rand('far', k);
        const tx = state.x + Math.sin(a) * d, tz = state.z + Math.cos(a) * d;
        if (state.meadow.has(columnIndex(Math.floor(tx), Math.floor(tz))) && inColumnBounds(Math.floor(tx), Math.floor(tz))) {
          state.walking = true;
          state.fx = state.x;
          state.fz = state.z;
          state.tx = tx;
          state.tz = tz;
          state.t = 0;
          state.len = d;
        } else state.wait = 1 + 2 * ctx.rand('retry', k);
      }
    }
    if (state.walking) {
      state.t = Math.min(1, state.t + (AMBLE * dt) / state.len);
      const u = easeInOut(state.t);
      state.x = state.fx + (state.tx - state.fx) * u;
      state.z = state.fz + (state.tz - state.fz) * u;
      state.yaw += angleDelta(state.yaw, Math.atan2(state.tx - state.fx, state.tz - state.fz)) * glide(3, dt);
      // Where the ground steps, a little hop.
      const g0 = groundAt(shape, state.fx, state.fz), g1 = groundAt(shape, state.tx, state.tz);
      if (Math.abs(g1 - g0) > 0.01) hop = arc(state.t) * 0.25;
      if (state.t >= 1) {
        state.walking = false;
        state.wait = 6 + 14 * ctx.rand('graze', state.n);
      }
    }
    // Ground under it: a stepped meadow is eased across during a walk.
    const ground = state.walking ? groundAt(shape, state.fx, state.fz) + (groundAt(shape, state.tx, state.tz) - groundAt(shape, state.fx, state.fz)) * easeInOut(state.t) : groundAt(shape, state.x, state.z);
    // Cropping: the body nods on twos while it grazes; still at night.
    const p = onTwos(signals.time.seconds, state.phase);
    const nod = state.walking || night ? 0 : 0.06 * Math.max(0, Math.sin(p * 5 + state.phase * 9));
    // Only a changed drawing is sent: a sheep standing still costs nothing.
    const key = state.x * 7.1 + state.z * 3.3 + (ground + hop) * 11.7 + state.yaw * 5.9 + nod * 13.1;
    if (key === state.drawn) return;
    state.drawn = key;
    fly(state.x, ground + hop, state.z, state.yaw, nod, 0, 1, state.m);
    ctx.instance.setMatrix(state.m);
  },
});
