// J22 · Plaza paving. Five plazas: too small for a border, a small bordered
// one, an L (the border follows the outline round its inner corner), a 5 × 5
// with plain rings, a 7 × 7 with the compass star, and a 7 × 7 with a
// fountain on its centre, which keeps the rings and loses the star.

import { scenario } from '@/scenario';

export default scenario({
  name: 'J22.plaza-paving',
  seed: 16,
  about: 'Plaza paving: the border course from four cells, rings in a 5 × 5, a compass star in a 7 × 7, rings round a fountain.',
  build(b) {
    b.plaza(8, 10, 9, 10); // two cells: no border
    b.plaza(8, 13, 9, 14); // four cells: a border
    b.plaza(8, 17, 11, 18).plaza(8, 19, 9, 21); // an L
    b.plaza(14, 9, 18, 13); // 5 × 5
    b.plaza(21, 8, 27, 14); // 7 × 7
    b.plaza(15, 17, 21, 23).put('fountain', 18, 20); // 7 × 7 round a fountain
    b.path(18, 14, 18, 16); // a path between two of them: kerbs at both ends
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 42, zoom: 2.5, target: [18, 1, 15.5] },
    { name: 'back', yaw: 225, pitch: 42, zoom: 2.5, target: [18, 1, 15.5] },
    { name: 'star', yaw: 45, pitch: 50, zoom: 4.6, target: [24.5, 1, 11.5] },
    { name: 'corner', yaw: 135, pitch: 36, zoom: 6, target: [10, 1, 19] },
  ],
  expect(_plan, _dressing, check) {
    check.equal(check.features({ type: 'plaza-border' }).length, 5, 'every plaza of four cells or more has a border course');
    check.equal(check.features({ type: 'plaza-motif' }).length, 3, 'a motif in each plaza that holds a 5 × 5');
    check.hasFeature({ type: 'plaza-motif', variant: 'rings', at: [16, 1, 11] });
    check.hasFeature({ type: 'plaza-motif', variant: 'compass', at: [24, 1, 11] });
    check.hasFeature({ type: 'plaza-motif', variant: 'rings', at: [18, 1, 20] });
    check.role(18, 1, 20, 'tiered-fountain');
    check.hasFeature({ type: 'floor-link', variant: 'plaza' }, 2);
  },
});
