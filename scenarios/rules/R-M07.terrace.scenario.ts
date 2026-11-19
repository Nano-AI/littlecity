// R-M07: the default marble role. A mass with a top that can be walked on
// is paved there (J16 pins the tag); one wholly built over is not.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-M07.terrace',
  seed: 81,
  about: 'Terraces: a stepped mass, one with a house on part of it, and a block wholly under a house.',
  build(b) {
    b.fill('marble', 9, 10, 11, 11).block('marble', 9, 2, 10);
    b.fill('marble', 14, 10, 16, 11).block('house', 14, 2, 10, { color: 2 });
    b.put('marble', 19, 10).block('house', 19, 2, 10, { color: 4 });
  },
  cameras: [
    { name: 'front', yaw: 40, pitch: 28, zoom: 4, target: [14.5, 1.5, 10.5] },
    { name: 'back', yaw: 220, pitch: 32, zoom: 4, target: [14.5, 1.5, 10.5] },
  ],
  expect(plan, _dressing, check) {
    check.role(10, 1, 10, 'terrace');
    check.hasTag(10, 1, 10, 'top:paved');
    check.role(15, 1, 10, 'terrace');
    check.hasTag(15, 1, 10, 'top:paved');
    check.role(19, 1, 10, 'terrace');
    check.ok(!plan.tags.get(check.structure(19, 1, 10).id)?.has('top:paved'), 'nothing to pave under a house');
  },
});
