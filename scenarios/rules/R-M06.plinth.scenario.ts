// R-M06: a single marble cell, one tall, on the ground beside a plaza with
// nothing on top is a plinth: a pedestal with a 'statue-base' socket. With
// something on it, two tall, or away from any plaza, it is not.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-M06.plinth',
  seed: 80,
  about: 'A plinth on a square; a block with a pillar on it and a two-storey block on the same square, and a block on grass (terraces).',
  build(b) {
    b.plaza(9, 9, 15, 13);
    b.eraseFloor(10, 11).put('marble', 10, 11);
    b.eraseFloor(12, 11).put('marble', 12, 11).block('pillar', 12, 2, 11); // something on it
    b.eraseFloor(14, 11).stack('marble', 14, 11, { floors: 2 }); // two tall
    b.put('marble', 18, 11); // no plaza
  },
  cameras: [
    { name: 'front', yaw: 40, pitch: 28, zoom: 4.4, target: [13.5, 1.5, 11] },
    { name: 'back', yaw: 220, pitch: 32, zoom: 4.4, target: [13.5, 1.5, 11] },
  ],
  expect(_plan, _dressing, check) {
    check.role(10, 1, 11, 'plinth');
    check.hasSocket({ type: 'statue-base', at: [10, 1, 11] });
    check.role(12, 1, 11, 'terrace');
    check.role(14, 1, 11, 'terrace');
    check.role(18, 1, 11, 'terrace');
    check.equal(check.sockets({ type: 'statue-base' }).length, 1, 'one plinth');
  },
});
