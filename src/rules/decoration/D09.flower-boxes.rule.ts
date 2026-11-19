// D09 · tier 1 · Flower boxes.
//
// Under an ordinary house window: half of those on sunny sides
// (DRESSING.boxSunny), a fifth of the rest (boxShade); never above the third
// storey, never under a shopfront, a bay, a round window or a tower slit.
// The flowers of one house are one family: the colour comes from the
// house's seed, with the odd box of another.
//
// Stability: each window rolls for itself, seeded by its own cell and socket,
// so no edit elsewhere takes a box away or adds one.
//
// Reads: window sockets and their features, facades (sunny, storey).
// Claims: the window socket.

import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { facades } from '@/resolve/facts/facades.fact';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';
import { DRESSING } from '@/style/dressing';
import { PLAIN_WINDOWS } from './D05.laundry-line.rule';
import { lucky } from './lib';

const RULE = 'D09.flower-boxes';

export default defineRule<{ socket: string }>({
  id: RULE,
  part: 'decoration',
  tier: 1,
  priority: 910,
  about: 'Reads: window sockets, facades (sunny, storey). Claims: the window socket.',
  find({ facts, seed }) {
    const all = facades(facts);
    const features = new Map(facts.shape.features.map((f) => [f.id, f]));
    const out: Candidate<{ socket: string }>[] = [];
    for (const s of socketsOfType(facts, 'window')) {
      if (s.dir === undefined || s.owner === undefined) continue;
      const fc = all.at(s.cell, s.dir);
      if (!fc || fc.kind !== 'house' || fc.storey > DRESSING.boxTopStorey) continue;
      if (!PLAIN_WINDOWS.has(features.get(s.owner)?.variant ?? '')) continue;
      if (!lucky(seed, RULE, s.cell, s.id, fc.sunny ? DRESSING.boxSunny : DRESSING.boxShade)) continue;
      out.push({ anchor: s.cell, structure: s.structure, key: s.id, data: { socket: s.id } });
    }
    return out;
  },
  claims: (c) => [slot.socket(c.data.socket)],
  apply(c, out, ctx) {
    const s = c.structure === undefined ? undefined : ctx.plan.structures.get(c.structure);
    const family = hash(s?.seed ?? 1, 'flowers') % 5;
    out.prop({ type: 'flower-box', at: { socket: c.data.socket }, params: { flowers: ctx.rand('odd') < 0.25 ? (family + 1 + Math.floor(ctx.rand('which') * 4)) % 5 : family } });
  },
});
