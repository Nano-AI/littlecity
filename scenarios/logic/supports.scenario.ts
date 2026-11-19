// Generated supports (design section 9): brackets, a pillar, an arcade of
// long pillars, corner stilts over a tree, a platform under a stranded tree,
// and a stilt into the sea.

import { E, key, W } from '@/core/grid';
import { scenario } from '@/scenario';

export default scenario({
  name: 'logic-supports',
  seed: 12,
  about: 'S2 brackets, S3 pillar, stilts and platform, S4 arcade, a stilt to the seabed.',
  build(b) {
    b.house(10, 12, { floors: 3, color: 1 }).block('house', 11, 3, 12, { color: 5 }); // S2: brackets against the wall
    b.house(16, 12, { floors: 3, w: 3, color: 2 }); // S4: erase the lower floors, leaving three long pillars in a row
    for (let x = 16; x <= 18; x++) b.erase(x, 1, 12).erase(x, 2, 12);
    b.house(22, 12, { floors: 3, color: 3 }).erase(22, 1, 12).erase(22, 2, 12).block('tree', 22, 1, 12); // stilts round a tree
    b.house(26, 12, { floors: 2, color: 6 }).put('tree', 26, 12).erase(26, 2, 12); // a tree left on a platform
    b.block('house', 2, 0, 16, { color: 0 }).block('house', 2, 1, 16, { color: 0 }).erase(2, 0, 16); // a stilt into the sea
  },
  cameras: [
    { name: 'front', yaw: 20, pitch: 25, zoom: 2.5, target: [18, 2, 12] },
    { name: 'back', yaw: 200, pitch: 30, zoom: 2.5, target: [18, 2, 12] },
  ],
  expect(plan, _dressing, check) {
    const at = (x: number, y: number, z: number) => plan.supports.find((s) => s.carries === key(x, y, z));
    check.equal(at(11, 3, 12)?.type, 'bracket', 'brackets under the jettied room');
    check.equal(at(11, 3, 12)?.against, W, 'brackets against the house');
    check.equal(at(17, 3, 12)?.arcadeTo?.join(), [E, W].join(), 'the middle pillar is arcaded both ways');
    check.equal(at(22, 3, 12)?.type, 'stilts', 'four stilts round the tree');
    check.equal(at(26, 3, 12)?.type, 'platform', 'a platform under the stranded tree');
    check.equal(at(2, 1, 16)?.bottomY, 0, 'down to the seabed');
  },
});
