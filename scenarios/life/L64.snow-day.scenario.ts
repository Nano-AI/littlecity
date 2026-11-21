// L64 · A snow day. A square with family houses round it: once snow lies
// deep, the children come out, build a snowman in the middle of the square
// and have a snowball fight round it.
//
//   npm run shots -- L64.snow-day --season winter --weather snow --settle

import { scenario } from '@/scenario';

export default scenario({
  name: 'L64.snow-day',
  seed: 64,
  about: 'A square among houses: the snow day.',
  terrain(t) {
    t.flat(1);
  },
  build(b) {
    b.plaza(17, 18, 25, 22);
    for (let i = 0; i < 4; i++) b.house(16 + i * 3, 15, { w: 2, d: 2, floors: 2, color: (i * 3) % 8 });
    for (let i = 0; i < 4; i++) b.house(16 + i * 3, 24, { w: 2, d: 2, floors: 1, color: (i * 5 + 1) % 8 });
    b.path(16, 17, 26, 17).path(16, 23, 26, 23);
  },
  cameras: [
    { name: 'square', yaw: 25, pitch: 42, zoom: 4, target: [21.5, 1, 20.5] },
    { name: 'close', yaw: 25, pitch: 38, zoom: 8, target: [21.5, 1, 20.5] },
  ],
  expect(_plan, dressing, check) {
    const posts = dressing.sockets.filter((s) => s.type === 'errand' && (s.name ?? '').startsWith('snow|'));
    check.ok(posts.some((s) => s.name === 'snow|man|'), 'a place for the snowman');
    check.ok(posts.filter((s) => s.name?.startsWith('snow|side|')).length === 2, 'two sides for the fight');
  },
});
