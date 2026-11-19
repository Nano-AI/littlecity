// D07 · tier 1 · Shop dressing.
//
// Every shop and inn (R-H06, R-H07) declares where its awning and its sign
// go: an 'awning-mount' socket over each shopfront and a 'sign-bracket'
// beside the door. This rule hangs them: one awning colour per shop (from
// the shop's own seed, so a shop keeps its colours whatever is built round
// it), striped three times out of four, and a sign with the trade's mark.
//
// Reads: awning-mount and sign-bracket sockets, shop tags.
// Claims: each socket.

import { hash } from '@/core/rand';
import type { ShopType } from '@/core/vocab';
import { defineRule, slot } from '@/resolve/engine/api';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';

export default defineRule<{ socket: string; kind: 'awning' | 'sign' }>({
  id: 'D07.shop-dressing',
  part: 'decoration',
  tier: 1,
  priority: 930,
  about: 'Reads: awning-mount and sign-bracket sockets, shop:* tags. Claims: each socket.',
  find: ({ facts }) => [
    ...socketsOfType(facts, 'awning-mount').map((s) => ({ anchor: s.cell, structure: s.structure, key: s.id, data: { socket: s.id, kind: 'awning' as const } })),
    ...socketsOfType(facts, 'sign-bracket').map((s) => ({ anchor: s.cell, structure: s.structure, key: s.id, data: { socket: s.id, kind: 'sign' as const } })),
  ],
  claims: (c) => [slot.socket(c.data.socket)],
  apply(c, out, ctx) {
    const s = c.structure === undefined ? undefined : ctx.plan.structures.get(c.structure);
    const seed = s?.seed ?? 1;
    if (c.data.kind === 'awning') {
      out.prop({ type: 'awning', variant: hash(seed, 'awning-kind') % 4 === 0 ? 'plain' : 'striped', at: { socket: c.data.socket }, params: { color: hash(seed, 'awning') % 5 } });
    } else {
      const tag = [...(ctx.plan.tags.get(c.structure ?? -1) ?? [])].find((t) => t.startsWith('shop:'));
      out.prop({ type: 'hanging-sign', at: { socket: c.data.socket }, params: { shop: (tag?.slice(5) ?? 'bakery') as ShopType } });
    }
  },
});
