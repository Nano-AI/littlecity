// Fixture for D34 (lost kite). A town whose seed is one of the one in ten
// that lost a kite, with trees of several kinds and heights:
//   a pine on a hill (the tallest crown)   the kite, caught in it
//   every other tree                       nothing

import { scenario } from '@/scenario';

export default scenario({
  name: 'D34.lost-kite',
  seed: 3434,
  about: 'In one town in ten, a kite is caught in the crown of the tallest tree.',
  terrain(t) {
    t.flat(1);
    t.rect(19, 9, 25, 15, 2);
    t.rect(20, 10, 24, 14, 3);
    t.rect(21, 11, 23, 13, 4);
  },
  build(b) {
    for (const [x, z] of [[8, 8], [10, 12], [14, 9], [12, 16]] as const) b.put('tree', x, z);
    b.put('tree', 22, 12);
    b.garden(28, 10, 29, 11).put('tree', 28, 10);
  },
  cameras: [
    { name: 'kite', yaw: 30, pitch: 22, zoom: 8, target: [22.5, 4.2, 12.5] },
    { name: 'all', yaw: 30, pitch: 34, zoom: 3, target: [18, 1.5, 12] },
  ],
  expect(_plan, dressing, check) {
    const kites = dressing.props.filter((p) => p.type === 'kite');
    check.equal(kites.length, 1, 'one kite');
    const at = kites[0]?.at;
    check.ok(!!at && 'cell' in at && (at.cell & 63) === 22 && ((at.cell >> 6) & 63) === 12, 'in the tree on the hill');
  },
});
