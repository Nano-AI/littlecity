// L02: every chimney puffs. A plume is three or four soft puffs of mist that
// leave the pot one after another, rise and slow, drift downwind with the
// air where they are (so a gust is seen pushing the smoke of a street over in
// turn), swell and thin away. Thinner by day; at dawn and dusk the stoves are
// lit and the plume is fuller.
//
// The puffs are MIST (src/gen/airborne.ts): no pen line, a wash that fades at
// its rim, and outside the grounding picture, so moving them costs the
// renderer nothing but the puffs themselves.
//
// Posed on twos with a seeded phase (MOTION.md): a puff is a drawing, and a
// street of chimneys redraws on different frames.

import { positionOf, type Mat4 } from '@/core/mat4';
import { WINDY } from '@/style/animation';
import { defineBehaviour, type InstanceHandle, type SpawnSpec } from '../api';
import { clamp01, easeIn, easeOut } from '../motion/ease';
import { place } from '../motion/pose';
import { Twos } from '../motion/twos';

const LOOKS: SpawnSpec[] = [0, 1, 2, 3].map((look) => ({ actor: 'puff', variant: 'mist', params: { look } }));
/** Which puffs of the plume smoke all day (the rest join at dawn and dusk): `day` of `max`, evenly spread. */
export const dayPuff = (i: number, max: number, day: number): boolean => Math.floor(((i + 1) * day) / max) > Math.floor((i * day) / max);

/** Opacity through a puff's life (0..1 of it): in softly as it leaves the pot, out slowly as it spreads. */
export const puffOpacity = (a: number): number => easeOut(clamp01(a / 0.08)) * (1 - easeIn(clamp01((a - 0.3) / 0.7)));

interface Puff {
  handle: InstanceHandle;
  /** 0..1 through its life. */
  age: number;
  on: boolean;
  shown: boolean;
  /** How far it has drifted from the pot, in columns. */
  ox: number;
  oz: number;
  /** Its own little differences. */
  turn: number;
  curl: number;
  size: number;
  seed: number;
}
interface State {
  puffs: Puff[];
  twos: Twos;
  /** Opacity of the plume now: eases between the day's and the busy hours'. */
  thick: number;
  x: number;
  y: number;
  z: number;
}
const scratch: Mat4 = new Array<number>(16).fill(0);

export default defineBehaviour({
  actor: 'smoke',
  create(_item, ctx): State {
    const max = Math.max(1, Math.round(Math.max(WINDY.smokePuffs, WINDY.smokePuffsBusy)));
    const start = ctx.rand('start');
    const puffs: Puff[] = [];
    for (let i = 0; i < max; i++) {
      const handle = i === 0 ? ctx.instance : ctx.stage.spawn(LOOKS[Math.floor(ctx.rand('look', i) * LOOKS.length)]!, ctx.instance.base);
      handle.setVisible(false);
      puffs.push({
        handle,
        age: (start + i / max) % 1,
        on: dayPuff(i, max, Math.round(WINDY.smokePuffs)),
        shown: false,
        ox: 0,
        oz: 0,
        turn: ctx.rand('turn', i) * Math.PI * 2,
        curl: ctx.rand('curl', i) - 0.5,
        size: 0.85 + 0.3 * ctx.rand('size', i),
        seed: ctx.rand('grain', i),
      });
    }
    const [x, y, z] = positionOf(ctx.instance.base);
    return { puffs, twos: new Twos(ctx.rand('twos')), thick: WINDY.smokeOpacity, x, y, z };
  },
  update(state, dt, signals, ctx) {
    const step = state.twos.tick(dt);
    if (step === 0) return;
    if (ctx.instance.base[12] !== state.x || ctx.instance.base[13] !== state.y || ctx.instance.base[14] !== state.z) [state.x, state.y, state.z] = positionOf(ctx.instance.base);
    const busy = signals.time.isDusk || signals.time.isDawn;
    const goal = busy ? WINDY.smokeOpacityBusy : signals.time.isNight ? WINDY.smokeOpacityNight : WINDY.smokeOpacity;
    state.thick += (goal - state.thick) * Math.min(1, step * 0.4);
    const max = state.puffs.length;
    const day = Math.round(WINDY.smokePuffs);
    const life = Math.max(0.5, WINDY.smokeLife);
    for (let i = 0; i < max; i++) {
      const p = state.puffs[i]!;
      p.age += step / life;
      if (p.age >= 1) {
        p.age %= 1;
        p.ox = p.oz = 0;
        // A puff joins or leaves the plume only as it leaves the pot, never in mid-air.
        p.on = i < Math.round(WINDY.smokePuffsBusy) && (busy || dayPuff(i, max, day));
      }
      if (p.on !== p.shown) {
        p.shown = p.on;
        p.handle.setVisible(p.on);
      }
      if (!p.on) continue;
      const a = p.age;
      // Carried by the air where the puff is now: a gust front reaches the puff, then the next chimney.
      const wind = signals.wind(state.x + p.ox, state.z + p.oz);
      // It catches the wind as it clears the pot, and wanders a little across it.
      const carry = WINDY.smokeLean * wind.strength * step * (0.35 + 0.65 * easeOut(clamp01(a * 2.5)));
      const wander = Math.sin(a * 5 + p.turn) * 0.05 * step * (1 + p.curl);
      p.ox += wind.dirX * carry - wind.dirZ * wander;
      p.oz += wind.dirZ * carry + wind.dirX * wander;
      const s = WINDY.smokeSize * p.size * (1 + (WINDY.smokeGrow - 1) * easeOut(a));
      // Rising and slowing; a strong wind flattens the plume.
      const rise = WINDY.smokeRise * easeOut(a) * (1 - 0.3 * Math.min(1, wind.strength));
      place(state.x + p.ox, state.y + s * 0.25 + rise, state.z + p.oz, p.turn + a * 0.8, s * 1.1, s * 0.85, s * 1.1, scratch);
      p.handle.setMatrix(scratch);
      p.handle.setParams(state.thick * puffOpacity(a), p.seed);
    }
  },
  dispose(state) {
    for (let i = 1; i < state.puffs.length; i++) state.puffs[i]!.handle.release();
  },
});
