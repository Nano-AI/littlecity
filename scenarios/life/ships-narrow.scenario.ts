// Several berths sharing one narrow lane: a basin on the south shore reached
// only through a channel five columns wide, with three berths round it. Ships
// in and out of the basin use the one channel: the later waits beyond the
// edge of the map or holds at its berth until the channel is clear. Nobody is
// ever stuck and no two hulls ever meet (src/life/ships/ships.test.ts).

import { scenario } from '@/scenario';

export default scenario({
  name: 'ships-narrow',
  seed: 4500,
  about: 'Three berths round a basin reached through one narrow channel: ships take turns in the channel.',
  terrain(t) {
    t.flat(1);
    // The sea to the north, a channel down into a basin.
    t.water(4, 4, 43, 12);
    t.water(21, 13, 25, 22);
    t.water(10, 23, 36, 33);
  },
  build(b) {
    for (let x = 12; x <= 19; x++) b.block('dock', x, 0, 33);
    for (let x = 27; x <= 34; x++) b.block('dock', x, 0, 33);
    for (let z = 24; z <= 31; z++) b.block('dock', 36, 0, z);
  },
  cameras: [{ name: 'basin', yaw: 30, pitch: 40, zoom: 1.6, target: [24, 0, 20] }],
  expect(_plan, _dressing, check) {
    const berths = new Set(check.actors({ type: 'ship-call' }).filter((a) => a.variant !== 'passing').map((a) => `${(a.params as { x: number }).x},${(a.params as { z: number }).z}`));
    check.ok(berths.size >= 3, `three berths share the channel, got ${berths.size}`);
  },
});
