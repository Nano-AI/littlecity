// L53 · The catch comes in. A pier with a fisher at its end, a fish stall
// at its head on a little quayside square, and houses behind it: the fisher
// carries the catch up the pier to the stall, residents take fish home.

import { scenario } from '@/scenario';

export default scenario({
  name: 'L53.fish',
  seed: 53,
  about: 'A pier, a fish stall at its head and houses: the catch carried up and sold.',
  terrain(t) {
    t.flat(1);
    t.water(4, 30, 43, 43);
  },
  build(b) {
    for (let z = 30; z <= 33; z++) b.block('dock', 20, 0, z);
    b.plaza(17, 26, 23, 29);
    b.put('stall', 18, 29).put('stall', 22, 27);
    b.path(10, 20, 30, 20).path(20, 21, 20, 25);
    for (let i = 0; i < 5; i++) b.house(10 + i * 4, 17, { floors: 2, w: 2, d: 2, color: i });
    b.path(12, 19, 12, 19).path(16, 19, 16, 19).path(24, 19, 24, 19).path(28, 19, 28, 19);
  },
  cameras: [{ name: 'pier', yaw: 30, pitch: 34, zoom: 4, target: [20, 1, 28] }],
  expect(_plan, dressing, check) {
    const posts = dressing.sockets.filter((s) => s.type === 'errand' && (s.name ?? '').startsWith('fish|'));
    check.ok(posts.some((s) => s.name!.startsWith('fish|catch|')), 'the fisher’s spot is a post');
    check.ok(posts.some((s) => s.name!.startsWith('fish|sell|')), 'somewhere to sell the catch');
    for (const s of posts) check.ok(dressing.nav.nodeAt.has(s.cell), `${s.name} on the graph`);
  },
});
