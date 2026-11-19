// STAND-IN for a Stage 3 rule, so the house scenarios show finished houses
// today. The Houses owner ships the sockets and the parts (awning, hanging
// sign, flower box, windmill sails); the rules that hang props and actors on
// them belong to Dressing (D07, D09) and Animation (L03).
//
// D07 (shop dressing) and D09 (flower boxes) are now real rules in
// src/rules/decoration, discovered like every other rule, so every scenario
// gets them and their stand-ins are gone from here. What is left is the
// stand-in for L03 (the windmill's sails), until the Animation owner's rule
// exists; a scenario lists `houseDressing` in its `rules` to get it.

import { defineRule, type Rule } from '@/resolve/engine/api';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';
import { structureInfo } from '@/resolve/facts/structure.fact';
import { WINDMILL } from '@/style/houses';

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

export const houseDressing: readonly Rule[] = [sails];
