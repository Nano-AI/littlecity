// L07 · Windows at dusk: one 'window-light' actor per building with
// windows (houses and windmills), carrying when it lights within the
// 20-second ramp (seeded), whether it is a shop (shops and inns light
// first) and when it goes to bed (a few stay up all night).
// src/life/dusk/window-light.behaviour.ts does the lighting; who is home
// comes from src/life/dusk/occupancy.ts.

import { defineRule } from '@/resolve/engine/api';
import { featuresOfType } from '@/resolve/facts/plan-index.fact';
import type { StructureId } from '@/resolve/plan';
import { DUSKY } from '@/style/animation';

const SHOPS = new Set(['shop', 'inn']);

export default defineRule<{ windows: number }>({
  id: 'L07.window-light',
  part: 'life',
  tier: 1,
  priority: 930,
  about: 'Reads: window features, roles. Emits: one window-light actor per house or windmill with windows, at its lowest cell.',
  find({ facts }) {
    const count = new Map<StructureId, number>();
    for (const w of featuresOfType(facts, 'window')) count.set(w.structure, (count.get(w.structure) ?? 0) + 1);
    const out = [];
    for (const [id, windows] of count) {
      const s = facts.structures.get(id);
      if (!s || s.cells.length === 0 || (s.kind !== 'house' && s.kind !== 'windmill')) continue;
      out.push({ anchor: s.cells[0]!, structure: id, data: { windows } });
    }
    return out;
  },
  apply(c, out, ctx) {
    const shop = SHOPS.has(ctx.plan.roles.get(c.structure!)?.role ?? '');
    const owl = shop || ctx.rand('owl') < DUSKY.nightOwls;
    out.actor({
      type: 'window-light',
      at: { cell: c.anchor, pos: 'c' },
      home: c.structure,
      params: {
        order: Math.round(ctx.rand('order') * 1000) / 1000,
        shop: shop ? 1 : 0,
        bedtime: owl ? 2 : Math.round((DUSKY.bedFrom + (DUSKY.bedTo - DUSKY.bedFrom) * ctx.rand('bed')) * 1000) / 1000,
        windows: c.data.windows,
      },
    });
  },
});
