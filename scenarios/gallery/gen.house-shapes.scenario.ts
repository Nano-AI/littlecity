// GALLERY: the weird shapes. Proof that the shell and the roofs hold up on
// footprints nobody planned for.
//
//   npm run shots -- gen.house-shapes
//
// Back row, west to east: L, T, U, a ring round a courtyard, a plus.
// Front row: a one-cell house five storeys tall, a stepped pile, a house
// with jettied rooms hung off its sides, a tower through a roof, a house
// with a roof terrace reached by stairs, a house on a slope.

import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'gen.house-shapes',
  seed: 4102,
  about: 'L, T, U, ring, plus, one-wide tall, stepped, overhanging, tower through the roof, terrace, slope.',
  rules: houseDressing,
  terrain(t) {
    t.rect(4, 6, 42, 26, 1);
    t.rect(34, 16, 42, 26, 2);
    t.rect(38, 16, 42, 26, 3);
  },
  build(b) {
    // L
    b.house(6, 8, { w: 3, d: 1, floors: 2, color: 0 });
    b.house(6, 9, { w: 1, d: 2, floors: 2, color: 0 });
    // T
    b.house(11, 8, { w: 4, d: 1, color: 2 });
    b.house(12, 9, { w: 2, d: 3, color: 2 });
    // U
    b.house(17, 8, { w: 4, d: 2, floors: 2, color: 3 });
    b.house(17, 10, { w: 1, d: 2, floors: 2, color: 3 });
    b.house(20, 10, { w: 1, d: 2, floors: 2, color: 3 });
    // ring
    b.house(23, 8, { w: 4, d: 1, color: 6 });
    b.house(23, 11, { w: 4, d: 1, color: 6 });
    b.house(23, 9, { w: 1, d: 2, color: 6 });
    b.house(26, 9, { w: 1, d: 2, color: 6 });
    // plus
    b.house(29, 9, { w: 5, d: 1, floors: 2, color: 4 });
    b.house(31, 7, { w: 1, d: 2, floors: 2, color: 4 });
    b.house(31, 10, { w: 1, d: 2, floors: 2, color: 4 });

    // one wide, five tall
    b.house(7, 17, { floors: 5, color: 1 });
    // stepped pile
    b.house(10, 16, { w: 3, d: 3, color: 5 });
    b.house(10, 16, { w: 2, d: 2, color: 5 });
    b.house(10, 16, { w: 1, d: 1, color: 5 });
    // jettied rooms: blocks hung off the upper storey
    b.house(16, 17, { floors: 3, color: 7 });
    b.block('house', 17, 2, 17, { color: 7 });
    b.block('house', 16, 3, 18, { color: 7 });
    // a tower through a roof
    b.house(20, 16, { w: 3, d: 2, color: 5 });
    b.tower(21, 16, { floors: 4 });
    // a roof terrace reached by stairs, with a taller part beside it
    b.house(25, 16, { w: 2, d: 2, color: 2 });
    b.house(27, 16, { w: 1, d: 2, floors: 2, color: 2 });
    b.put('stairs', 25, 18, { rot: 0 });
    b.floor('plaza', 25, 16, 26, 17);
    // on a slope: half on the lower ground, half on the terrace
    b.house(33, 20, { w: 1, d: 2, floors: 2, color: 0 });
    b.house(34, 20, { w: 1, d: 2, floors: 1, color: 0 });
    // on the edge of the higher terrace
    b.house(38, 18, { w: 2, d: 1, color: 3 });
  },
  cameras: [
    { name: 'all', yaw: 45, pitch: 34, zoom: 3.3, target: [22, 1.5, 14] },
    { name: 'back', yaw: 45, pitch: 34, zoom: 5.5, target: [20, 1.5, 10] },
    { name: 'front', yaw: 45, pitch: 34, zoom: 5.5, target: [21, 2, 18] },
    { name: 'back-nw', yaw: 225, pitch: 34, zoom: 5.5, target: [20, 1.5, 10] },
    { name: 'front-se', yaw: 135, pitch: 34, zoom: 5.5, target: [21, 2, 18] },
    { name: 'top', yaw: 45, pitch: 70, zoom: 3.6, target: [22, 1.5, 13] },
  ],
  expect(plan, _dressing, check) {
    check.sameStructure([6, 1, 8], [6, 2, 10]);
    check.sameStructure([23, 1, 8], [26, 1, 11]);
    check.hasFeature({ type: 'roof', variant: 'hip' }, 3);
    check.hasFeature({ type: 'roof', variant: 'flat' });
    check.hasFeature({ type: 'jetty' }, 2);
    check.hasFeature({ type: 'collar' });
    check.hasFeature({ type: 'foundation', variant: 'plinth' });
  },
});
