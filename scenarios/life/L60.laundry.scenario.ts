// L60 · Washing day. A narrow lane between two rows of tall houses, where
// the washing hangs across from window to window (D05): it goes out in the
// morning, comes in at dusk and when it rains.

import { scenario } from '@/scenario';

export default scenario({
  name: 'L60.laundry',
  seed: 60,
  about: 'A narrow lane of tall houses with washing lines across it.',
  terrain(t) {
    t.flat(1);
  },
  build(b) {
    b.path(10, 19, 30, 19);
    for (let i = 0; i < 6; i++) {
      b.house(10 + i * 3, 17, { floors: 3, w: 2, d: 2, color: i });
      b.house(10 + i * 3, 20, { floors: 3, w: 2, d: 2, color: (i + 4) % 8 });
    }
  },
  cameras: [{ name: 'lane', yaw: 60, pitch: 40, zoom: 5, target: [20, 2, 19] }],
  expect(_plan, dressing, check) {
    const lines = dressing.props.filter((p) => p.type === 'laundry-line');
    const posts = dressing.sockets.filter((s) => s.type === 'errand' && (s.name ?? '').startsWith('laundry|line|'));
    check.ok(lines.length >= 1, `washing lines over the lane (${lines.length})`);
    check.equal(posts.length, lines.length, 'a post under every line');
    for (const s of posts) check.ok(dressing.nav.nodeAt.has(s.cell) && s.structure !== undefined, `${s.name} on the graph, with its house`);
  },
});
