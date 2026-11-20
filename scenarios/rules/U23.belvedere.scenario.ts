// Fixture for U23 (belvedere garden on a bare podium).
//   a bare marble podium 5 × 5, two storeys      potted citrus trees, a pergola at the middle, benches
//                                                looking out
//   a podium 2 × 2, two storeys                  too small: nothing
//   a podium 4 × 4, one storey                   too low: nothing
//   a podium 5 × 5 with a garden laid on top     the player is furnishing it: nothing

import { scenario } from '@/scenario';

export default scenario({
  name: 'U23.belvedere',
  seed: 2323,
  about: 'A bare marble terrace with nine or more top cells, two or more storeys up, becomes a belvedere garden: citrus trees in pots, a pergola, benches looking out.',
  build(b) {
    b.fill('marble', 10, 10, 14, 14, { floors: 2, color: 2 });
    b.fill('marble', 20, 10, 21, 11, { floors: 2, color: 2 });
    b.fill('marble', 26, 10, 29, 13, { floors: 1, color: 2 });
    b.fill('marble', 10, 20, 14, 24, { floors: 2, color: 1 });
    b.edit({ type: 'placeFloor', cell: b.cell(12, 3, 22), floor: 'garden' });
  },
  cameras: [
    { name: 'belvedere', yaw: 30, pitch: 40, zoom: 5, target: [12, 2.5, 12] },
    { name: 'all', yaw: 30, pitch: 45, zoom: 2.4, target: [20, 1.5, 16] },
  ],
  expect(_plan, dressing, check) {
    const rule = 'U23.belvedere';
    const xz = (p: (typeof dressing.props)[number]): [number, number] => ('cell' in p.at ? [p.at.cell & 63, (p.at.cell >> 6) & 63] : [-1, -1]);
    const mine = check.props({ rule });
    check.equal(check.props({ rule, type: 'pergola' }).length, 1, 'one pergola');
    check.ok(check.props({ rule, type: 'citrus-pot' }).length >= 4, 'citrus trees in pots');
    check.ok(check.props({ rule, type: 'bench' }).length >= 2, 'benches looking out');
    check.ok(mine.every((p) => xz(p)[0] >= 10 && xz(p)[0] <= 14 && xz(p)[1] >= 10 && xz(p)[1] <= 14), 'only on the bare podium');
  },
});
