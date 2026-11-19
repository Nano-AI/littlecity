// L37: every garrisoned castle keeps a rider.
//
//   the walled castle   its gatehouse opens onto a street down to the town
//                       square: the rider trots to the square, across it and
//                       back a few times a day
//   the small castle    a street leads from its gate but there is no square:
//                       the rider rides to the street's far end and back
//   the lone keep       no street at all: the horse stands tethered by the
//                       keep's door all day (and the keep has its troop, L36)
//
//   node src/life/testing/sequence.mjs L37.rider --warm 40000 --zoom 12 --aim '(r => [r.x, r.y, r.z])(window.__lcGarrison.list[0].ride)' --follow --frames 8 --every 125 --name trot

import { scenario } from '@/scenario';

export default scenario({
  name: 'L37.rider',
  seed: 370,
  about: 'A rider for every garrisoned castle (L37): to the square, along a street with no square, or tethered where there is no street.',
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
    // The small castle: a street from its gate, and no square anywhere it leads.
    for (const [x, z] of [[30, 6], [36, 6]] as const) b.tower(x, z, { floors: 3, color: 4 });
    for (let x = 31; x <= 35; x++) b.put('wall', x, 6);
    for (let z = 7; z <= 11; z++) b.put('wall', 30, z).put('wall', 36, z);
    for (const x of [30, 31, 35, 36]) b.put('wall', x, 12);
    b.stack('marble', 32, 12, { floors: 2, color: 3 }).stack('marble', 34, 12, { floors: 2, color: 3 });
    b.put('arch', 33, 12);
    b.path(33, 13, 33, 21);
    // A keep alone in the fields.
    b.fill('marble', 36, 34, 38, 36, { floors: 4 });
  },
  cameras: [
    { name: 'gate', yaw: 45, pitch: 35, zoom: 4, target: [16, 1, 19] },
    { name: 'street', yaw: 45, pitch: 35, zoom: 4, target: [33, 1, 14] },
    { name: 'keep', yaw: 45, pitch: 35, zoom: 4, target: [37, 1, 35] },
  ],
  expect(_plan, _dressing, check) {
    const troops = check.actors({ type: 'garrison', rule: 'L36.garrison' });
    check.equal(troops.length, 3, 'all three castles have a troop, the lone keep too');
    check.equal(check.actors({ type: 'rider', rule: 'L37.rider' }).length, 3, 'and a rider each: riding out, or tethered where there is no street');
  },
});
