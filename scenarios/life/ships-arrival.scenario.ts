// A harbour one step from a big port: a quay of ten with two cells missing,
// and a pier. Close the gap and a galleon calls (L38): the first comes up
// over the edge of the map within twenty seconds and is alongside about a
// minute later.
//
//   node src/life/testing/sequence.mjs ships-arrival --edit 'place:dock@22,0,27; place:dock@23,0,27' --warm 0 --frames 16 --every 5000 --name arrive --zoom 1.4 --target 24,0,26

import { scenario } from '@/scenario';

export default scenario({
  name: 'ships-arrival',
  seed: 3801,
  about: 'A quay with a two-cell gap: fill it and a galleon calls (L38).',
  terrain(t) {
    t.flat(0);
    t.rect(14, 12, 34, 26, 1);
  },
  build(b) {
    for (let x = 18; x <= 27; x++) if (x !== 22 && x !== 23) b.block('dock', x, 0, 27);
    for (let z = 27; z <= 30; z++) b.block('dock', 31, 0, z);
    b.path(17, 26, 31, 26);
    for (let i = 0; i < 4; i++) b.house(18 + i * 3, 23, { floors: 1 + (i % 3), w: 2, color: i * 2 + 1 });
  },
  cameras: [
    { name: 'island', yaw: 45, pitch: 40, zoom: 1.3, target: [24, 0, 24] },
    { name: 'harbour', yaw: 40, pitch: 30, zoom: 3, target: [23, 1, 28.5] },
  ],
  expect(_plan, _dressing, check) {
    check.equal(check.actors({ type: 'ship-call' }).length, 0, 'no ship calls until the quay is whole');
  },
});
