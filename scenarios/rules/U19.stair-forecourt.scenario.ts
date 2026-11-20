// Fixture for U19 (forecourt at the foot of grand steps).
//   a grand stair 4 wide down onto grass, a street 4 cells ahead     a paved forecourt the flight's width
//                                                                    and 2 deep, and paving on to the street
//   a grand stair 3 wide down onto a plaza                           nothing: it is paved already

import { scenario } from '@/scenario';

function terrace(b: Parameters<NonNullable<Parameters<typeof scenario>[0]['build']>>[0], x0: number, x1: number, s0: number, s1: number): void {
  for (let x = x0; x <= x1; x++) for (let z = 10; z <= 11; z++) b.stack('marble', x, z, { floors: 3, color: 0 });
  for (let x = s0; x <= s1; x++) {
    b.stack('marble', x, 12, { floors: 2, color: 0 });
    b.put('marble', x, 13, { color: 0 });
  }
}

export default scenario({
  name: 'U19.stair-forecourt',
  seed: 1919,
  about: 'The foot of a flight of grand steps lands on a paved forecourt the width of the flight and two deep, and the paving runs on to a street straight ahead.',
  build(b) {
    terrace(b, 8, 15, 10, 13);
    b.path(6, 18, 17, 18);
    terrace(b, 24, 31, 26, 28);
    b.plaza(24, 14, 31, 16);
  },
  cameras: [
    { name: 'forecourt', yaw: 30, pitch: 34, zoom: 5, target: [11.5, 1.5, 14.5] },
    { name: 'all', yaw: 30, pitch: 40, zoom: 2.6, target: [20, 2, 14] },
  ],
  expect(_plan, dressing, check) {
    const rule = 'U19.stair-forecourt';
    const xz = (p: (typeof dressing.props)[number]): [number, number] => ('cell' in p.at ? [p.at.cell & 63, (p.at.cell >> 6) & 63] : [-1, -1]);
    const paving = check.props({ rule, type: 'paving' });
    for (let x = 10; x <= 13; x++) for (const z of [14, 15, 16, 17]) check.ok(paving.some((p) => xz(p)[0] === x && xz(p)[1] === z), `paved at ${x},${z}`);
    check.ok(paving.every((p) => xz(p)[0] >= 10 && xz(p)[0] <= 13), 'the width of the flight');
    check.ok(!paving.some((p) => xz(p)[0] >= 24), 'nothing on the plaza');
  },
});
