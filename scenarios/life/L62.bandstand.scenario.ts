// L62 · A band at the bandstand. A square with a bandstand on it (R-M11)
// and houses round it: now and then a band plays at the bandstand's foot and
// the neighbours stand round listening, some clapping.

import { scenario } from '@/scenario';

export default scenario({
  name: 'L62.bandstand',
  seed: 6211,
  about: 'A bandstand on a square among houses: the band and its listeners.',
  build(b) {
    b.plaza(8, 8, 18, 16);
    for (const x of [12, 13]) for (const z of [11, 12]) b.stack('pillar', x, z, { floors: 2 });
    for (const x of [12, 13]) for (const z of [11, 12]) b.block('marble', x, 3, z, { color: 2 });
    for (let i = 0; i < 4; i++) {
      b.house(8 + i * 3, 5, { floors: 2, w: 2, d: 2, color: i });
      b.house(8 + i * 3, 18, { floors: 2, w: 2, d: 2, color: i + 4 });
      b.path(9 + i * 3, 7, 9 + i * 3, 7).path(9 + i * 3, 17, 9 + i * 3, 17);
    }
  },
  cameras: [{ name: 'square', yaw: 35, pitch: 32, zoom: 3.4, target: [13, 1.5, 12] }],
  expect(plan, dressing, check) {
    check.role(12, 3, 11, 'bandstand');
    const posts = dressing.sockets.filter((s) => s.type === 'errand' && (s.name ?? '').startsWith('show|'));
    check.ok(posts.some((s) => s.name!.startsWith('show|stage|')), 'where the band plays');
    check.ok(posts.filter((s) => s.name!.startsWith('show|seat|')).length >= 3, 'room to listen');
    void plan;
  },
});
