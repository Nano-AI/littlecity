// Fixture for U17 (drying green).
//   18 cells of grass shut in by the backs of two     washing lines on posts across it, a basket of
//   rows of cottages (streets in front of each row)   washing, a sheet spread on the grass
//   the same, fenced                                  not a drying green (fenced land is U14's)
//   a small yard behind two houses                    a back yard (U04), not a drying green

import { scenario } from '@/scenario';

function rows(b: Parameters<NonNullable<Parameters<typeof scenario>[0]['build']>>[0], x0: number): void {
  // Two rows of cottages, x0..x0+7, at z 10 and z 14, streets in front; the ends closed by a cottage each.
  b.path(x0, 9, x0 + 7, 9).path(x0, 15, x0 + 7, 15);
  for (let i = 0; i < 8; i++) b.house(x0 + i, 10, { color: i % 8 }).house(x0 + i, 14, { color: (i + 4) % 8 });
  for (const x of [x0, x0 + 7]) for (let z = 11; z <= 13; z++) b.house(x, z, { color: (x + z) % 8 });
}

export default scenario({
  name: 'U17.drying-green',
  seed: 1717,
  about: 'Grass shut in by the backs of three or more houses, too big for a back yard, unfenced and off every street, is a drying green: washing lines on posts, a basket, sheets bleaching on the grass.',
  build(b) {
    rows(b, 8);
    rows(b, 22);
    for (let x = 23; x <= 28; x++) b.fenceEdge(x, 11, 'N');
  },
  cameras: [
    { name: 'green', yaw: 30, pitch: 48, zoom: 5, target: [11.5, 1, 12] },
    { name: 'close', yaw: 20, pitch: 30, zoom: 8, target: [11.5, 1.2, 12] },
    { name: 'all', yaw: 30, pitch: 45, zoom: 2.6, target: [18, 1, 12] },
  ],
  expect(_plan, dressing, check) {
    const rule = 'U17.drying-green';
    const xz = (p: (typeof dressing.props)[number]): [number, number] => ('cell' in p.at ? [p.at.cell & 63, (p.at.cell >> 6) & 63] : [-1, -1]);
    const lines = check.hasProp({ rule, type: 'drying-line' }, 4).filter((p) => p.variant !== 'posts');
    check.ok(lines.length >= 2, 'two lines of washing or more, each with its posts');
    check.ok(lines.every((p) => xz(p)[0] >= 9 && xz(p)[0] <= 14), 'on the first green only');
    for (const l of lines) {
      check.ok(dressing.sockets.some((s) => s.owner === l.id && s.type === 'activity' && s.name === 'hang-washing'), 'a place to hang the washing');
      check.ok(dressing.sockets.some((s) => s.type === 'errand' && s.name === `laundry|line|${l.id}` && s.structure !== undefined), 'washing day (L60) knows the line and whose it is');
    }
    check.hasProp({ rule, type: 'basket' });
    check.hasProp({ rule, type: 'bleaching-sheet' });
    check.ok(!check.props({ rule }).some((p) => xz(p)[0] >= 22), 'the fenced one is not a drying green');
  },
});
