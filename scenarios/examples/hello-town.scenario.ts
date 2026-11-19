// The smallest useful scenario: a few pieces on the flat test ground, two
// cameras, and assertions the scenario test runs.

import { scenario } from '@/scenario';

export default scenario({
  name: 'hello-town',
  seed: 7,
  about: 'Two houses, a tower and a path on flat ground.',
  build(b) {
    b.house(10, 12, { floors: 2, color: 1 });
    b.house(12, 12, { floors: 2, w: 2, color: 3 });
    b.tower(16, 12, { floors: 4 });
    b.path(9, 14, 17, 14);
    b.put('tree', 9, 12);
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 32, zoom: 3.2, target: [13, 1, 13] },
    { name: 'back', yaw: 225, pitch: 40, zoom: 3.2, target: [13, 1, 13] },
  ],
  expect(plan, _dressing, check) {
    check.kind(10, 1, 12, 'house');
    check.kind(16, 4, 12, 'tower');
    check.equal(plan.world.blocks.size, 2 + 4 + 4 + 1, 'blocks placed');
    check.equal(plan.world.floors.size, 9, 'path cells');
    check.floorStructure(9, 1, 14);
  },
});
