// Fixture for J27 (jettied room): a house cell carried on brackets (support
// rule S2) gets half-timber patterning. West to east: a room hung off the
// second storey; a house whose whole upper storey oversails on two sides; a
// jetty with a further storey on top (the timbering goes all the way up).
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'J27.jettied-room',
  seed: 5327,
  rules: houseDressing,
  build(b) {
    b.path(8, 13, 26, 13);
    b.house(10, 11, { floors: 2, color: 0 });
    b.block('house', 11, 2, 11, { color: 0 });

    b.house(15, 10, { w: 2, d: 2, floors: 2, color: 6 });
    b.block('house', 17, 2, 10, { color: 6 }).block('house', 17, 2, 11, { color: 6 });
    b.block('house', 15, 2, 12, { color: 6 }).block('house', 16, 2, 12, { color: 6 });

    b.house(21, 11, { floors: 3, color: 3 });
    b.block('house', 22, 2, 11, { color: 3 }).block('house', 22, 3, 11, { color: 3 });
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 28, zoom: 6.5, target: [16, 2, 11.5] },
    { name: 'back', yaw: 225, pitch: 28, zoom: 6.5, target: [16, 2, 11.5] },
    { name: 'close', yaw: 50, pitch: 22, zoom: 11, target: [16.5, 2, 11.5] },
  ],
  expect(plan, _dressing, check) {
    check.sameStructure([10, 1, 11], [11, 2, 11]);
    check.hasFeature({ type: 'jetty', at: [11, 2, 11] });
    check.equal(check.features({ type: 'jetty', on: [15, 1, 10] }).length, 4, 'jettied cells of the oversailing storey');
    // The cell stacked on a jetty is carried by it, not by a bracket: one jetty feature for the column.
    check.equal(check.features({ type: 'jetty', on: [21, 1, 11] }).length, 1, 'jetty features for a two-cell column');
    check.equal(check.applied('J27.jettied-room'), 6, 'jetties');
    check.equal(plan.supports.filter((s) => s.type === 'bracket').length, 6, 'brackets');
  },
});
