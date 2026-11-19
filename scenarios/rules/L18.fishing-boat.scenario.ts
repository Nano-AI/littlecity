// L18: a harbour town with a long quay keeps a fishing boat. It lies at its
// berth overnight, puts out at dawn, works the sea lane by day and comes home
// at dusk with the gulls trailing it. A town of five dock cells keeps none.
//
//   node src/life/testing/sequence.mjs L18.fishing-boat --time 0.55 --run --frames 12 --every 2500 --name home --zoom 1.6 --target 24,0,26

import { scenario } from '@/scenario';

export default scenario({
  name: 'L18.fishing-boat',
  seed: 518,
  about: 'A fishing boat that leaves at dawn, loops the sea lane and comes home at dusk trailing gulls (L18).',
  terrain(t) {
    t.flat(0);
    t.rect(16, 14, 32, 27, 1);
  },
  build(b) {
    for (let x = 20; x <= 27; x++) b.block('dock', x, 0, 28); // the quay
    b.path(19, 27, 28, 27);
    for (let i = 0; i < 3; i++) b.house(19 + i * 3, 25, { floors: 1 + (i % 2), w: 2, color: i * 2 + 1 });
  },
  cameras: [
    { name: 'harbour', yaw: 45, pitch: 32, zoom: 4, target: [23, 0, 29] },
    { name: 'island', yaw: 45, pitch: 40, zoom: 1.3, target: [24, 0, 24] },
    { name: 'dusk', yaw: 45, pitch: 32, zoom: 2.4, target: [23, 0, 29], time: 'dusk' },
  ],
  expect(_plan, dressing, check) {
    const boats = check.actors({ type: 'fishing-boat', rule: 'L18.fishing-boat' });
    check.equal(boats.length, 1, 'one fishing boat');
    const p = boats[0]!.params as { berthX: number; berthZ: number };
    check.ok(p.berthZ > 28 && p.berthX >= 19 && p.berthX <= 29, `its berth is on the water by the quay, got ${p.berthX}, ${p.berthZ}`);
    void dressing;
  },
});
