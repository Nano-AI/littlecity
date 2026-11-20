// The midwinter festival (Seasons, design section 13a). D35 places the festival's lights, wreaths and
// tree in the dressing all year; this system keeps them out of sight until the festival, then puts
// them up house by house as signals.season.festival rises (each house at its own seeded moment, the
// square's tree first), and takes them down the same way as it falls. A string of lights unrolls from
// one end, a tree or a wreath pops in; nothing appears between two frames.
//
// From dusk the bulbs and the star glow (PATTERN.glow, lit through param a as the lamps are), with a
// slow twinkle drawn on twos.

import { compose, multiply, scaling, translation, type Mat4, type Mat4Like } from '@/core/mat4';
import { rand } from '@/core/rand';
import type { PropType } from '@/core/vocab';
import type { DressingPlan, Prop } from '@/resolve/plan';
import { MOTION } from '@/style/animation';
import { defineSystem, type InstanceHandle } from '../api';
import { canGlow, glowOf, litParam } from '../dusk/glow';
import { clamp01, easeIn, pop } from '../motion/ease';
import { seasonOf } from '../season';

export const FESTIVAL_TYPES: ReadonlySet<PropType> = new Set<PropType>(['festival-lights', 'wreath', 'festival-tree']);
/** Seconds a thing takes to go up or come down. */
const RISE = 0.6;
/** The eave strings hang at this height in their frame; they grow out from there. */
const EAVE_Y = -0.14;

interface Item {
  id: string;
  handle: InstanceHandle | null;
  /** The festival level (0 to 1) at which it goes up. */
  at: number;
  /** How it appears: 'line' unrolls along +X, the rest grow from a point. */
  how: 'line' | 'eave' | 'point';
  /** 0 down, 1 up; moves toward `want` over RISE seconds. */
  shown: number;
  want: number;
  /** The last params and matrix scale written (NaN: never). */
  param: number;
  scale: number;
  phase: number;
  bright: number;
}
interface State {
  items: Item[];
  dressing: DressingPlan | null;
  m: Mat4;
}

/** When a prop goes up, 0 to 1 through the festival's rise: by house (its column), the tree first. Pure. */
export function festivalOrder(seed: number, p: Prop, house?: string): number {
  if (p.type === 'festival-tree') return 0.02;
  // Things on one house go up together: its eave strings and its wreath share the house's draw.
  const k = house ?? p.id;
  return 0.06 + 0.9 * rand(seed, 'festival', k);
}

export default defineSystem<State>({
  id: 'seasons.festival',
  order: 21,
  create() {
    return { items: [], dressing: null, m: new Array<number>(16).fill(0) };
  },
  sync(state, next, _prev, ctx) {
    const dressing = next.dressing;
    if (!dressing || dressing === state.dressing) return;
    state.dressing = dressing;
    const was = new Map(state.items.map((i) => [i.id, i]));
    // Which house each thing hangs on (eave strings and wreaths hang from sockets of their house).
    const owner = new Map<string, string>();
    for (const sk of [...next.shape.sockets, ...dressing.sockets]) if (sk.structure !== undefined) owner.set(sk.id, String(sk.structure));
    state.items = [];
    for (const p of dressing.props) {
      if (!FESTIVAL_TYPES.has(p.type)) continue;
      const old = was.get(p.id);
      const how = p.type === 'festival-lights' ? (p.variant === 'eave' ? 'eave' : 'line') : 'point';
      const item: Item = {
        id: p.id,
        handle: ctx.stage.instance(p.id),
        at: festivalOrder(ctx.seed, p, 'socket' in p.at ? owner.get(p.at.socket) : undefined),
        how,
        shown: old?.shown ?? NaN,
        want: old?.want ?? 0,
        param: NaN,
        scale: NaN,
        phase: rand(ctx.seed, 'festival', p.id, 'phase'),
        bright: p.type === 'festival-lights' ? 0.9 : 1,
      };
      state.items.push(item);
    }
    // The view shows every prop it is given: put each back the way it was (the first time, at once).
    const f = seasonOf(ctx.signals).festival;
    for (const it of state.items) {
      if (Number.isNaN(it.shown)) it.shown = it.want = f > it.at ? 1 : 0;
      it.scale = NaN;
      place(it, state.m);
    }
  },
  update(state, dt, signals) {
    if (state.items.length === 0) return;
    const f = seasonOf(signals).festival;
    const glow = glowOf(signals.time);
    const lit = canGlow(glow);
    const seconds = signals.time.seconds;
    for (const it of state.items) {
      it.want = f > it.at ? 1 : 0;
      if (it.shown !== it.want) {
        it.shown = it.want > it.shown ? Math.min(1, it.shown + dt / RISE) : Math.max(0, it.shown - dt / RISE);
        place(it, state.m);
      }
      if (it.shown <= 0 || !it.handle) continue;
      // Lit from dusk, with a twinkle redrawn on twos: each string breathes at its own pace.
      let a = 0;
      if (lit) {
        const tick = Math.floor(seconds * MOTION.poseFps * 0.5 + it.phase * 7);
        const twinkle = 0.82 + 0.18 * rand(0, 'twinkle', it.id, tick);
        a = litParam(it.bright * twinkle * Math.min(1, it.shown * 1.5), glow);
      }
      if (a !== it.param) {
        it.param = a;
        it.handle.setParams(a);
      }
    }
  },
});

/** Sets an item's matrix (or hides it) for how far up it is. */
function place(it: Item, m: Mat4): void {
  const h = it.handle;
  if (!h) return;
  const s = it.shown > it.want || it.want === 0 ? 1 - easeIn(clamp01(1 - it.shown)) : pop(clamp01(it.shown));
  if (s === it.scale) return;
  it.scale = s;
  if (it.shown <= 0) {
    h.setVisible(false);
    return;
  }
  h.setVisible(true);
  if (it.shown >= 1) {
    h.setMatrix(h.base);
    return;
  }
  const k = Math.max(0.001, s);
  const local: Mat4Like =
    it.how === 'line' ? scaling(k, 1, 1) : it.how === 'eave' ? compose(translation(0, EAVE_Y, 0), scaling(k), translation(0, -EAVE_Y, 0)) : scaling(k);
  const out = multiply(h.base, local);
  for (let i = 0; i < 16; i++) m[i] = out[i]!;
  h.setMatrix(m);
}
