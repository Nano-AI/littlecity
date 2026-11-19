// GALLERY: a street of houses, one of every role and shape the house
// generator supports, to judge them as a row (plan section 3: silhouette,
// scale, line, colour, hand, family, detail density).
//
//   npm run shots -- gen.house-street            (and --time dusk, --time night)
//
// North side, west to east: a cottage, a tall cottage, a long cottage, a
// four-house row, a townhouse behind its front garden, a chapel with its
// steeple. South side: a corner shop on the square, a second shop, an
// L-shaped house, a house with a lean-to wing, a jettied house, a manor.

import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'gen.house-street',
  seed: 4101,
  about: 'A street of at least twelve different houses: every tier-1 role and the common shapes.',
  rules: houseDressing,
  terrain(t) {
    t.rect(4, 8, 42, 30, 1);
    t.rect(34, 8, 42, 14, 2); // a terrace behind the chapel
  },
  build(b) {
    b.path(6, 19, 33, 19);
    b.plaza(10, 20, 13, 23);
    b.path(22, 20, 22, 25);

    // North side (doors face south onto the street).
    b.house(7, 18, { color: 0 });
    b.house(9, 18, { floors: 2, color: 2 });
    b.house(11, 18, { w: 2, color: 3 });
    b.house(14, 18, { floors: 2, color: 1 });
    b.house(15, 18, { floors: 2, color: 5 });
    b.house(16, 18, { floors: 3, color: 6 });
    b.house(17, 18, { floors: 2, color: 4 });
    b.house(20, 17, { floors: 4, color: 7 }); // townhouse, one cell back from the street
    b.house(23, 18, { w: 3, color: 5 }); // chapel nave
    b.tower(26, 18, { floors: 4 });
    b.house(29, 17, { w: 2, d: 2, floors: 2, color: 2 });

    // South side.
    b.house(9, 20, { floors: 2, color: 6 }); // shop on the square's west side
    b.house(14, 20, { w: 2, floors: 2, color: 3 }); // shop on its east side
    b.house(17, 20, { w: 3, d: 3, floors: 1, color: 0 }); // a big hipped house
    b.house(17, 20, { w: 1, d: 1, floors: 1, color: 0 });
    b.house(24, 20, { w: 2, d: 2, floors: 2, color: 4 }); // a tall block
    b.house(26, 20, { w: 1, d: 2, color: 4 }); // with a lean-to wing
    b.house(29, 20, { floors: 2, color: 1 });
    b.house(31, 20, { w: 2, d: 3, color: 7 });
  },
  cameras: [
    { name: 'street', yaw: 45, pitch: 32, zoom: 3.6, target: [20, 1.5, 20] },
    { name: 'west', yaw: 45, pitch: 32, zoom: 6.5, target: [12, 1.5, 19.5] },
    { name: 'mid', yaw: 45, pitch: 32, zoom: 6.5, target: [19, 1.5, 19.5] },
    { name: 'east', yaw: 45, pitch: 32, zoom: 6.5, target: [27, 1.5, 19.5] },
    { name: 'se', yaw: 135, pitch: 32, zoom: 3.6, target: [20, 1.5, 20] },
    { name: 'nw', yaw: 225, pitch: 32, zoom: 3.6, target: [20, 1.5, 20] },
    { name: 'ne', yaw: 315, pitch: 32, zoom: 3.6, target: [20, 1.5, 20] },
  ],
  expect(plan, _dressing, check) {
    check.role(7, 1, 18, 'cottage');
    check.role(20, 1, 17, 'townhouse');
    check.role(23, 1, 18, 'chapel');
    check.role(9, 1, 20, 'shop');
    check.ok(new Set([...plan.roles.values()].map((r) => r.role)).size >= 5, 'at least five different roles in the street');
  },
});
