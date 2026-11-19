// L06: the ring round a post, a pillar or a pier standing in the sea. Every
// WINDY.ringEvery seconds a ring leaves the post, spreads to WINDY.ringGrow
// times its size over WINDY.ringLife seconds and sinks away; then the water
// is still for a moment. A pure function of life time, posed on twos, each
// ring on its own beat so a pier's posts never pulse together.
//
// The rule places the actor at a floor slot of the sea-level cell; the post
// itself stands a little further out (a dock's stilt is at the deck's very
// corner, a pier under the cell's side), so the ring is moved there.

import { keyX, keyZ } from '@/core/grid';
import type { Mat4 } from '@/core/mat4';
import type { CellPos, DressingPlan } from '@/resolve/plan';
import { WINDY } from '@/style/animation';
import { DOCK } from '@/style/dock';
import { ringPose } from '../boats/afloat';
import { defineBehaviour } from '../api';
import { onTwos } from '../motion/twos';

const OFFSET: Record<CellPos, readonly [number, number]> = { c: [0, 0], n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0], ne: [1, -1], se: [1, 1], sw: [-1, 1], nw: [-1, -1] };

interface State {
  x: number;
  z: number;
  radius: number;
  phase: number;
  turn: number;
  /** The drawing last posed (so nothing is done between drawings). */
  drawn: number;
  shown: boolean;
  /** The dressing last posed for: when a new one arrives the renderer puts every instance back at rest. */
  dressing: DressingPlan | null;
  m: Mat4;
}

function locate(state: State, at: { cell: number; pos: CellPos } | null, variant: string | undefined, radius: number | undefined): void {
  const stilt = variant === 'stilt';
  state.radius = radius ?? (stilt ? 0.085 : 0.3);
  if (!at) return;
  const [ox, oz] = OFFSET[at.pos];
  // How far from the cell's middle the post stands: a stilt just inside the corner, a pier on the cell's side.
  const out = stilt ? 0.5 - DOCK.stiltInset : at.pos === 'c' ? 0 : 0.5;
  state.x = keyX(at.cell) + 0.5 + ox * out;
  state.z = keyZ(at.cell) + 0.5 + oz * out;
}

export default defineBehaviour<'water-ring', State>({
  actor: 'water-ring',
  create(item, ctx) {
    const state: State = { x: 0, z: 0, radius: 0.1, phase: ctx.rand('beat'), turn: ctx.rand('turn') * Math.PI * 2, drawn: NaN, shown: true, dressing: null, m: new Array<number>(16).fill(0) };
    locate(state, item.at && 'cell' in item.at ? item.at : null, item.variant, item.params?.radius);
    return state;
  },
  changed(state, ctx) {
    const item = ctx.item;
    locate(state, item.at && 'cell' in item.at ? item.at : null, item.variant, item.params?.radius);
    state.drawn = NaN;
  },
  update(state, _dt, signals, ctx) {
    const every = Math.max(0.2, WINDY.ringEvery);
    const now = onTwos(signals.time.seconds, state.phase);
    if (now === state.drawn && ctx.dressing === state.dressing) return;
    if (ctx.dressing !== state.dressing) {
      state.dressing = ctx.dressing;
      state.shown = true;
    }
    state.drawn = now;
    const beat = now / every + state.phase;
    const age = (beat - Math.floor(beat)) * every;
    const life = Math.min(every, WINDY.ringLife);
    if (age >= life) {
      if (state.shown) {
        state.shown = false;
        ctx.instance.setVisible(false);
      }
      return;
    }
    // Each ring is turned a little from the last, so its broken strokes do not repeat.
    ringPose(age / life, state.x, state.z, state.turn + Math.floor(beat) * 2.4, state.radius, state.radius, WINDY.ringGrow, state.m);
    ctx.instance.setMatrix(state.m);
    if (!state.shown) {
      state.shown = true;
      ctx.instance.setVisible(true);
    }
  },
});
