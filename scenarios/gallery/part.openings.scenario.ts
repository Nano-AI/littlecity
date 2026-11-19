// GALLERY: the openings, one of each, on a plain wall. Every window and door
// variant, a balcony and a portico on the south face of a marble wall (a
// neutral wall with no house rules of its own; one structure per column, so
// the door looks and trims vary), with the props that hang on
// them: an awning, signs for the eight trades, a flower box. A scenario-local
// rule emits exactly these, whatever the real rules decide.
//
//   npm run shots -- part.openings

import { key, S } from '@/core/grid';
import type { ShopType } from '@/core/vocab';
import { defineRule } from '@/resolve/engine/api';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';
import { scenario } from '@/scenario';

const WINDOWS = ['square', 'tall', 'arched', 'shuttered', 'pointed', 'rose', 'round', 'bay', 'slit', 'shopfront'] as const;
const DOORS = ['plain', 'plain', 'plain', 'plain', 'double', 'shop', 'deck'] as const;
const SHOPS: readonly ShopType[] = ['bakery', 'cafe', 'books', 'flowers', 'fish', 'tailor', 'cheese', 'toys'];
const X0 = 10, Z = 12;

const show = defineRule<{ i: number }>({
  id: 'X-PARTS.openings',
  part: 'joinery',
  tier: 1,
  priority: -500,
  find: () => Array.from({ length: 10 }, (_, i) => ({ anchor: key(X0 + i, 1, Z), data: { i } })),
  apply(c, out, ctx) {
    const structure = ctx.plan.structureAt.get(c.anchor)!;
    const { i } = c.data;
    const up = key(X0 + i, 2, Z);
    const w = out.feature({ type: 'window', structure, cell: up, dir: S, variant: WINDOWS[i]! });
    out.socket({ type: 'window', owner: w, structure, cell: up, dir: S });
    if (WINDOWS[i] === 'shopfront') out.socket({ type: 'awning-mount', owner: w, structure, cell: up, dir: S });
    if (i < DOORS.length) {
      const d = out.feature({ type: 'door', structure, cell: c.anchor, dir: S, variant: DOORS[i]!, params: { main: 1 } });
      out.socket({ type: 'door', owner: d, structure, cell: c.anchor, dir: S });
      out.socket({ type: 'sign-bracket', owner: d, structure, cell: c.anchor, dir: S });
      if (DOORS[i] === 'shop') out.socket({ type: 'awning-mount', owner: d, structure, cell: c.anchor, dir: S });
    } else if (i === 7) {
      out.feature({ type: 'balcony', structure, cell: c.anchor, dir: S, variant: 'iron' });
    } else if (i === 8) {
      out.feature({ type: 'balcony', structure, cell: c.anchor, dir: S, variant: 'timber' });
    } else {
      const d = out.feature({ type: 'door', structure, cell: c.anchor, dir: S, variant: 'plain' });
      out.socket({ type: 'door', owner: d, structure, cell: c.anchor, dir: S });
      out.socket({ type: 'sign-bracket', owner: d, structure, cell: c.anchor, dir: S });
      out.feature({ type: 'portico', structure, cell: c.anchor, dir: S });
    }
  },
});

const dress = defineRule<{ socket: string; type: string; n: number }>({
  id: 'X-PARTS.dressing',
  part: 'decoration',
  tier: 1,
  priority: -500,
  find: ({ facts }) =>
    (['sign-bracket', 'awning-mount', 'window'] as const).flatMap((type) =>
      socketsOfType(facts, type)
        .filter((s) => s.rule === 'X-PARTS.openings')
        .map((s, n) => ({ anchor: s.cell, key: type, data: { socket: s.id, type, n } })),
    ),
  apply(c, out) {
    const { socket, type, n } = c.data;
    if (type === 'sign-bracket') out.prop({ type: 'hanging-sign', at: { socket }, params: { shop: SHOPS[n % SHOPS.length]! } });
    else if (type === 'awning-mount') out.prop({ type: 'awning', at: { socket }, variant: n % 2 ? 'plain' : 'striped', params: { color: n } });
    else if (n < 4) out.prop({ type: 'flower-box', at: { socket }, params: { flowers: n } });
  },
});

export default scenario({
  name: 'part.openings',
  seed: 4104,
  about: 'Every window and door variant, a balcony, a portico, an awning, the eight shop signs and a flower box, on a plain wall.',
  rules: [show, dress],
  build(b) {
    // One block structure per column (alternating colours do not merge), so each has its own personality.
    for (let i = 0; i < 10; i++) b.stack('marble', X0 + i, Z, { floors: 2, color: i % 2 });
    b.path(X0 - 1, Z + 1, X0 + 10, Z + 1);
  },
  cameras: [
    { name: 'wall', yaw: 20, pitch: 22, zoom: 4.6, target: [X0 + 5, 1.6, Z + 0.5] },
    { name: 'left', yaw: 25, pitch: 22, zoom: 8.5, target: [X0 + 2.6, 1.6, Z + 0.6] },
    { name: 'right', yaw: 25, pitch: 22, zoom: 8.5, target: [X0 + 7.6, 1.6, Z + 0.6] },
    { name: 'night', yaw: 20, pitch: 22, zoom: 4.6, target: [X0 + 5, 1.6, Z + 0.5], time: 'night' },
  ],
  expect(_plan, dressing, check) {
    check.equal(check.features({ type: 'window', rule: 'X-PARTS.openings' }).length, WINDOWS.length, 'windows');
    check.equal(check.features({ type: 'door', rule: 'X-PARTS.openings' }).length, DOORS.length + 1, 'doors');
    check.equal(dressing.props.filter((p) => p.type === 'hanging-sign').length, 8, 'signs');
    check.hasProp({ type: 'awning' }, 2);
    check.hasProp({ type: 'flower-box' }, 4);
  },
});
