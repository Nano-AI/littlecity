// Fixture for U20 (quay apron).
//   a quay along the shore, a street two cells inland,     the ground between is cobbled
//   bare ground between
//   further along, the same street by the sea with no      not cobbled: a beach, not a harbour
//   quay

import { scenario } from '@/scenario';

export default scenario({
  name: 'U20.quay-apron',
  seed: 2020,
  about: 'Bare ground between a street and a quay (or quay wall), within two of both, is cobbled as the working quay; a beach with no quay is left alone.',
  terrain(t) {
    t.flat(1);
    t.water(4, 24, 43, 43);
  },
  build(b) {
    b.path(6, 20, 38, 20);
    for (let x = 8; x <= 18; x++) b.block('dock', x, 0, 24).block('dock', x, 0, 25);
    for (const x of [9, 12, 15]) b.house(x, 18, { w: 2, floors: 2, color: x % 8 });
  },
  cameras: [
    { name: 'quay', yaw: 30, pitch: 34, zoom: 4.5, target: [13, 1, 22.5] },
    { name: 'all', yaw: 30, pitch: 40, zoom: 2.4, target: [22, 1, 21] },
  ],
  expect(_plan, dressing, check) {
    const rule = 'U20.quay-apron';
    const xz = (p: (typeof dressing.props)[number]): [number, number] => ('cell' in p.at ? [p.at.cell & 63, (p.at.cell >> 6) & 63] : [-1, -1]);
    const paving = check.props({ rule, type: 'paving' });
    for (let x = 9; x <= 17; x++) for (const z of [21, 22, 23]) check.ok(paving.some((p) => xz(p)[0] === x && xz(p)[1] === z), `cobbled at ${x},${z}`);
    check.ok(paving.every((p) => xz(p)[0] >= 6 && xz(p)[0] <= 20), 'only by the quay');
  },
});
