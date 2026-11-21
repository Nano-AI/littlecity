// L66 · A picnic. A street of houses beside a green with a few trees: in
// spring, families carry blankets and baskets out onto the grass, spread
// them under the trees and sit round them while the children chase about.
//
//   npm run shots -- L66.picnic --season spring

import { scenario } from '@/scenario';

export default scenario({
  name: 'L66.picnic',
  seed: 66,
  about: 'Houses beside a green with trees: picnics.',
  terrain(t) {
    t.flat(1);
  },
  build(b) {
    b.path(12, 17, 31, 17);
    for (let i = 0; i < 5; i++) b.house(13 + i * 4, 14, { w: 2, d: 3, floors: 2, color: (i * 3 + 1) % 8 });
    for (const [x, z] of [[16, 21], [22, 22], [27, 20], [19, 25], [25, 25]] as const) b.put('tree', x, z);
  },
  cameras: [
    { name: 'green', yaw: 25, pitch: 42, zoom: 3.6, target: [21.5, 1, 21] },
    { name: 'close', yaw: 25, pitch: 38, zoom: 7, target: [21, 1, 21] },
  ],
  expect(_plan, dressing, check) {
    const posts = dressing.sockets.filter((s) => s.type === 'errand' && (s.name ?? '').startsWith('picnic|spot|'));
    check.ok(posts.length >= 2, 'spots for blankets on the green');
  },
});
