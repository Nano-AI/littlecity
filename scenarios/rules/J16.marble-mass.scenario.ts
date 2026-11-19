// J16 and R-M07: marble merges into one seamless mass with bevelled top
// edges and a base course; walkable tops are paved inside a coping. A block
// level with a terrace of ground is flush with it.

import { scenario } from '@/scenario';

export default scenario({
  name: 'J16.marble-mass',
  seed: 32,
  about: 'Marble: a single block, an L-shaped stepped mass, a mass flush with higher ground, two colours side by side.',
  terrain(t) {
    t.flat(1);
    t.rect(20, 6, 26, 10, 2);
  },
  build(b) {
    b.put('marble', 9, 12);
    // A stepped L: 3 × 2 on the ground, a second storey on the corner, a third on one cell.
    b.fill('marble', 12, 11, 14, 12).block('marble', 12, 1, 13).block('marble', 12, 1, 14);
    b.block('marble', 12, 2, 11).block('marble', 13, 2, 11).block('marble', 12, 2, 12).block('marble', 12, 3, 11);
    // Flush with the raised ground behind it.
    b.fill('marble', 21, 11, 24, 12);
    // Two colours never merge.
    b.fill('marble', 17, 13, 18, 14, { color: 0 }).fill('marble', 19, 13, 19, 14, { color: 4 });
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 32, zoom: 3.8, target: [16.5, 1.5, 12] },
    { name: 'back', yaw: 215, pitch: 36, zoom: 3.8, target: [16.5, 1.5, 12] },
    { name: 'far', yaw: 135, pitch: 35, zoom: 2.4, target: [16.5, 1, 12] },
  ],
  expect(plan, _dressing, check) {
    check.sameStructure([12, 1, 11], [12, 3, 11]);
    check.sameStructure([12, 1, 14], [14, 1, 12]);
    check.differentStructures([18, 1, 13], [19, 1, 13]);
    check.role(9, 1, 12, 'terrace');
    check.hasTag(9, 1, 12, 'top:paved');
    check.hasTag(21, 1, 11, 'top:flush');
    check.ok(!plan.tags.get(check.structure(9, 1, 12).id)?.has('top:flush'), 'a block on open ground is not flush with anything');
  },
});
