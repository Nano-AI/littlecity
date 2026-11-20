// The playing field (R-G03): one of each court the shape table makes, side by
// side along a street, so the table can be read off one picture.
//
//   3×2 basketball   4×3 basketball   5×2 tennis (clay)   6×3 tennis by a garden (grass)
//   6×4 football     4×4 bowls        5×4 croquet         1×4 boules
//   1×6 track        an L-shaped kickabout green

import type { Role } from '@/core/vocab';
import { scenario } from '@/scenario';

export default scenario({
  name: 'field-courts',
  seed: 21,
  about: 'One of each court the field shape table makes, along a street.',
  build(b) {
    b.path(6, 12, 41, 12);
    b.path(6, 24, 41, 24);
    b.floor('field', 6, 9, 8, 10); //   3×2 basketball
    b.floor('field', 10, 8, 13, 10); // 4×3 basketball
    b.floor('field', 15, 9, 19, 10); // 5×2 tennis
    b.floor('field', 21, 8, 26, 10); // 6×3 tennis
    b.garden(27, 8, 28, 10);
    b.floor('field', 30, 7, 35, 10); // 6×4 football
    b.floor('field', 6, 14, 9, 17); //  4×4 bowling green
    b.floor('field', 11, 14, 15, 17); // 5×4 croquet
    b.floor('field', 17, 14, 17, 17); // 1×4 boules
    b.floor('field', 19, 14, 19, 19); // 1×6 track
    b.floor('field', 21, 14, 23, 14).floor('field', 21, 15, 21, 17); // an L: kickabout green
    b.house(37, 9, { color: 2 }).house(39, 9, { color: 4 });
  },
  cameras: [
    { name: 'all', yaw: 30, pitch: 40, zoom: 2.3, target: [21, 1, 13] },
    { name: 'near', yaw: 30, pitch: 38, zoom: 5, target: [14, 1, 10] },
  ],
  expect(plan, _dressing, check) {
    const at = (x: number, z: number, role: Role): void => {
      const s = check.floorStructure(x, 1, z);
      check.equal(plan.roles.get(s.id)?.role, role, `the field at (${x}, ${z})`);
    };
    at(6, 9, 'basketball-court');
    at(10, 8, 'basketball-court');
    at(15, 9, 'tennis-court');
    at(21, 8, 'tennis-court');
    at(30, 7, 'football-pitch');
    at(6, 14, 'bowling-green');
    at(11, 14, 'croquet-lawn');
    at(17, 14, 'boules-court');
    at(19, 14, 'running-track');
    at(21, 14, 'kickabout-green');
    check.ok(plan.features.some((f) => f.type === 'field-court' && f.variant === 'grass'), 'the tennis court by the garden is grass');
  },
});
