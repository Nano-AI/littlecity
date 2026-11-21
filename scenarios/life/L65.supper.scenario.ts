// L65 · A harvest supper. A square with houses round it: in autumn, late in
// the day, a long table goes down the middle of the square with lanterns over
// it, and the neighbours sit down to supper.
//
//   npm run shots -- L65.supper --season autumn --time dusk

import { scenario } from '@/scenario';

export default scenario({
  name: 'L65.supper',
  seed: 65,
  about: 'A square among houses: the harvest supper.',
  terrain(t) {
    t.flat(1);
  },
  build(b) {
    b.plaza(17, 18, 25, 22);
    for (let i = 0; i < 4; i++) b.house(16 + i * 3, 15, { w: 2, d: 2, floors: 2, color: (i * 3 + 2) % 8 });
    for (let i = 0; i < 4; i++) b.house(16 + i * 3, 24, { w: 2, d: 2, floors: 1, color: (i * 5 + 3) % 8 });
    b.path(16, 17, 26, 17).path(16, 23, 26, 23);
  },
  cameras: [
    { name: 'square', yaw: 25, pitch: 42, zoom: 4, target: [21.5, 1, 20.5] },
    { name: 'close', yaw: 25, pitch: 38, zoom: 8, target: [21.5, 1, 20.5] },
  ],
  expect(_plan, dressing, check) {
    const posts = dressing.sockets.filter((s) => s.type === 'errand' && (s.name ?? '').startsWith('supper|table|'));
    check.ok(posts.length >= 3, 'a row of table cells');
    check.ok(new Set(posts.map((s) => (s.cell >> 6) & 63)).size === 1 || new Set(posts.map((s) => s.cell & 63)).size === 1, 'in a straight line');
  },
});
