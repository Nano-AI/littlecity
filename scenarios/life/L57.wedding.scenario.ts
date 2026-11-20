// L57 · A wedding at the chapel. A chapel with its steeple on a street that
// runs to a little square, and houses for the guests. In the morning a
// couple goes in, guests gather at the door, the couple comes out to bells
// and petals and everybody walks to the square.

import { scenario } from '@/scenario';

export default scenario({
  name: 'L57.wedding',
  seed: 57,
  about: 'A chapel, a street to a square, and neighbours: the wedding.',
  terrain(t) {
    t.flat(1);
  },
  build(b) {
    b.house(16, 16, { floors: 1, w: 2, d: 2, color: 5 });
    b.tower(18, 16, { floors: 4 });
    b.path(14, 18, 30, 18);
    b.plaza(24, 19, 28, 23);
    for (let i = 0; i < 4; i++) {
      b.house(13 + i * 4, 20, { floors: 2, w: 2, d: 2, color: i });
      b.house(21 + i * 3, 14, { floors: 1, w: 2, d: 2, color: i + 4 });
    }
    b.path(14, 19, 14, 19).path(18, 19, 18, 19).path(22, 17, 22, 17).path(25, 17, 25, 17).path(28, 17, 28, 17);
  },
  cameras: [{ name: 'chapel', yaw: 30, pitch: 34, zoom: 4.5, target: [20, 1, 19] }],
  expect(plan, dressing, check) {
    const posts = dressing.sockets.filter((s) => s.type === 'errand' && (s.name ?? '').startsWith('wedding|'));
    const door = posts.find((s) => s.name === 'wedding|door|');
    check.ok(door !== undefined, 'a post at the chapel door');
    check.ok(door?.structure !== undefined && plan.roles.get(door.structure)?.role === 'chapel', 'the door is the chapel’s');
    check.ok(posts.some((s) => s.name === 'wedding|square|'), 'somewhere for the procession to go');
  },
});
