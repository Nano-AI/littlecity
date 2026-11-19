// Generated supports (design section 9), drawn by the supports layer:
// brackets under a jettied room (timber) and under a hung marble block
// (stone), a single pillar, an arcade of long pillars, corner stilts round a
// tree, a platform under a stranded tree, and pillars standing in the sea.

import { E, key, W } from '@/core/grid';
import { scenario } from '@/scenario';

export default scenario({
  name: 'S2-S4.supports',
  seed: 61,
  about: 'S2 brackets (timber and stone), S3 pillar, stilts and platform, S4 arcade, pillars and stilts into the sea.',
  terrain(t) {
    t.flat(1);
    t.water(4, 18, 43, 43);
  },
  build(b) {
    // S2: a room hung off a house wall, and a marble block hung off a tower.
    b.house(8, 12, { floors: 3, color: 1 }).block('house', 9, 3, 12, { color: 5 });
    b.stack('marble', 12, 12, { floors: 3 }).block('marble', 13, 3, 12).block('marble', 12, 3, 13);
    // S3: one house on one pillar; a tower on a tall one.
    b.block('house', 16, 3, 12, { color: 0 });
    b.block('tower', 19, 4, 12, { color: 3 }).block('tower', 19, 5, 12, { color: 3 });
    // S4: a row of four houses three levels up: an arcade.
    for (let x = 22; x <= 25; x++) b.block('house', x, 3, 12, { color: 2 });
    // And a block of 2 × 2 on a square of arcades.
    for (const [x, z] of [[28, 11], [29, 11], [28, 12], [29, 12]] as const) b.block('marble', x, 4, z);
    // Stilts: a tree under a raised house. A platform: a tree with no ground.
    b.put('tree', 32, 12).block('house', 32, 3, 12, { color: 6 });
    b.stack('marble', 35, 12, { floors: 2 }).put('tree', 35, 12).erase(35, 2, 12);
    // Over the sea: a house on a pillar with a footing, a row on an arcade, a marble block on one.
    b.block('house', 10, 2, 20, { color: 4 });
    for (let x = 14; x <= 16; x++) b.block('house', x, 3, 20, { color: 7 });
    b.block('marble', 20, 1, 20);
    b.block('dock', 24, 0, 20).block('tree', 24, 1, 20).block('house', 24, 3, 20, { color: 3 });
  },
  cameras: [
    { name: 'front', yaw: 30, pitch: 26, zoom: 3, target: [21, 2, 13] },
    { name: 'back', yaw: 210, pitch: 30, zoom: 3, target: [21, 2, 13] },
    { name: 'brackets', yaw: 20, pitch: 22, zoom: 6.5, target: [11, 2.6, 12] },
    { name: 'arcade', yaw: 35, pitch: 24, zoom: 6, target: [25.5, 2.4, 12] },
    { name: 'sea', yaw: 30, pitch: 28, zoom: 4, target: [17, 1.5, 20] },
  ],
  expect(plan, _dressing, check) {
    const at = (x: number, y: number, z: number) => plan.supports.find((s) => s.carries === key(x, y, z));
    check.equal(at(9, 3, 12)?.type, 'bracket', 'brackets under the jettied room');
    check.equal(at(9, 3, 12)?.against, W, 'against the house');
    check.equal(at(13, 3, 12)?.type, 'bracket', 'brackets under the hung marble');
    check.equal(at(16, 3, 12)?.type, 'pillar', 'a pillar under the lone house');
    check.equal(at(23, 3, 12)?.arcadeTo?.join(), [E, W].join(), 'the arcade joins both ways');
    check.equal(at(28, 4, 11)?.arcadeTo?.length, 2, 'the square of pillars is arcaded on two sides each');
    check.equal(at(32, 3, 12)?.type, 'stilts', 'four stilts round the tree');
    check.equal(at(35, 3, 12)?.type, 'platform', 'a platform under the stranded tree');
    check.equal(at(10, 2, 20)?.bottomY, 0, 'down to the seabed');
    check.equal(at(24, 3, 20)?.type, 'stilts', 'stilts over the tree on the dock');
  },
});
