// The removal puff (F04) for the rare boat with no water left to float in,
// and for goods whose quay is taken from under them: the same burst of
// white puffs an erased piece goes in (src/life/feedback/feedback.system.ts,
// `burst`), played where the thing was. The thing itself is simply taken
// away under the puffs: it never shrinks or fades.

import { rand } from '@/core/rand';
import { FEEDBACK } from '@/style/animation';
import type { LifeStage, SpawnSpec } from '../api';
import { fxOf } from '../fx/fx';
import { easeIn, easeOut, lerp } from '../motion/ease';
import { place } from '../motion/pose';

const POPS: SpawnSpec[] = [0, 1, 2, 3].map((look) => ({ actor: 'puff', variant: 'pop', params: { look } }));
const TAU = Math.PI * 2;

/** A burst of white puffs at (x, y, z), `size` across; `k` varies it. */
export function removalPuff(stage: LifeStage, seed: number, x: number, y: number, z: number, size: number, k: number): void {
  const fx = fxOf(stage);
  const count = Math.max(5, Math.round(4 + size * 3));
  for (let i = 0; i < count; i++) {
    const r = (what: string): number => rand(seed, 'ship-puff', k, i, what);
    const a = ((i + r('a')) / count) * TAU;
    const up = 0.15 + 0.5 * r('u');
    const far = size * (0.35 + 0.3 * r('r'));
    const big = size * (0.2 + 0.14 * r('s'));
    const cos = Math.cos(a), sin = Math.sin(a);
    fx.play(POPS[i % POPS.length]!, FEEDBACK.removeTime * (1.2 + 0.8 * r('t')), (t, m) => {
      const d = far * easeOut(t);
      const s = big * (t < 0.25 ? lerp(0.4, 1, easeOut(t / 0.25)) : 1 - easeIn((t - 0.25) / 0.75));
      place(x + cos * d, y + up * size * easeOut(t), z + sin * d, a, s, s, s, m);
    }, { smooth: true });
  }
}
