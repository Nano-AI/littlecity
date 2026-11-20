// L52 · Water. A well on a small green among cottages, a tiered fountain in
// a square, and a birdbath (which nobody draws water from).

import { scenario } from '@/scenario';

export default scenario({
  name: 'L52.water',
  seed: 52,
  about: 'A well, a fountain and a birdbath among houses: residents fetch water from the first two.',
  terrain(t) {
    t.flat(1);
  },
  build(b) {
    b.path(10, 20, 30, 20);
    for (let i = 0; i < 5; i++) b.house(10 + i * 4, 17, { floors: 1, w: 2, d: 2, color: i });
    b.path(12, 19, 12, 19).path(16, 19, 16, 19).path(20, 19, 20, 19).path(24, 19, 24, 19).path(28, 19, 28, 19);
    b.put('fountain', 14, 22);
    b.plaza(26, 21, 30, 25);
    b.put('fountain', 28, 23);
    b.garden(18, 22, 21, 25);
    b.put('fountain', 19, 23);
  },
  cameras: [{ name: 'street', yaw: 45, pitch: 34, zoom: 3, target: [20, 1, 21] }],
  expect(plan, dressing, check) {
    const posts = dressing.sockets.filter((s) => s.type === 'errand' && (s.name ?? '').startsWith('water|'));
    check.ok(posts.length >= 2, 'posts beside the water');
    for (const s of posts) {
      check.ok(dressing.nav.nodeAt.has(s.cell), `${s.name} on the graph`);
      const role = s.structure !== undefined ? plan.roles.get(s.structure)?.role : undefined;
      check.ok(role === 'well' || role === 'basin' || role === 'tiered-fountain', `${s.name} at a well, basin or fountain, not ${role}`);
    }
  },
});
