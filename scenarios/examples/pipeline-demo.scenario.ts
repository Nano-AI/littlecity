// A scenario with rules of its own: the whole pipeline in one file, and the
// pattern for a gallery entry that shows parts whatever the real rules
// decide. Two houses face each other across a 2-cell gap; the scenario's
// rules give each a door, windows and a chimney (features with sockets),
// then hang a laundry line between facing windows, stand a lamp by each door
// (props) and put smoke on each chimney (actors).
//
// Until real parts exist these draw as placeholder markers; they pick up the
// real parts by themselves as those are added.

import { E, key, neighbor, S, W } from '@/core/grid';
import { defineRule, slot } from '@/resolve/engine/api';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';
import { scenario } from '@/scenario';

const joinery = defineRule<{ top: number }>({
  id: 'X-J01.demo-joinery',
  part: 'joinery',
  tier: 1,
  // Before the real joinery rules, so these features keep the plain ids the expect() below names.
  priority: 100000,
  // One candidate per house: a door on its lowest cell, windows and a chimney on its top cell.
  find: ({ facts }) =>
    [...facts.structures.values()]
      .filter((s) => s.kind === 'house')
      .map((s) => ({ anchor: s.cells[0]!, structure: s.id, data: { top: s.cells[s.cells.length - 1]! } })),
  apply(c, out) {
    const structure = c.structure!;
    const door = out.feature({ type: 'door', structure, cell: c.anchor, dir: S, variant: 'plain', params: { main: 1 } });
    out.socket({ type: 'door', owner: door, structure, cell: c.anchor, dir: S });
    const top = c.data.top;
    for (const dir of [E, W] as const) {
      const window = out.feature({ type: 'window', structure, cell: top, dir, variant: 'square' });
      out.socket({ type: 'window', owner: window, structure, cell: top, dir });
    }
    const chimney = out.feature({ type: 'chimney', structure, cell: top, variant: 'plain' });
    out.socket({ type: 'chimney-top', owner: chimney, structure, cell: top });
  },
});

const laundry = defineRule<{ from: string; to: string }>({
  id: 'X-D01.demo-laundry',
  part: 'decoration',
  tier: 1,
  priority: -1000,
  find({ facts }) {
    // East-facing windows with a west-facing window three cells to the east.
    // Only this scenario's own windows: the real rules (J09) give the houses windows too.
    const windows = socketsOfType(facts, 'window').filter((s) => s.rule === 'X-J01.demo-joinery');
    const west = new Map(windows.filter((s) => s.dir === W).map((s) => [s.cell, s.id]));
    return windows
      .filter((s) => s.dir === E)
      .map((s) => ({ s, to: west.get(neighbor(neighbor(neighbor(s.cell, E), E), E)) }))
      .filter(({ to }) => to !== undefined)
      .map(({ s, to }) => ({ anchor: s.cell, data: { from: s.id, to: to! } }));
  },
  claims: (c) => [slot.line(c.data.from, c.data.to)],
  apply(c, out, { rand }) {
    out.prop({ type: 'laundry-line', at: { from: c.data.from, to: c.data.to }, params: { garments: 3 + Math.floor(rand('n') * 4) } });
  },
});

const lamps = defineRule({
  id: 'X-D02.demo-lamps',
  part: 'decoration',
  tier: 1,
  priority: -1001,
  find: ({ facts }) =>
    socketsOfType(facts, 'door')
      .filter((s) => s.rule === 'X-J01.demo-joinery')
      .map((s) => ({ anchor: neighbor(s.cell, s.dir!) })),
  claims: (c) => [slot.floor(c.anchor, 'e')],
  apply(c, out) {
    const lamp = out.prop({ type: 'lamp', variant: 'post', at: { cell: c.anchor, pos: 'e' } });
    out.socket({ type: 'lamp-head', owner: lamp, cell: c.anchor });
  },
});

const smoke = defineRule<string>({
  id: 'X-L01.demo-smoke',
  part: 'life',
  tier: 1,
  priority: -1000,
  find: ({ facts }) =>
    socketsOfType(facts, 'chimney-top')
      .filter((s) => s.rule === 'X-J01.demo-joinery')
      .map((s) => ({ anchor: s.cell, structure: s.structure, data: s.id })),
  apply(c, out) {
    out.actor({ type: 'smoke', at: { socket: c.data }, home: c.structure });
  },
});

export default scenario({
  name: 'pipeline-demo',
  seed: 5,
  about: 'Scenario-local rules: features, sockets, props on a line and at slots, and actors, end to end.',
  rules: [joinery, laundry, lamps, smoke],
  build(b) {
    b.house(10, 10, { floors: 2, color: 2 });
    b.house(13, 10, { floors: 2, color: 4 });
    b.path(9, 11, 14, 11);
  },
  cameras: [
    { name: 'south', yaw: 20, pitch: 28, zoom: 7, target: [12, 2, 10.5] },
    { name: 'east', yaw: 110, pitch: 35, zoom: 6, target: [12, 2, 10.5] },
  ],
  expect(plan, dressing, check) {
    check.hasFeature({ type: 'door', rule: 'X-J01.demo-joinery' }, 2);
    check.hasFeature({ type: 'window', at: [10, 2, 10], dir: E });
    check.hasSocket({ type: 'chimney-top' }, 2);
    const line = check.hasProp({ type: 'laundry-line', rule: 'X-D01.demo-laundry' })[0]!;
    check.ok('from' in line.at && line.at.from === `window@${key(10, 2, 10)}:1/window`, 'the line starts at the east window of the west house');
    check.hasProp({ type: 'lamp', at: [10, 1, 11] });
    check.hasActor({ type: 'smoke', rule: 'X-L01.demo-smoke' }, 2);
    check.ok(dressing.claims.has('floor:' + key(10, 1, 11) + ':e'), 'the lamp claimed its slot');
    check.ok(plan.features.length >= 8, 'two doors, four windows, two chimneys');
  },
});
