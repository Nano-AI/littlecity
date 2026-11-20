// L41 and the bridges: a river three columns wide, a dock up it and a dock
// down it. Between them a bridge two storeys up (room under it: the barge
// passes, its mast lowered); below the lower dock a stone bridge at the
// water (an arch, a quarter storey clear: nothing passes), so the barge
// works the reach between the docks and never goes to sea.
//
//   node src/life/testing/sequence.mjs ships-bridges --warm 2000 --frames 12 --every 1500 --name under --zoom 4 --target 22.5,0.6,18

import { scenario } from '@/scenario';

export default scenario({
  name: 'ships-bridges',
  seed: 4102,
  about: 'A barge between two river docks, under a high bridge; a low stone bridge below shuts the river from the sea (L41).',
  terrain(t) {
    t.flat(1);
    t.water(4, 38, 43, 43);
    t.water(21, 6, 23, 37);
  },
  build(b) {
    for (let z = 9; z <= 10; z++) b.block('dock', 21, 0, z);
    for (let z = 26; z <= 27; z++) b.block('dock', 23, 0, z);
    b.path(17, 9, 20, 9).path(24, 27, 28, 27);
    b.house(16, 7, { w: 2, floors: 2, color: 3 }).house(27, 25, { w: 2, color: 6 });
    // The high bridge: piers on the banks, the deck two storeys up.
    for (const x of [20, 24]) for (let y = 1; y <= 2; y++) b.block('marble', x, y, 18);
    for (let x = 20; x <= 24; x++) b.block('arch', x, 3, 18);
    // The low bridge, at the water.
    for (let x = 21; x <= 23; x++) b.block('arch', x, 0, 32);
    b.path(18, 32, 20, 32).path(24, 32, 27, 32);
  },
  cameras: [
    { name: 'river', yaw: 40, pitch: 36, zoom: 2, target: [22.5, 0.5, 20] },
    { name: 'under', yaw: 70, pitch: 22, zoom: 4.5, target: [22.5, 1, 18] },
    { name: 'low', yaw: 220, pitch: 26, zoom: 4.5, target: [22.5, 0.5, 32] },
  ],
  expect(_plan, _dressing, check) {
    const calls = check.actors({ type: 'ship-call', rule: 'L41.river-barge' });
    check.equal(calls.length, 1, 'one barge');
    const p = calls[0]!.params as { z: number; z2: number };
    check.ok(Math.min(p.z, p.z2) < 12 && Math.max(p.z, p.z2) > 24 && Math.max(p.z, p.z2) < 32, `between the docks, not past the low bridge: ${JSON.stringify(p)}`);
  },
});
