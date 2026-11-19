// Fixture for D23 (lighthouse base):
//   a lighthouse on the shore            a fog bell on the water side, rocks at the water's edge round it
//   a lighthouse inland                  a fog bell, no rocks
//   a lighthouse standing in the sea     nothing: no ground beside it

import { scenario } from '@/scenario';

export default scenario({
  name: 'D23.lighthouse-base',
  seed: 2323,
  about: 'A fog bell beside every lighthouse on land, on its water side; rocks at the water’s edge round one on the shore.',
  terrain(t) {
    t.flat(1);
    t.water(4, 18, 43, 43);
  },
  build(b) {
    b.stack('lighthouse', 12, 17, { floors: 5 });
    b.stack('lighthouse', 24, 8, { floors: 4 });
    for (let y = 0; y < 4; y++) b.block('lighthouse', 32, y, 24);
  },
  cameras: [
    { name: 'shore', yaw: 20, pitch: 26, zoom: 6, target: [12.5, 1.3, 17.5] },
    { name: 'inland', yaw: 30, pitch: 28, zoom: 6, target: [24.5, 1.3, 8.5] },
    { name: 'shore-back', yaw: 200, pitch: 30, zoom: 6, target: [12.5, 1.3, 17.5] },
  ],
  expect(_plan, dressing, check) {
    const mine = dressing.props.filter((p) => p.rule === 'D23.lighthouse-base');
    const near = (p: (typeof mine)[number], x: number, z: number): boolean => 'cell' in p.at && Math.abs((p.at.cell & 63) - x) + Math.abs(((p.at.cell >> 6) & 63) - z) <= 1;
    check.equal(mine.filter((p) => p.type === 'fog-bell').length, 2, 'a bell beside each lighthouse on land');
    const rocks = mine.filter((p) => p.type === 'boulder');
    check.ok(rocks.length >= 1 && rocks.every((p) => near(p, 12, 17)), `rocks round the shore lighthouse only (${rocks.length})`);
    check.ok(!mine.some((p) => near(p, 32, 24)), 'nothing round the one in the sea');
  },
});
