// L03 · Weathervanes "turn likewise": a vane on the tip of a tower or
// lighthouse cap that carries nothing else. A cap with a cross (a steeple)
// keeps its cross; a tip whose flag mount a decoration rule has already
// used keeps its flag: the claim on the mount makes the two exclusive.

import { defineRule, slot } from '@/resolve/engine/api';
import { featuresOfType, socketsOfType } from '@/resolve/facts/plan-index.fact';

/** Share of free tips that get a vane. */
const CHANCE = 0.6;

export default defineRule<{ socket: string; mount: string | null }>({
  id: 'L03.weathervanes',
  part: 'life',
  tier: 1,
  priority: 969,
  chance: CHANCE,
  about: 'Reads: tower-top sockets, finials, flag mounts. Claims: the tip and its flag mount. Emits: a weathervane actor on 6 in 10 free tips.',
  find({ facts }) {
    const crossed = new Set(featuresOfType(facts, 'finial').map((f) => f.cell));
    const out = [];
    for (const s of socketsOfType(facts, 'tower-top')) {
      if (crossed.has(s.cell) || s.owner === undefined) continue;
      const mount = (facts.shape.socketsByOwner.get(s.owner) ?? []).find((o) => o.type === 'flag-mount');
      out.push({ anchor: s.cell, structure: s.structure, data: { socket: s.id, mount: mount?.id ?? null } });
    }
    return out;
  },
  claims: (c) => (c.data.mount ? [slot.socket(c.data.socket), slot.socket(c.data.mount)] : [slot.socket(c.data.socket)]),
  apply(c, out, ctx) {
    out.actor({ type: 'weathervane', variant: ctx.rand('kind') < 0.35 ? 'cock' : 'arrow', at: { socket: c.data.socket }, home: c.structure });
  },
});
