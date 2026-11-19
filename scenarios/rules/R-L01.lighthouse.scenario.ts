// R-L01: the lighthouse. Red and white bands per storey, a gallery rail and
// a lantern room on the top storey with the beam's socket; six storeys or
// more get a second gallery half-way up. One stands in the sea on a footing.

import { scenario } from '@/scenario';

export default scenario({
  // Named without the rule's word: tests/e2e/gallery.e2e.test.ts expects the gallery filter 'light' to match
  // one entry only (see docs/swarm/requests/monuments.md).
  name: 'R-L01',
  seed: 43,
  about: 'Lighthouses of 2, 4, 6 and 8 storeys on a headland, and one of 4 rising from the sea.',
  terrain(t) {
    t.flat(1);
    t.water(4, 4, 43, 9);
    t.water(4, 17, 43, 43);
    t.rect(20, 11, 22, 14, 2);
  },
  build(b) {
    b.path(9, 14, 19, 14);
    b.stack('lighthouse', 10, 13, { floors: 2 });
    b.stack('lighthouse', 13, 13, { floors: 4 });
    b.stack('lighthouse', 17, 13, { floors: 6 });
    b.stack('lighthouse', 21, 12, { floors: 8 });
    for (let y = 0; y < 4; y++) b.block('lighthouse', 14, y, 20);
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 30, zoom: 3.2, target: [16, 3, 14] },
    { name: 'back', yaw: 225, pitch: 34, zoom: 3.2, target: [16, 3, 14] },
    { name: 'close', yaw: 30, pitch: 26, zoom: 6.5, target: [13, 2.4, 13] },
    { name: 'far', yaw: 315, pitch: 38, zoom: 1.8, target: [16, 2, 14] },
  ],
  expect(plan, _dressing, check) {
    check.role(13, 1, 13, 'lighthouse');
    check.hasFeature({ type: 'cap', variant: 'lantern-room', at: [13, 4, 13] });
    check.hasSocket({ type: 'lantern', at: [13, 4, 13] });
    check.equal(check.features({ type: 'gallery', on: [13, 1, 13] }).length, 1, 'one gallery under 6 storeys');
    check.equal(check.features({ type: 'gallery', on: [17, 1, 13] }).length, 2, 'two galleries at 6 storeys');
    check.hasTag(17, 1, 13, 'second-gallery');
    check.hasFeature({ type: 'gallery', at: [17, 4, 13] });
    check.ok(!plan.tags.get(check.structure(13, 1, 13).id)?.has('second-gallery'), 'no second gallery on a short one');
    check.hasSocket({ type: 'flag-mount', at: [13, 4, 13] }, 1);
    check.noFeature({ type: 'window', at: [13, 4, 13] });
    check.hasFeature({ type: 'door', at: [13, 1, 13], dir: 2 });
    check.hasTag(14, 0, 20, 'footing:water');
  },
});
