// A harbour with nowhere yet for a big ship: three short stubs of quay. Lay
// the docks between them and a ship that fits comes (the galleon first: it
// is the biggest): in through the edge of the map within half a minute,
// alongside a minute or so later.
//
//   node src/life/testing/sequence.mjs ships-arrival --edit 'place:dock@20,0,27; place:dock@21,0,27; place:dock@23,0,27; place:dock@24,0,27' --warm 0 --frames 16 --every 5000 --name arrive --zoom 1.4 --target 24,0,26

import { scenario } from '@/scenario';

export default scenario({
  name: 'ships-arrival',
  seed: 3801,
  about: 'Short stubs of quay: join them and a ship that fits calls (L38).',
  terrain(t) {
    t.flat(0);
    t.rect(14, 12, 34, 26, 1);
  },
  build(b) {
    for (const x of [18, 19, 22, 25, 26, 27]) b.block('dock', x, 0, 27);
    b.path(17, 26, 31, 26);
    for (let i = 0; i < 4; i++) b.house(18 + i * 3, 23, { floors: 1 + (i % 3), w: 2, color: i * 2 + 1 });
  },
  cameras: [
    { name: 'island', yaw: 45, pitch: 40, zoom: 1.3, target: [24, 0, 24] },
    { name: 'harbour', yaw: 40, pitch: 30, zoom: 3, target: [23, 1, 28.5] },
  ],
  expect(_plan, _dressing, check) {
    check.equal(check.actors({ type: 'ship-call' }).filter((a) => a.variant !== 'passing').length, 0, 'no ship fits until the quay is whole');
  },
});
