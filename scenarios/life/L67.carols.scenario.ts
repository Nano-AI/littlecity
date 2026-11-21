// L67 · Carol singers. A street of houses round a little square: in winter, at
// dusk, a band of singers with lanterns goes from door to door, and whoever
// is at home comes out to listen.
//
//   npm run shots -- L67.carols --season winter --time dusk

import { scenario } from '@/scenario';

export default scenario({
  name: 'L67.carols',
  seed: 67,
  about: 'Houses round a little square: carol singers at dusk.',
  terrain(t) {
    t.flat(1);
  },
  build(b) {
    b.plaza(19, 18, 23, 20);
    b.path(14, 17, 28, 17).path(14, 21, 28, 21);
    for (let i = 0; i < 4; i++) b.house(14 + i * 4, 14, { w: 2, d: 3, floors: 2, color: (i * 3) % 8 });
    for (let i = 0; i < 4; i++) b.house(14 + i * 4, 22, { w: 2, d: 2, floors: 1, color: (i * 5 + 2) % 8 });
  },
  cameras: [
    { name: 'street', yaw: 25, pitch: 42, zoom: 3.6, target: [21, 1, 19] },
    { name: 'close', yaw: 25, pitch: 38, zoom: 7, target: [19, 1, 18] },
  ],
  expect(_plan, dressing, check) {
    const posts = dressing.sockets.filter((s) => s.type === 'errand' && (s.name ?? '').startsWith('carol|door|'));
    check.ok(posts.length >= 4, 'a round of doors');
    check.ok(posts.every((s) => s.structure !== undefined), 'each the door of a house');
  },
});
