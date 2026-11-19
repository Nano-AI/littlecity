// Fixture for D30 (stair pots):
//   eight stairs climbing north onto a terrace beside a house wall on their west  pots on the wall side
//                                                                                 of some steps
//   a flight standing free on the grass                                           none: no wall to stand by

import { scenario } from '@/scenario';

export default scenario({
  name: 'D30.stair-pots',
  seed: 3031,
  about: 'Some stairs that climb along a wall have flower pots on their steps against it; free-standing stairs have none.',
  build(b) {
    for (let i = 0; i < 8; i++) {
      const x = 8 + i * 4;
      b.house(x, 10, { d: 3, floors: 2, color: i % 8 });
      b.put('marble', x + 1, 10);
      b.block('stairs', x + 1, 1, 11, { rot: 0 });
    }
    b.put('marble', 20, 20);
    b.block('stairs', 20, 1, 21, { rot: 0 });
  },
  cameras: [
    { name: 'flights', yaw: 20, pitch: 34, zoom: 3, target: [22, 1.2, 11] },
    { name: 'close', yaw: 20, pitch: 26, zoom: 8, target: [13, 1.2, 11] },
  ],
  expect(_plan, dressing, check) {
    const pots = dressing.props.filter((p) => p.type === 'stair-pots');
    check.ok(pots.length >= 1 && pots.length <= 6, `some flights have pots (${pots.length})`);
    for (const p of pots) check.equal((p.params as { side: number }).side, 1, 'on the wall side (west: the frame’s +X when climbing north)');
    check.ok(!pots.some((p) => 'cell' in p.at && (p.at.cell & 63) === 20), 'none on a free-standing flight');
  },
});
