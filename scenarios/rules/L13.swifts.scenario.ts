// L13 Swifts (town-wide): if a tower or lighthouse is 5+ tall, or the
// streets total 20+ cells: clamp(street length ÷ 8, 3, 9) swifts loop round
// the tallest structures.
//
// Here: 42 path cells → 5 swifts, shared over the three structures that
// reach highest: the six-storey tower, the lighthouse and the tall house.
// (The cottage and the tree get none.) They are all out at dusk and faster;
// by day three of the five; at night two.
//
//   node src/life/testing/sequence.mjs L13.swifts --frames 12 --every 200 --name loop --zoom 4 --target 22,4,22
//   node src/life/testing/sequence.mjs L13.swifts --time dusk --frames 12 --every 200 --name dusk --zoom 4 --target 22,4,22

import { scenario } from '@/scenario';

export default scenario({
  name: 'L13.swifts',
  seed: 1305,
  about: 'A tower, a lighthouse and a tall house on 42 cells of street: five swifts loop round the three.',
  build(b) {
    b.path(12, 24, 32, 24); // 21
    b.path(22, 14, 22, 23); // + 10
    b.path(12, 25, 12, 30); // + 6
    b.path(32, 25, 32, 29); // + 5  = 42
    b.tower(20, 20, { floors: 6 });
    b.stack('lighthouse', 28, 21, { floors: 5 });
    b.house(24, 18, { floors: 4, color: 2 });
    b.house(16, 22, { floors: 1, w: 2, color: 6 });
    b.put('tree', 14, 21);
  },
  cameras: [
    { name: 'town', yaw: 45, pitch: 30, zoom: 3.4, target: [23, 4, 21] },
    { name: 'dusk', yaw: 45, pitch: 30, zoom: 3.4, target: [23, 4, 21], time: 'dusk' },
    { name: 'back', yaw: 230, pitch: 36, zoom: 3.4, target: [23, 4, 21] },
    { name: 'night', yaw: 45, pitch: 30, zoom: 3.4, target: [23, 4, 21], time: 'night' },
  ],
  expect(plan, _dressing, check) {
    check.equal(plan.world.floors.size, 42, 'street cells');
    const swifts = check.hasActor({ type: 'swift', rule: 'L13.swifts' });
    check.equal(swifts.length, 5, 'swifts: 42 street cells ÷ 8');
    const tower = check.structure(20, 1, 20).id, light = check.structure(28, 1, 21).id, house = check.structure(24, 1, 18).id;
    const around = swifts.map((s) => (s.params as { around: number }).around);
    check.equal([...new Set(around)].sort((a, b) => a - b).join(), [tower, light, house].sort((a, b) => a - b).join(), 'they loop the three tallest structures');
    check.equal(around.filter((id) => id === tower).length, 2, 'the tallest has the most');
    for (const s of swifts) {
      const p = s.params as { around: number; height: number; count: number };
      check.ok(s.at === null, 'a swift roams free');
      check.equal(p.count, 5, 'each knows its flock size');
      check.equal(p.height, p.around === tower ? 7 : p.around === light ? 6 : 5, 'the top of what it loops, in levels');
    }
  },
});
