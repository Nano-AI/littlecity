// Fixture for U18 (orchard).
//   twelve trees on a 2-cell grid (4 × 3)         an orchard: mown grass between the rows, ladders
//                                                 and baskets of apples, beehives on the south edge
//   six trees in a single row, 2 apart            not an orchard (no 2 × 2)
//   a clump of touching trees                     not an orchard (a grove)

import { scenario } from '@/scenario';

export default scenario({
  name: 'U18.orchard',
  seed: 1818,
  about: 'Trees planted on a grid of spacing 2 (six or more, with a full 2 × 2) are an orchard: mown grass between the rows, ladders against the trees, baskets of apples, beehives.',
  build(b) {
    for (let x = 10; x <= 16; x += 2) for (let z = 10; z <= 14; z += 2) b.put('tree', x, z);
    for (let x = 22; x <= 32; x += 2) b.put('tree', x, 12);
    for (const [x, z] of [[12, 22], [13, 22], [12, 23], [14, 22], [13, 24], [14, 23]] as const) b.put('tree', x, z);
    b.house(20, 18, { color: 3 });
  },
  cameras: [
    { name: 'orchard', yaw: 35, pitch: 36, zoom: 5, target: [13, 1, 12] },
    { name: 'close', yaw: 30, pitch: 26, zoom: 9, target: [12, 1.3, 12] },
    { name: 'all', yaw: 30, pitch: 45, zoom: 2.4, target: [20, 1, 16] },
  ],
  expect(_plan, dressing, check) {
    const rule = 'U18.orchard';
    const xz = (p: (typeof dressing.props)[number]): [number, number] => ('cell' in p.at ? [p.at.cell & 63, (p.at.cell >> 6) & 63] : [-1, -1]);
    const mine = check.props({ rule });
    check.ok(mine.every((p) => xz(p)[0] >= 9 && xz(p)[0] <= 17 && xz(p)[1] >= 9 && xz(p)[1] <= 15), 'only in and round the grid');
    check.ok(check.props({ rule, type: 'sward' }).length >= 15, 'the grass between the rows is mown');
    const ladders = check.hasProp({ rule, type: 'ladder' });
    const baskets = check.hasProp({ rule, type: 'basket', variant: 'apples' });
    for (const p of [...ladders, ...baskets]) check.ok(dressing.sockets.some((s) => s.owner === p.id && s.type === 'activity'), 'a place to pick or gather');
    check.hasProp({ rule, type: 'beehive' });
  },
});
