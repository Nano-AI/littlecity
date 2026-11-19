// J14: a stack of pillar cells is one column. Left to right: one cell, three
// cells, a column carrying a marble block (flared capital), a pair carrying
// a lintel, and a column standing in the sea on its footing.

import { scenario } from '@/scenario';

export default scenario({
  name: 'J14.pillar',
  seed: 31,
  about: 'Pillars: one shaft per stack, a flared capital under a block, a stone footing in the sea, a perch on a free top.',
  terrain(t) {
    t.flat(1);
    t.water(4, 14, 43, 43);
  },
  build(b) {
    b.plaza(9, 10, 19, 12);
    b.stack('pillar', 10, 11, { floors: 1 });
    b.stack('pillar', 12, 11, { floors: 3 });
    b.stack('pillar', 14, 11, { floors: 2 }).block('marble', 14, 3, 11);
    b.stack('pillar', 16, 11, { floors: 2 }).stack('pillar', 18, 11, { floors: 2 });
    for (let x = 16; x <= 18; x++) b.block('marble', x, 3, 11);
    b.block('pillar', 13, 0, 15).block('pillar', 13, 1, 15).block('pillar', 13, 2, 15);
    b.block('pillar', 16, 0, 15).block('pillar', 16, 1, 15).block('marble', 16, 2, 15);
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 32, zoom: 4.2, target: [14, 2, 12.5] },
    { name: 'back', yaw: 215, pitch: 36, zoom: 4.2, target: [14, 2, 12.5] },
    { name: 'far', yaw: 45, pitch: 35, zoom: 2.4, target: [14, 1, 12.5] },
  ],
  expect(plan, _dressing, check) {
    check.sameStructure([12, 1, 11], [12, 3, 11]);
    check.equal(check.structure(12, 1, 11).cells.length, 3, 'three cells, one shaft');
    check.hasTag(14, 1, 11, 'capital:flared');
    check.hasTag(13, 0, 15, 'footing:water');
    check.ok(!plan.tags.get(check.structure(12, 1, 11).id)?.has('capital:flared'), 'a free column keeps its plain capital');
    check.hasSocket({ type: 'perch', at: [12, 3, 11] });
    check.equal(check.sockets({ type: 'perch', at: [14, 2, 11] }).length, 0, 'no perch under a block');
  },
});
