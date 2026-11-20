// L58 · Trade from the quay. A quay long enough for a ship, a waterfront
// street of shops behind it and a square with a market stall: ships land
// goods on the quay, carters wheel them up to the shops and the stall.
//
//   node src/life/testing/sequence.mjs L58.trade --warm 90000 --zoom 5 --target 23,1,25 --frames 12 --every 5000

import { scenario } from '@/scenario';

export default scenario({
  name: 'L58.trade',
  seed: 5801,
  about: 'A quay, shops and a stall: goods landed by the ships are wheeled into town.',
  terrain(t) {
    t.flat(0);
    t.rect(12, 10, 36, 26, 1);
  },
  build(b) {
    for (let x = 16; x <= 31; x++) b.block('dock', x, 0, 27);
    b.path(14, 26, 33, 26);
    for (let i = 0; i < 5; i++) b.house(15 + i * 4, 23, { floors: 2, w: 2, color: (i * 2 + 1) % 8 });
    b.path(17, 24, 17, 25).path(21, 24, 21, 25).path(25, 24, 25, 25).path(29, 24, 29, 25);
    b.plaza(14, 18, 19, 22);
    b.put('stall', 15, 19).put('stall', 18, 21);
    for (let i = 0; i < 4; i++) b.house(21 + i * 3, 18, { floors: 1, w: 2, d: 2, color: i + 2 });
  },
  cameras: [
    { name: 'harbour', yaw: 40, pitch: 32, zoom: 3, target: [23, 1, 25] },
    { name: 'quay', yaw: 30, pitch: 34, zoom: 6, target: [23, 1, 26] },
  ],
  expect(plan, dressing, check) {
    const posts = dressing.sockets.filter((s) => s.type === 'errand' && (s.name ?? '').startsWith('trade|to|'));
    check.ok(posts.length >= 2, `places that take the goods (${posts.length})`);
    for (const s of posts) {
      const role = s.structure !== undefined ? plan.roles.get(s.structure)?.role : undefined;
      check.ok(role === 'shop' || role === 'inn' || role === 'market-stall', `${s.name} at a shop, inn or stall (${role})`);
    }
  },
});
