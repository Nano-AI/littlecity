// R-H21 (RC-19): a town of ten or more houses has one school: the
// one-storey house on a street with the biggest fenced yard beside it gets
// a bell cupola, tall windows and a hopscotch court chalked on its yard.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-H21.schoolhouse',
  seed: 4221,
  about: 'A street of twelve houses; the one-storey house with a fenced yard is the school, one only.',
  build(b) {
    b.path(6, 12, 34, 12);
    for (let i = 0; i < 6; i++) b.house(7 + i * 4, 10, { w: 2, d: 2, floors: 2, color: i });
    for (let i = 0; i < 5; i++) b.house(7 + i * 4, 13, { w: 2, floors: 2, color: (i + 3) % 8 });
    // The school: one storey, its yard fenced round beside it.
    b.house(28, 13, { w: 2, color: 2 });
    b.fenceAround(30, 13, 33, 16);
    b.house(24, 15, { color: 5 }); // a small one-storey house with no yard
  },
  cameras: [
    { name: 'school', yaw: 30, pitch: 30, zoom: 4.6, target: [30, 1, 14] },
    { name: 'street', yaw: 40, pitch: 34, zoom: 2.4, target: [20, 1, 12] },
  ],
  expect(plan, _dressing, check) {
    check.role(28, 1, 13, 'schoolhouse');
    check.equal([...plan.roles.values()].filter((r) => r.role === 'schoolhouse').length, 1, 'one school');
    check.hasFeature({ type: 'bell-cupola', on: [28, 1, 13], rule: 'J30.trade-fronts' });
    check.hasFeature({ type: 'window', variant: 'tall', on: [28, 1, 13] });
    check.hasProp({ type: 'structure-prop', variant: 'hopscotch', rule: 'R-H98.structure-props' });
  },
});
