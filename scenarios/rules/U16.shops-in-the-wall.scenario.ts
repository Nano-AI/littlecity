// Fixture for U16 (shops in the wall).
//   a two-storey marble podium, 8 long, its south      booths and a wall fountain every second cell, the
//   wall on a square, its north wall on open grass     grass strip in front paved; on the grass side a
//                                                      storeroom door, a niche bench or ivy
//   a marble wall one block thick and three tall       booths along the street, an apron in front
//   along a street with a grass strip before it
//   a castle keep (3 tall, 3 × 3) beside the square    stays blank: no booths
//   a one-storey marble block                          too low: nothing

import { scenario } from '@/scenario';

export default scenario({
  name: 'U16.shops-in-the-wall',
  seed: 1616,
  about: 'A long blank marble wall two storeys or more on a street or square gets arched booths with goods, a wall fountain and a paved apron; facing open ground, a storeroom door, a niche bench or ivy. Castle keeps stay blank.',
  build(b) {
    // The podium: x 10..17, z 14..15, two storeys, its south wall on a square.
    b.fill('marble', 10, 14, 17, 15, { floors: 2, color: 2 });
    b.plaza(9, 17, 18, 19);
    // The wall along a street: x 10..17 at z 26, three tall, one thick; a grass strip at z 27, the street at z 28.
    for (let x = 10; x <= 17; x++) b.stack('marble', x, 26, { floors: 3, color: 1 });
    b.path(8, 28, 19, 28);
    // A keep beside the square.
    b.fill('marble', 21, 15, 23, 17, { floors: 3, color: 3 });
    // A one-storey block.
    for (let x = 26; x <= 30; x++) b.put('marble', x, 18);
    b.path(25, 19, 31, 19);
  },
  cameras: [
    { name: 'podium', yaw: 20, pitch: 26, zoom: 5.5, target: [13.5, 1.6, 16.5] },
    { name: 'booth', yaw: 30, pitch: 18, zoom: 11, target: [12.5, 1.5, 16.2] },
    { name: 'wall', yaw: 20, pitch: 26, zoom: 5.5, target: [13.5, 2, 27.5] },
    { name: 'back', yaw: 200, pitch: 30, zoom: 5.5, target: [13.5, 1.6, 13] },
    { name: 'all', yaw: 30, pitch: 40, zoom: 2.4, target: [19, 1, 20] },
    { name: 'dusk', yaw: 20, pitch: 26, zoom: 5.5, target: [13.5, 1.6, 16.5], time: 'dusk' },
    { name: 'night', yaw: 20, pitch: 26, zoom: 5.5, target: [13.5, 2, 27.5], time: 'night' },
  ],
  expect(plan, dressing, check) {
    const rule = 'U16.shops-in-the-wall';
    const xz = (p: (typeof dressing.props)[number]): [number, number] => ('cell' in p.at ? [p.at.cell & 63, (p.at.cell >> 6) & 63] : [-1, -1]);
    const mine = check.props({ rule });
    const square = mine.filter((p) => xz(p)[1] === 16 && p.type !== 'paving');
    check.ok(square.length === 4, `one piece every second cell along the square (${square.length})`);
    check.ok(square.some((p) => p.type === 'wall-booth'), 'booths on the square');
    check.equal(square.filter((p) => p.type === 'wall-fountain').length, 1, 'one wall fountain');
    for (const b of check.props({ rule, type: 'wall-booth' })) {
      check.ok(dressing.sockets.some((s) => s.owner === b.id && s.type === 'activity' && s.name === 'vend'), 'a booth has a place to sell from');
      check.ok(dressing.sockets.some((s) => s.owner === b.id && s.type === 'activity' && s.name === 'browse'), 'and a place to buy at');
    }
    const back = mine.filter((p) => xz(p)[1] === 13);
    check.ok(back.length === 4 && back.every((p) => p.type === 'store-door' || p.type === 'niche-bench' || p.type === 'creeper'), 'doors, niches or ivy on the grass side');
    const street = mine.filter((p) => xz(p)[1] === 27);
    check.ok(street.filter((p) => p.type === 'wall-booth' || p.type === 'wall-fountain').length === 4, 'booths along the street wall');
    check.equal(street.filter((p) => p.type === 'paving').length, 8, 'the grass strip before the street wall is paved');
    // Must not.
    check.ok(!mine.some((p) => xz(p)[0] >= 20), 'the keep and the low block stay as they are');
    check.ok(plan.roles.get(plan.structureAt.get(((22 << 0) | (16 << 6) | (1 << 12)) as number)!)?.role === 'keep', 'the castle block is a keep');
  },
});
