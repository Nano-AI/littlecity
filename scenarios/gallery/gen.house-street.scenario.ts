// GALLERY: a street of houses, one of every role and shape the house
// generator supports, to judge them as a row (plan section 3: silhouette,
// scale, line, colour, hand, family, detail density).
//
//   npm run shots -- gen.house-street            (and --time dusk, --time night)
//
// North side of the street, west to east: a cottage, a long cottage, four
// shops in a terrace, three townhouses behind their front gardens, a chapel
// with its steeple, a cottage on the rise with a stone foundation. South
// side: two shops on the square, a hipped L-shaped house, a house with a
// lean-to and a roof terrace, a jettied house, a row of five, a windmill in
// its field, and a stilt house on the quay.

import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'gen.house-street',
  seed: 4101,
  about: 'A street of two dozen houses: every tier-1 role and the common shapes, with a windmill and a stilt house.',
  rules: houseDressing,
  terrain(t) {
    t.rect(4, 10, 40, 27, 1);
    t.rect(31, 10, 40, 17, 2); // a rise at the east end
  },
  build(b) {
    b.path(6, 20, 35, 20);
    b.plaza(13, 21, 16, 23);
    b.path(24, 21, 24, 27);
    b.path(33, 18, 33, 19);

    // ── North side: fronts to the south, onto the street ──
    b.house(7, 19, { color: 0 });
    b.house(9, 19, { w: 2, color: 3 });
    b.house(12, 19, { floors: 2, color: 2 });
    b.house(13, 19, { floors: 2, color: 5 });
    b.house(14, 19, { floors: 3, color: 6 });
    b.house(15, 19, { floors: 2, color: 4 });
    // townhouses, one cell back, each behind a strip of garden
    b.house(18, 18, { floors: 4, color: 7 });
    b.house(20, 18, { floors: 3, color: 1 });
    b.house(22, 18, { floors: 5, color: 0 });
    // the chapel
    b.house(25, 19, { w: 3, color: 5 });
    b.tower(28, 19, { floors: 4 });
    // on the rise
    b.house(31, 16, { w: 2, color: 2 });
    b.house(34, 15, { floors: 2, color: 6 });

    // ── South side ──
    b.house(12, 21, { d: 2, floors: 2, color: 6 }); // shops either side of the square
    b.house(17, 21, { d: 2, floors: 2, color: 3 });
    b.house(19, 22, { w: 3, d: 3, color: 0 }); // a hipped L
    b.house(19, 21, { w: 2, color: 0 });
    b.house(26, 21, { w: 2, d: 2, floors: 2, color: 4 }); // a tall block with a lean-to wing
    b.house(28, 21, { color: 4 });
    b.house(30, 22, { floors: 2, color: 7 }); // jettied
    b.block('house', 31, 2, 22, { color: 7 });
    b.block('house', 30, 2, 23, { color: 7 });
    // a row of five, off the street
    const row = [2, 5, 1, 6, 3];
    for (let i = 0; i < 5; i++) b.house(6 + i, 24, { floors: i === 2 ? 1 : 2, color: row[i]! });
    // the mill in its field
    b.garden(33, 22, 37, 25);
    b.stack('windmill', 35, 22, { floors: 2 });
    // on the quay
    for (let x = 18; x <= 22; x++) b.block('dock', x, 0, 28);
    b.block('dock', 20, 0, 29).block('dock', 21, 0, 29);
    b.block('house', 20, 1, 29, { color: 4 }).block('house', 21, 1, 29, { color: 4 });
  },
  cameras: [
    { name: 'street', yaw: 45, pitch: 32, zoom: 3.4, target: [21, 1.5, 21] },
    { name: 'west', yaw: 45, pitch: 32, zoom: 6.5, target: [12, 1.5, 20.5] },
    { name: 'mid', yaw: 45, pitch: 32, zoom: 6.5, target: [20.5, 1.5, 20] },
    { name: 'east', yaw: 45, pitch: 32, zoom: 6.5, target: [29.5, 1.5, 20] },
    { name: 'se', yaw: 135, pitch: 32, zoom: 3.4, target: [21, 1.5, 21] },
    { name: 'nw', yaw: 225, pitch: 32, zoom: 3.4, target: [21, 1.5, 21] },
    { name: 'ne', yaw: 315, pitch: 32, zoom: 3.4, target: [21, 1.5, 21] },
    { name: 'close', yaw: 40, pitch: 26, zoom: 11, target: [13.5, 1.6, 19.6] },
    { name: 'low', yaw: 60, pitch: 16, zoom: 6, target: [20, 2, 20] },
  ],
  expect(plan, _dressing, check) {
    check.role(7, 1, 19, 'cottage');
    check.role(13, 1, 19, 'shop');
    check.role(20, 1, 18, 'townhouse');
    check.role(25, 1, 19, 'chapel');
    check.role(8, 1, 24, 'row-house');
    check.role(20, 1, 29, 'stilt-house');
    check.role(35, 1, 22, 'windmill');
    const houses = [...plan.structures.values()].filter((s) => s.kind === 'house');
    check.ok(houses.length >= 20, `${houses.length} houses`);
    check.equal(new Set([...plan.roles.values()].map((r) => r.role)).size >= 7, true, 'at least seven roles');
    for (const variant of ['gable', 'hip', 'lean-to', 'stepped-gable']) check.hasFeature({ type: 'roof', variant });
    check.hasFeature({ type: 'jetty' }, 2);
    check.hasFeature({ type: 'foundation', variant: 'plinth' });
  },
});
