// L63 · A beach day. A street of family houses above a strip of sand by the
// sea: in summer, in fair weather, families come down with parasols,
// deckchairs, baskets, pails and a ball, set up along the shore and spend the
// day there; then they pack up and walk home.

import { scenario } from '@/scenario';

export default scenario({
  name: 'L63.beach',
  seed: 63,
  about: 'Houses above a beach: the beach day.',
  terrain(t) {
    t.flat(1);
    // The sea to the south: the row at z = 20 is sand.
    t.water(4, 21, 43, 43);
  },
  build(b) {
    b.path(12, 17, 31, 17);
    for (let i = 0; i < 5; i++) b.house(13 + i * 4, 14, { w: 2, d: 3, floors: 2, color: (i * 3) % 8 });
    b.house(12, 10, { w: 2, d: 2, floors: 1, color: 6 }).house(17, 10, { w: 2, d: 2, floors: 1, color: 2 }).house(22, 10, { w: 2, d: 2, floors: 1, color: 4 });
    b.path(12, 12, 23, 12).path(11, 12, 11, 17);
  },
  cameras: [
    { name: 'beach', yaw: 20, pitch: 40, zoom: 3.2, target: [21, 1, 19] },
    { name: 'close', yaw: 20, pitch: 36, zoom: 7, target: [20.5, 1, 20] },
    { name: 'town', yaw: 45, pitch: 35, zoom: 1.8, target: [22, 1, 18] },
  ],
  expect(_plan, dressing, check) {
    const pitches = dressing.sockets.filter((s) => s.type === 'errand' && (s.name ?? '').startsWith('beach|pitch|'));
    check.ok(pitches.length >= 4, 'pitches along the sand');
    check.ok(pitches.every((s) => s.dir === 2), 'every pitch faces the sea (south)');
    check.ok(dressing.sockets.some((s) => s.type === 'errand' && s.name === 'beach|back|0'), 'a place behind the beach');
  },
});
