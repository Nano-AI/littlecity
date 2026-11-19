// STAND-INS for three Stage 3 rules, so the house scenarios show finished
// houses today. The Houses owner ships the sockets and the parts (awning,
// hanging sign, flower box, windmill sails); the rules that hang props and
// actors on them belong to Dressing (D07, D09) and Animation (L03). Until
// those exist, a scenario lists `houseDressing` in its `rules` and gets the
// same result. Each rule here is written to the catalogue, so its real
// counterpart can start as a copy.

import { hash } from '@/core/rand';
import type { ShopType } from '@/core/vocab';
import { defineRule, slot, type Rule } from '@/resolve/engine/api';
import { facades } from '@/resolve/facts/facades.fact';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';
import { structureInfo } from '@/resolve/facts/structure.fact';
import { WINDMILL } from '@/style/houses';

/** D07: an awning over every shopfront and a hanging sign at the shop door. */
const shopDressing = defineRule<{ socket: string; kind: 'awning' | 'sign' }>({
  id: 'X-D07.shop-dressing',
  part: 'decoration',
  tier: 1,
  priority: 930,
  about: 'Stand-in for D07. Reads: awning-mount and sign-bracket sockets. Claims: each socket.',
  find: ({ facts }) => [
    ...socketsOfType(facts, 'awning-mount').map((s) => ({ anchor: s.cell, structure: s.structure, key: `a${s.dir}`, data: { socket: s.id, kind: 'awning' as const } })),
    ...socketsOfType(facts, 'sign-bracket').map((s) => ({ anchor: s.cell, structure: s.structure, key: `s${s.dir}`, data: { socket: s.id, kind: 'sign' as const } })),
  ],
  claims: (c) => [slot.socket(c.data.socket)],
  apply(c, out, ctx) {
    const s = c.structure === undefined ? undefined : ctx.plan.structures.get(c.structure);
    const seed = s?.seed ?? 1;
    if (c.data.kind === 'awning') {
      // One colour per shop, from its seed.
      out.prop({ type: 'awning', variant: hash(seed, 'awning-kind') % 4 === 0 ? 'plain' : 'striped', at: { socket: c.data.socket }, params: { color: hash(seed, 'awning') % 5 } });
    } else {
      const tag = [...(ctx.plan.tags.get(c.structure ?? -1) ?? [])].find((t) => t.startsWith('shop:'));
      out.prop({ type: 'hanging-sign', at: { socket: c.data.socket }, params: { shop: (tag?.slice(5) ?? 'bakery') as ShopType } });
    }
  },
});

/** D09: flower boxes under windows: p = 0.5 on sunny sides, 0.2 otherwise, never on storey 4+. */
const flowerBoxes = defineRule<{ socket: string; sunny: boolean }>({
  id: 'X-D09.flower-boxes',
  part: 'decoration',
  tier: 1,
  priority: 910,
  about: 'Stand-in for D09. Reads: window sockets, facades (sunny, storey). Claims: the window socket.',
  find({ facts }) {
    const all = facades(facts);
    const out = [];
    for (const s of socketsOfType(facts, 'window')) {
      if (s.dir === undefined || s.owner === undefined) continue;
      const fc = all.at(s.cell, s.dir);
      if (!fc || fc.kind !== 'house' || fc.storey >= 4) continue;
      // Not under shopfronts, bays, round or rose windows: only plain sills carry a box.
      const feature = facts.shape.features.find((f) => f.id === s.owner);
      if (!feature || !['square', 'tall', 'arched', 'shuttered'].includes(feature.variant ?? '')) continue;
      out.push({ anchor: s.cell, structure: s.structure, key: s.dir, data: { socket: s.id, sunny: fc.sunny } });
    }
    return out;
  },
  claims: (c) => [slot.socket(c.data.socket)],
  apply(c, out, ctx) {
    if (ctx.rand('box') >= (c.data.sunny ? 0.5 : 0.2)) return;
    out.prop({ type: 'flower-box', at: { socket: c.data.socket }, params: { flowers: Math.floor(ctx.rand('flowers') * 5) } });
  },
});

/** L03: four sails on every mill hub (the Animation owner's behaviour turns them). */
const sails = defineRule<{ socket: string }>({
  id: 'X-L03.sails',
  part: 'life',
  tier: 1,
  priority: 970,
  about: 'Stand-in for L03. Reads: mill-hub sockets. Emits: one windmill-sails actor per hub.',
  find: ({ facts }) => socketsOfType(facts, 'mill-hub').map((s) => ({ anchor: s.cell, structure: s.structure, data: { socket: s.id } })),
  apply(c, out, ctx) {
    const storeys = c.structure === undefined ? 1 : (structureInfo(ctx.facts).get(c.structure)?.storeys ?? 1);
    const size = Math.min(WINDMILL.sailMax, WINDMILL.sail + (storeys - 1) * WINDMILL.sailPerCell);
    out.actor({ type: 'windmill-sails', at: { socket: c.data.socket }, home: c.structure, params: { size: Math.round(size * 100) / 100 } });
  },
});

export const houseDressing: readonly Rule[] = [shopDressing, flowerBoxes, sails];
