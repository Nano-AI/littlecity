// L25 · tier 1 · Dusk. Residents walk home at dusk; their windows light when
// they arrive (L07). At night at most 10% are out: a stargazer at the
// viewpoint, a night fisher.
//
// Going home is the crowd's doing (src/life/people): it reads the time
// signal. This rule marks where the few night owls go: `haunt-night` sockets
// on the best viewpoint (the stargazer looks up from there) and on up to two
// fishing spots. A town with neither keeps everybody in at night.
//
// Who is at home is published by the crowd for L07's window lights:
// `homeCensus(signals)` in src/life/people/home.ts, and the `residentHome`
// signal event.

import { hash } from '@/core/rand';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { findHaunts, type HauntData } from './L22.day-plans.rule';

const NIGHT_FISHERS = 2;

export default defineRule<HauntData>({
  id: 'L25.dusk',
  part: 'life',
  tier: 1,
  priority: 750,
  about: 'Reads: the haunts of L22 (viewpoints, fishing spots). Emits: haunt-night sockets where the night owls go.',
  find(ctx) {
    const all = findHaunts(ctx);
    const view = all.find((h) => h.data.type === 'haunt-viewpoint');
    const piers = all
      .filter((h) => h.data.type === 'haunt-pier')
      .sort((a, b) => hash(ctx.seed, 'night', a.anchor) - hash(ctx.seed, 'night', b.anchor))
      .slice(0, NIGHT_FISHERS);
    const out: Candidate<HauntData>[] = [];
    if (view) out.push({ ...view, key: 'stars' });
    for (const p of piers) out.push({ ...p, key: 'fisher' });
    return out;
  },
  apply(c, out) {
    out.socket({ type: 'haunt-night', cell: c.anchor, ...(c.data.dir !== undefined ? { dir: c.data.dir } : {}), name: c.key === 'stars' ? 'stars' : 'fisher' });
  },
});
