// L37: a walled castle whose gatehouse opens onto a street running down to
// the town square keeps a rider, who trots to the square and back a few
// times a day. A keep standing alone in the fields, with no street from its
// door, keeps its troop (L36) but no rider.
//
//   node src/life/testing/sequence.mjs L37.rider --warm 40000 --zoom 12 --aim '(r => [r.x, r.y, r.z])(window.__lcGarrison.list[0].ride)' --follow --frames 8 --every 125 --name trot

import { scenario } from '@/scenario';

export default scenario({
  name: 'L37.rider',
  seed: 370,
  about: 'A rider for a castle whose gate gives onto a street (L37); none for a keep with no street.',
  build(b) {
    for (const [x, z] of [[10, 8], [18, 8], [10, 15], [18, 15]] as const) b.tower(x, z, { floors: 3, color: 1 });
    for (let x = 11; x <= 17; x++) b.put('wall', x, 8);
    for (let z = 9; z <= 14; z++) b.put('wall', 10, z).put('wall', 18, z);
    for (let x = 11; x <= 12; x++) b.put('wall', x, 15);
    for (let x = 16; x <= 17; x++) b.put('wall', x, 15);
    b.stack('marble', 13, 15, { floors: 2, color: 3 }).stack('marble', 15, 15, { floors: 2, color: 3 });
    b.put('arch', 14, 15);
    b.path(14, 16, 14, 24);
    b.path(15, 24, 21, 24);
    b.plaza(22, 22, 27, 27);
    for (let i = 0; i < 4; i++) b.house(23 + i * 2 - 1, 20, { color: i + 1 });
    // A keep alone in the fields.
    b.fill('marble', 36, 34, 38, 36, { floors: 4 });
  },
  cameras: [
    { name: 'gate', yaw: 45, pitch: 35, zoom: 4, target: [16, 1, 19] },
    { name: 'square', yaw: 45, pitch: 35, zoom: 4, target: [22, 1, 24] },
  ],
  expect(_plan, _dressing, check) {
    check.hasActor({ type: 'garrison', rule: 'L36.garrison' });
    check.equal(check.actors({ type: 'rider', rule: 'L37.rider' }).length, 1, 'only the castle with a street from its gate has a rider');
  },
});
