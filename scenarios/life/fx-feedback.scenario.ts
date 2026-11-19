// The stage for catalogue part F (feedback): a few pieces on flat ground
// with room to click beside them. The feedback itself only exists in
// motion; look at it with
//
//   node src/life/testing/sequence.mjs fx-feedback --edit 'place:house@24,1,24' --frames 12 --every 33 --name land
//
// (more sequences are listed in src/life/MOTION.md). The numbers are tested
// by stepping the system in src/life/feedback/feedback.test.ts.

import { scenario } from '@/scenario';

export default scenario({
  name: 'fx-feedback',
  seed: 31,
  about: 'A small corner of town to click in: landing bounce, neighbour wobble, Auto morph, removal, pop-in.',
  build(b) {
    b.house(22, 22, { floors: 2, color: 0 });
    b.house(26, 22, { floors: 1, w: 2, color: 2 });
    b.tower(22, 26, { floors: 3 });
    b.path(21, 24, 28, 24);
    b.put('tree', 27, 26);
    // An Auto block that stands alone: building beside it changes what it is.
    b.auto(25, 26, { floors: 1 });
  },
  cameras: [
    { name: 'close', yaw: 45, pitch: 33, zoom: 6.5, target: [24.5, 1, 24.5] },
    { name: 'back', yaw: 225, pitch: 38, zoom: 6.5, target: [24.5, 1, 24.5] },
  ],
  expect(plan, _dressing, check) {
    check.kind(22, 1, 22, 'house');
    check.ok(plan.world.blocks.get(plan.world.blocks.keys().next().value!) !== undefined, 'the town was built');
  },
});
