// L31 · tier 3 · Clouds, and L30 · tier 3 · the far balloon (town-wide).
// Three clouds drift over the paper with the wind, dragging soft shadows
// across the island (src/life/sky/cloud.behaviour.ts); now and then a
// hot-air balloon drifts across far behind the island
// (src/life/sky/balloon.behaviour.ts). Every town has its sky, even an
// empty one: they are free-roaming actors named by their index.

import { key } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule } from '@/resolve/engine/api';

export const CLOUDS = 3;

export default defineRule<{ kind: 'cloud' | 'balloon'; index: number }>({
  id: 'L31.sky',
  part: 'life',
  tier: 3,
  priority: 690,
  townWide: true,
  about: 'Reads: nothing. Emits: three clouds and one far balloon, free-roaming.',
  find() {
    type Sky = { anchor: number; key: string; data: { kind: 'cloud' | 'balloon'; index: number } };
    const out: Sky[] = Array.from({ length: CLOUDS }, (_, index) => ({ anchor: key(0, 0, 0), key: `c${index}`, data: { kind: 'cloud', index } }));
    out.push({ anchor: key(0, 0, 0), key: 'balloon', data: { kind: 'balloon', index: 0 } });
    return out;
  },
  apply(c, out, ctx) {
    const look = hash(ctx.seed, 'L31', c.data.kind, c.data.index) % 8;
    if (c.data.kind === 'cloud') out.actor({ type: 'cloud', at: null, params: { index: c.data.index, look } });
    else out.actor({ type: 'balloon', at: null, params: { look } });
  },
});
