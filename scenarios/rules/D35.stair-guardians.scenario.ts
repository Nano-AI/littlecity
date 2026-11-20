// Fixture for D35 (guardians at the head of the stair).
//   a marble terrace 3 high with a grand stair 4 wide down its south side    a pair of guardians on the
//                                                                            landing at the head, a pair
//                                                                            of lamps at the foot
//   a second stair, 2 wide                                                   too narrow: none

import { scenario } from '@/scenario';

export default scenario({
  name: 'D35.stair-guardians',
  seed: 3535,
  about: 'A flight of grand steps three or more wide gets a pair of stone lions or urns at its head and a pair of tall lamps at its foot; narrower flights get none.',
  build(b) {
    // A terrace, 3 high, x 10..17, z 10..13 (a 2-thick wall would be a keep at 3 high; this is long and thin).
    for (let x = 10; x <= 17; x++) for (let z = 10; z <= 11; z++) b.stack('marble', x, z, { floors: 3, color: 0 });
    // A grand stair 4 wide down the south side: rows at z 12 (2 high), 13 (1 high)... 3 rows to reach 3.
    for (let x = 12; x <= 15; x++) {
      b.stack('marble', x, 12, { floors: 2, color: 0 });
      b.put('marble', x, 13, { color: 0 });
    }
    // A narrow flight on another terrace.
    for (let x = 24; x <= 29; x++) b.stack('marble', x, 10, { floors: 3, color: 1 });
    for (let x = 26; x <= 27; x++) {
      b.stack('marble', x, 11, { floors: 2, color: 1 });
      b.put('marble', x, 12, { color: 1 });
    }
  },
  cameras: [
    { name: 'stair', yaw: 30, pitch: 28, zoom: 5.5, target: [13.5, 2, 12.5] },
    { name: 'head', yaw: 20, pitch: 30, zoom: 9, target: [13.5, 3.5, 11.5] },
    { name: 'all', yaw: 30, pitch: 40, zoom: 2.6, target: [20, 2, 12] },
  ],
  expect(_plan, dressing, check) {
    const rule = 'D35.stair-guardians';
    const xz = (p: (typeof dressing.props)[number]): [number, number] => ('cell' in p.at ? [p.at.cell & 63, (p.at.cell >> 6) & 63] : [-1, -1]);
    const guardians = check.props({ rule, type: 'guardian' });
    check.equal(guardians.length, 2, 'a pair of guardians at the head');
    check.ok(guardians.every((p) => xz(p)[1] === 10 && (xz(p)[0] === 12 || xz(p)[0] === 15)), 'on the landing over the two outer top steps');
    const lamps = check.props({ rule, type: 'lamp' });
    check.equal(lamps.length, 2, 'a pair of lamps at the foot');
    check.ok(lamps.every((p) => xz(p)[1] === 14), 'on the ground before the bottom step');
    check.ok(!check.props({ rule }).some((p) => xz(p)[0] >= 24), 'none by the narrow flight');
  },
});
