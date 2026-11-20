// L56 · Market day. A square of six by six with two stalls on it and houses
// round it: on market mornings traders set up stalls on it, a busker juggles
// in the middle, and the town comes to buy.

import { scenario } from '@/scenario';

export default scenario({
  name: 'L56.market-day',
  seed: 56,
  about: 'A square with two stalls among houses: the market on market days.',
  terrain(t) {
    t.flat(1);
  },
  build(b) {
    b.plaza(18, 18, 23, 23);
    b.put('stall', 18, 18).put('stall', 23, 23);
    for (let i = 0; i < 3; i++) {
      b.house(17 + i * 3, 15, { floors: 2, w: 2, d: 2, color: i });
      b.house(17 + i * 3, 25, { floors: 2, w: 2, d: 2, color: i + 3 });
      b.house(14, 17 + i * 3, { floors: 1, w: 2, d: 2, color: i + 5 });
    }
    b.path(18, 17, 26, 17).path(18, 24, 26, 24).path(16, 18, 17, 23);
  },
  cameras: [{ name: 'square', yaw: 45, pitch: 36, zoom: 4.2, target: [20.5, 1, 20.5] }],
  expect(_plan, dressing, check) {
    const posts = dressing.sockets.filter((s) => s.type === 'errand' && (s.name ?? '').startsWith('market|'));
    const pitches = posts.filter((s) => s.name!.startsWith('market|pitch|'));
    check.ok(pitches.length >= 2, `pitches on the square (${pitches.length})`);
    check.ok(posts.some((s) => s.name!.startsWith('market|busk|')), 'a spot for the busker');
    for (const s of pitches) check.ok(s.dir !== undefined && dressing.nav.nodeAt.has(s.cell), `${s.name} faces somewhere and is on the graph`);
  },
});
