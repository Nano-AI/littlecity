// What dusk switches on (L07, the lamps, L09): a street of houses with
// street lamps, a square with shops, and a lighthouse on the shore. The
// lamps come from a scenario-local rule and the look fixture's lamp part
// (Dressing's D01 places the real ones); the lamp system finds them by type.
//
// Watch an evening:
//   node src/life/testing/sequence.mjs L07.window-light --time 0.6 --run --frames 12 --every 3000 --name evening
// and the beam:
//   node src/life/testing/sequence.mjs L07.window-light --time night --frames 8 --every 600 --name beam

import { key } from '@/core/grid';
import { overrideRegistries } from '@/render/registries';
import { defineRule } from '@/resolve/engine/api';
import { scenario } from '@/scenario';
import { lookParts } from '../look/fixtures';

const SEED = 407;
// Until Dressing's lamp part exists, this town's lamps are drawn by the look fixture's.
overrideRegistries({ name: 'L07-lamps', match: (plan) => plan.world.seed === SEED, parts: lookParts });

const LAMPS: [number, number][] = [];
for (let x = 13; x <= 29; x += 2) LAMPS.push([x, 22]);

const lamps = defineRule({
  id: 'X-L07.lamps',
  part: 'decoration',
  tier: 1,
  priority: 10,
  about: 'Fixture only: a lamp on every second cell of the street.',
  find: () => LAMPS.map(([x, z]) => ({ anchor: key(x, 1, z) })),
  apply(c, out) {
    out.prop({ type: 'lamp', variant: 'post', at: { cell: c.anchor, pos: 'n' } });
  },
});

export default scenario({
  name: 'L07.window-light',
  seed: SEED,
  about: 'Windows lighting house by house at dusk, street lamps coming on along the street, and the lighthouse beam at night.',
  rules: [lamps],
  terrain(t) {
    t.flat(1);
    t.water(4, 28, 43, 43);
  },
  build(b) {
    b.path(12, 22, 30, 22);
    for (let i = 0; i < 6; i++) b.house(13 + i * 3, 20, { floors: 1 + (i % 3 === 1 ? 1 : 0), w: 2, color: i });
    for (let i = 0; i < 5; i++) b.house(14 + i * 3, 24, { floors: 1 + (i % 2), w: 2, color: i + 3 });
    b.plaza(31, 20, 34, 24);
    b.house(35, 20, { floors: 2, w: 2, d: 2, color: 5 });
    b.house(35, 23, { floors: 2, w: 2, d: 2, color: 1 });
    b.stack('lighthouse', 23, 27, { floors: 5 });
    b.put('windmill', 9, 21);
  },
  cameras: [
    { name: 'dusk', yaw: 45, pitch: 32, zoom: 3.1, target: [23, 1, 23], time: 'dusk' },
    { name: 'night', yaw: 45, pitch: 32, zoom: 2.2, target: [24, 1, 26], time: 'night' },
    { name: 'night-back', yaw: 200, pitch: 28, zoom: 2.4, target: [24, 1, 26], time: 'night' },
    { name: 'day', yaw: 45, pitch: 32, zoom: 3.1, target: [23, 1, 23] },
  ],
  expect(plan, _dressing, check) {
    const lights = check.actors({ type: 'window-light', rule: 'L07.window-light' });
    const houses = [...plan.structures.values()].filter((s) => s.kind === 'house');
    check.equal(lights.length, houses.length, 'one light per house (the windows of a mill are not features, and a lighthouse is not a home)');
    const orders = lights.map((a) => Number((a.params as { order?: number }).order));
    check.ok(orders.every((o) => o >= 0 && o < 1), 'every house has its moment in the ramp');
    check.ok(new Set(orders).size === orders.length, 'no two houses light at the same instant');
    const p = (a: (typeof lights)[number]) => a.params as { bedtime?: number; owl?: number; shop?: number; inn?: number; storeys?: number };
    const homes = lights.filter((a) => p(a).shop !== 1 && p(a).inn !== 1);
    check.ok(homes.every((a) => Number(p(a).bedtime) > 0 && Number(p(a).bedtime) <= 0.5), 'they go to bed in the first half of the night');
    check.equal(homes.filter((a) => p(a).owl === 1).length, Math.round(homes.length / 6), 'about one home in six stays up');
    check.ok(lights.some((a) => Number(p(a).storeys) > 1), 'the tall ones put out downstairs first');
    check.noActor({ type: 'window-light', at: [23, 1, 27] });
    check.hasActor({ type: 'lighthouse-beam', rule: 'L09.lighthouse-beam' }, 1);
    check.hasActor({ type: 'beam-glow', rule: 'L09.lighthouse-beam' }, 1);
    check.hasProp({ type: 'lamp' }, LAMPS.length);
  },
});
