// L02: every chimney puffs. A plume is a handful of puffs that rise, swell,
// lean over with the wind where the chimney stands, and thin away; more of
// them at dawn and dusk, when the stoves are lit.
//
// Posed on twos with a seeded phase (MOTION.md): a puff is a drawing, and a
// street of chimneys redraws on different frames.

import { positionOf, type Mat4 } from '@/core/mat4';
import { WINDY } from '@/style/animation';
import { defineBehaviour, type InstanceHandle, type SpawnSpec } from '../api';
import { easeIn, easeOut, pop } from '../motion/ease';
import { place } from '../motion/pose';
import { Twos } from '../motion/twos';

const LOOKS: SpawnSpec[] = [0, 1, 2, 3].map((look) => ({ actor: 'puff', variant: 'smoke', params: { look } }));
/** Which puffs of the plume smoke all day (the rest join at dawn and dusk): `day` of `max`, evenly spread. */
export const dayPuff = (i: number, max: number, day: number): boolean => Math.floor(((i + 1) * day) / max) > Math.floor((i * day) / max);

interface Puff {
  handle: InstanceHandle;
  /** 0..1 through its life. */
  age: number;
  on: boolean;
  shown: boolean;
  /** Its own little differences. */
  turn: number;
  drift: number;
  size: number;
}
interface State {
  puffs: Puff[];
  twos: Twos;
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
        turn: ctx.rand('turn', i) * Math.PI * 2,
        drift: ctx.rand('drift', i) - 0.5,
        size: 0.85 + 0.3 * ctx.rand('size', i),
      });
    }
    const [x, y, z] = positionOf(ctx.instance.base);
    return { puffs, twos: new Twos(ctx.rand('twos')), x, y, z };
  },
  update(state, dt, signals, ctx) {
    const step = state.twos.tick(dt);
    if (step === 0) return;
    if (ctx.instance.base[12] !== state.x || ctx.instance.base[13] !== state.y || ctx.instance.base[14] !== state.z) [state.x, state.y, state.z] = positionOf(ctx.instance.base);
    const busy = signals.time.isDusk || signals.time.isDawn;
    const wind = signals.wind(state.x, state.z);
    const lean = WINDY.smokeLean * wind.strength;
    const max = state.puffs.length;
    const day = Math.round(WINDY.smokePuffs);
    for (let i = 0; i < max; i++) {
      const p = state.puffs[i]!;
      p.age += step / WINDY.smokeLife;
      if (p.age >= 1) {
        p.age %= 1;
        // A puff joins or leaves the plume only as it leaves the pot, never in mid-air.
        p.on = i < Math.round(WINDY.smokePuffsBusy) && (busy || dayPuff(i, max, day));
      }
      if (p.on !== p.shown) {
        p.shown = p.on;
        p.handle.setVisible(p.on);
      }
      if (!p.on) continue;
      const a = p.age;
      // Out of the pot with a pop, swelling as it climbs, thinning away at the end.
      const swell = a < 0.12 ? 0.55 * pop(a / 0.12) : 0.55 + 0.45 * easeOut((a - 0.12) / 0.6);
      const fade = a > 0.68 ? 1 - easeIn((a - 0.68) / 0.32) : 1;
      const s = Math.max(0.001, WINDY.smokeSize * p.size * (1 + (WINDY.smokeGrow - 1) * swell) * fade);
      // It leans further the higher it gets: the plume curves over downwind.
      const over = lean * a * (0.35 + 0.65 * a);
      const wag = Math.sin(a * 7 + p.turn) * 0.03 * (0.4 + a) + p.drift * 0.08 * a;
      place(
        state.x + wind.dirX * over - wind.dirZ * wag,
        state.y + s * 0.3 + WINDY.smokeRise * easeOut(a * 0.9) * (1 - 0.25 * Math.min(1, wind.strength)),
        state.z + wind.dirZ * over + wind.dirX * wag,
        p.turn + a * 1.5,
        s, s, s, scratch,
      );
      p.handle.setMatrix(scratch);
    }
  },
  dispose(state) {
    for (let i = 1; i < state.puffs.length; i++) state.puffs[i]!.handle.release();
  },
});
