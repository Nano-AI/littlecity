// Fixture for D32 (under the trees):
//   fruit trees in garden plots              a swing on some of them
//   pairs of fruit trees two cells apart     a hammock slung between some
//   a park lawn of sixteen cells             a picnic on the grass, for some parks
//   a tree out on a street                   nothing: not a garden tree

import { scenario } from '@/scenario';

export default scenario({
  name: 'D32.under-the-trees',
  seed: 3232,
  about: 'Swings on garden trees, hammocks between garden trees two apart, picnics in parks; never on a walking line, never on a street tree.',
  build(b) {
    for (let i = 0; i < 6; i++) {
      const x = 7 + i * 5;
      b.garden(x, 8, x + 2, 10);
      b.put('tree', x, 9).put('tree', x + 2, 9);
    }
    for (let i = 0; i < 3; i++) {
      const x = 8 + i * 9;
      b.garden(x, 16, x + 3, 19);
      b.put('tree', x + 1, 17);
    }
    b.path(8, 26, 30, 26);
    b.put('tree', 15, 27);
  },
  cameras: [
    { name: 'gardens', yaw: 20, pitch: 36, zoom: 3, target: [20, 1.2, 12] },
    { name: 'close', yaw: 30, pitch: 26, zoom: 7, target: [28, 1.3, 9] },
    { name: 'swing', yaw: 200, pitch: 26, zoom: 8, target: [27, 1.3, 17] },
    { name: 'parks', yaw: 30, pitch: 36, zoom: 3.4, target: [20, 1, 18] },
  ],
  expect(_plan, dressing, check) {
    const mine = dressing.props.filter((p) => p.rule === 'D32.under-the-trees');
    check.ok(mine.some((p) => p.type === 'swing'), 'a swing on a garden tree');
    check.ok(mine.some((p) => p.type === 'hammock'), 'a hammock between two garden trees');
    check.ok(mine.some((p) => p.type === 'picnic'), 'a picnic in a park');
    check.ok(!mine.some((p) => 'cell' in p.at && ((p.at.cell >> 6) & 63) >= 25), 'nothing by the street tree');
    check.ok(mine.length <= 12, `restraint (${mine.length})`);
  },
});
