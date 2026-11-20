// FX-05: a chapel keeps a church's roof. A square 3 × 3 chapel gets a
// gable running away from its steeple with a cross gable on each side (not
// a pyramid); a path laid across a chapel's roof does not make it a terrace
// with a parasol.

import { scenario } from '@/scenario';

export default scenario({
  name: 'J04.chapel-roof',
  seed: 4004,
  about: 'A square chapel with its steeple to the east (gable along x, two cross gables); a long chapel with a path over its roof (still a gable).',
  build(b) {
    b.house(10, 10, { w: 3, d: 3, color: 5 });
    b.tower(13, 11, { floors: 4 });
    b.house(20, 10, { w: 3, color: 2 });
    b.tower(23, 10, { floors: 3 });
    b.path(20, 10, 22, 10); // laid on the chapel's roof
  },
  cameras: [
    { name: 'front', yaw: 35, pitch: 32, zoom: 4, target: [16, 1.5, 11] },
    { name: 'back', yaw: 215, pitch: 32, zoom: 4, target: [16, 1.5, 11] },
  ],
  expect(_plan, _dressing, check) {
    check.role(10, 1, 10, 'chapel');
    check.hasFeature({ type: 'roof', variant: 'gable', on: [10, 1, 10] });
    check.noFeature({ type: 'roof', variant: 'hip', on: [10, 1, 10] });
    check.equal(check.features({ type: 'dormer', variant: 'cross-gable', on: [10, 1, 10] }).length, 2, 'a transept: a cross gable each side');
    const roof = check.features({ type: 'roof', on: [10, 1, 10] })[0]!;
    check.equal((roof.params as { ridge?: string }).ridge, 'x', 'the nave runs away from the steeple');
    check.role(20, 1, 10, 'chapel');
    check.noFeature({ type: 'roof', variant: 'flat', on: [20, 1, 10] });
  },
});
