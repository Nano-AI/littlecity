// L41: a river dug by hand (a channel three columns wide is a river; see the
// rule), from the north into the sea in the south, a dock on the
// west bank upstream and another on the east bank downstream, sixteen cells
// apart by water. A barge is poled between them.
//
// A short dock by the sea (z = 38) is not on the river: it does not count.
//
//   node src/life/testing/sequence.mjs L41.river-barge --warm 2000 --frames 12 --every 4000 --name pole --zoom 2.4 --target 22.5,0,19

import { scenario } from '@/scenario';

export default scenario({
  name: 'L41.river-barge',
  seed: 4101,
  about: 'A hand-dug river with a dock at each end: a barge is poled between them (L41).',
  terrain(t) {
    t.flat(1);
    t.water(4, 36, 43, 43);
    t.water(21, 4, 23, 35);
  },
  build(b) {
    for (let z = 9; z <= 10; z++) b.block('dock', 21, 0, z);
    for (let z = 26; z <= 27; z++) b.block('dock', 23, 0, z);
    b.path(18, 9, 20, 9).path(24, 27, 27, 27);
    b.house(17, 7, { w: 2, floors: 2, color: 3 }).house(27, 25, { w: 2, color: 6 });
    for (let x = 10; x <= 12; x++) b.block('dock', x, 0, 37);
  },
  cameras: [
    { name: 'river', yaw: 40, pitch: 36, zoom: 2.2, target: [22.5, 0.5, 18] },
    { name: 'close', yaw: 60, pitch: 30, zoom: 6, target: [22.5, 0.6, 11] },
  ],
  expect(_plan, _dressing, check) {
    const calls = check.actors({ type: 'ship-call', rule: 'L41.river-barge' });
    check.equal(calls.length, 1, 'one barge');
    const p = calls[0]!.params as { x: number; z: number; x2: number; z2: number };
    check.ok(Math.min(p.z, p.z2) < 12 && Math.max(p.z, p.z2) > 24, `between the two river docks, got ${JSON.stringify(p)}`);
  },
});
