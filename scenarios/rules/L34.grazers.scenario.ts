// L34: an open meadow on two terraces, far from the little town on its
// edge: sheep graze it and hop between the terraces. A paddock of fenced
// grass has its own standing grazers (U02), which shuffle round now and
// then.
//
//   node src/life/testing/sequence.mjs L34.grazers --frames 12 --every 1500 --name graze --zoom 4 --target 27,1,26

import { scenario } from '@/scenario';

export default scenario({
  name: 'L34.grazers',
  seed: 534,
  about: 'Sheep wandering a meadow and hopping between its terraces; paddock animals shuffling (L34).',
  terrain(t) {
    t.flat(1);
    t.rect(26, 18, 40, 34, 2);
  },
  build(b) {
    for (let i = 0; i < 3; i++) b.house(8 + i * 2, 10, { floors: 1, color: i });
    b.path(7, 12, 14, 12);
    b.fenceAround(8, 15, 11, 18);
  },
  cameras: [
    { name: 'meadow', yaw: 45, pitch: 32, zoom: 3, target: [28, 1.5, 26] },
    { name: 'close', yaw: 45, pitch: 30, zoom: 6, target: [27, 1.5, 26] },
  ],
  expect(_plan, _dressing, check) {
    const sheep = check.actors({ type: 'sheep', rule: 'L34.grazers' }).length;
    check.ok(sheep >= 2 && sheep <= 5, `2 to 5 sheep on the meadow, got ${sheep}`);
  },
});
