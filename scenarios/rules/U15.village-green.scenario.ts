// Fixture for U15 (village green).
//   grass ringed by six cottages (three each side    a green: a lighter mown sward, a maypole near the
//   looking across it), a street along one end,      middle, a ring bench round the tree, the village
//   a big tree on it                                 sign by the street
//   a single row of cottages facing open grass       not a green (looked at from one side only)
//   cottages round a square's edge                   not a green (the square is the heart there)

import { scenario } from '@/scenario';

export default scenario({
  name: 'U15.village-green',
  seed: 1515,
  about: 'Open grass that a ring of four or more houses looks across from opposite sides, touching a street, is the village green: a mown sward, a maypole, a ring bench round its tree, a village sign.',
  build(b) {
    // The green: x 10..16, z 12..17, rows of cottages north (z 10) and south (z 19), a street west.
    b.path(8, 8, 8, 21);
    for (const x of [10, 13, 16]) b.house(x, 10, { floors: 1 + (x % 2), color: x % 8 }).house(x, 19, { floors: 2 - (x % 2), color: (x + 3) % 8 });
    b.path(9, 9, 16, 9).path(9, 20, 16, 20);
    b.put('tree', 15, 14);
    // A single row facing open grass.
    b.path(24, 8, 36, 8);
    for (const x of [25, 28, 31, 34]) b.house(x, 9, { color: (x + 1) % 8 });
    // A square ringed by houses: its lawn is not a green.
    b.plaza(26, 24, 28, 26);
    for (const x of [25, 27, 29]) b.house(x, 22, { color: x % 8 }).house(x, 31, { color: (x + 2) % 8 });
    b.path(24, 23, 24, 32);
  },
  cameras: [
    { name: 'green', yaw: 40, pitch: 36, zoom: 4.2, target: [13, 1, 15] },
    { name: 'maypole', yaw: 30, pitch: 22, zoom: 9, target: [12.5, 1.6, 14.5] },
    { name: 'green-back', yaw: 220, pitch: 36, zoom: 4.2, target: [13, 1, 15] },
    { name: 'all', yaw: 40, pitch: 45, zoom: 1.9, target: [22, 1, 18] },
    { name: 'dusk', yaw: 40, pitch: 36, zoom: 4.2, target: [13, 1, 15], time: 'dusk' },
    { name: 'night', yaw: 40, pitch: 36, zoom: 4.2, target: [13, 1, 15], time: 'night' },
  ],
  expect(_plan, dressing, check) {
    const rule = 'U15.village-green';
    const xz = (p: (typeof dressing.props)[number]): [number, number] => ('cell' in p.at ? [p.at.cell & 63, (p.at.cell >> 6) & 63] : [-1, -1]);
    const sward = check.props({ rule, type: 'sward' });
    check.ok(sward.length >= 20, `the green is mown (${sward.length} cells)`);
    check.ok(sward.every((p) => xz(p)[0] >= 9 && xz(p)[0] <= 17 && xz(p)[1] >= 11 && xz(p)[1] <= 18), 'only between the rows');
    const pole = check.hasProp({ rule, type: 'maypole' }, 1);
    check.equal(pole.length, 1, 'one maypole');
    check.ok(dressing.sockets.some((s) => s.owner === pole[0]!.id && s.type === 'activity' && s.name === 'dance'), 'the maypole has a place to dance');
    const bench = check.hasProp({ rule, type: 'ring-bench', at: [15, 1, 14] });
    check.equal(dressing.sockets.filter((s) => s.owner === bench[0]!.id && s.type === 'seat').length, 4, 'four seats round the tree');
    check.hasProp({ rule, type: 'village-sign' });
    check.ok(!check.props({ type: 'tuft' }).some((p) => sward.some((s) => xz(s)[0] === xz(p)[0] && xz(s)[1] === xz(p)[1])), 'no wild tufts on the mown green');
    // Must not.
    check.ok(!check.props({ rule }).some((p) => xz(p)[0] >= 22), 'no green by the single row or the square');
  },
});
