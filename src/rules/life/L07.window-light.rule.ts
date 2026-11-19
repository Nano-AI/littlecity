// L07 · Windows through the night: one 'window-light' actor per building
// with windows (houses and windmills), carrying everything its evening and
// night depend on, all seeded per house:
//
//   order     when in the 20-second dusk ramp it lights
//   shop      a shop lights first and goes dark when it shuts (night)
//   inn       an inn stays lit all night
//   baker     the bakery (the same shops L23 gives a baker) lights before dawn
//   owl       about one house in six stays up: lit through the night, now and
//             then going out for a while
//   bedtime   when the others go to bed: through the first half of the night
//   early     when an early riser lights up at dawn (above 1: sleeps in)
//   storeys   how tall it is: a house going to bed puts out downstairs first
//
// src/life/dusk/window-light.behaviour.ts does the lighting; who is home
// comes from src/life/dusk/occupancy.ts.

import { keyY } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule } from '@/resolve/engine/api';
import { featuresOfType } from '@/resolve/facts/plan-index.fact';
import type { StructureId } from '@/resolve/plan';
import { DUSKY } from '@/style/animation';

export default defineRule<{ windows: number; owl: boolean }>({
  id: 'L07.window-light',
  part: 'life',
  tier: 1,
  priority: 930,
  about: 'Reads: window features, roles. Emits: one window-light actor per house or windmill with windows, at its lowest cell, with its evening and its night.',
  find({ facts, plan, seed }) {
    const count = new Map<StructureId, number>();
    for (const w of featuresOfType(facts, 'window')) count.set(w.structure, (count.get(w.structure) ?? 0) + 1);
    const out = [];
    for (const [id, windows] of count) {
      const s = facts.structures.get(id);
      if (!s || s.cells.length === 0 || (s.kind !== 'house' && s.kind !== 'windmill')) continue;
      out.push({ anchor: s.cells[0]!, structure: id, data: { windows, owl: false } });
    }
    // The owls: about one home in six, chosen by seed (a fixed share, not a chance each, so a small town
    // is not left all dark or all lit).
    const homes = out.filter((c) => !['shop', 'inn'].includes(plan.roles.get(c.structure)?.role ?? ''));
    homes.sort((a, b) => hash(seed, 'owl', a.structure) - hash(seed, 'owl', b.structure) || a.structure - b.structure);
    const owls = Math.round(homes.length * DUSKY.nightOwls);
    for (let i = 0; i < owls; i++) homes[i]!.data.owl = true;
    return out;
  },
  apply(c, out, ctx) {
    const role = ctx.plan.roles.get(c.structure!)?.role ?? '';
    const shop = role === 'shop';
    const inn = role === 'inn';
    // The same shops L23 gives a baker.
    const baker = shop && hash(ctx.seed, 'baker', c.structure!) % 3 === 0;
    const owl = c.data.owl;
    const s = ctx.plan.structures.get(c.structure!)!;
    let lo = Infinity, hi = -Infinity;
    for (const cell of s.cells) {
      lo = Math.min(lo, keyY(cell));
      hi = Math.max(hi, keyY(cell));
    }
    const r3 = (x: number): number => Math.round(x * 1000) / 1000;
    out.actor({
      type: 'window-light',
      at: { cell: c.anchor, pos: 'c' },
      home: c.structure,
      params: {
        order: r3(ctx.rand('order')),
        shop: shop ? 1 : 0,
        inn: inn ? 1 : 0,
        baker: baker ? 1 : 0,
        owl: owl ? 1 : 0,
        bedtime: r3(DUSKY.bedFrom + (DUSKY.bedTo - DUSKY.bedFrom) * ctx.rand('bed')),
        early: ctx.rand('early') < DUSKY.earlyRisers ? r3(0.1 + 0.5 * ctx.rand('early-at')) : 2,
        storeys: hi - lo + 1,
        windows: c.data.windows,
      },
    });
  },
});
