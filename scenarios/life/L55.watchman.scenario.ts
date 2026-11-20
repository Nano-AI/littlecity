// L55 · The night watchman. Fourteen houses on a cross of two streets
// round a square, and no castle: at night a watchman walks the beat with a
// lantern. Watch it with `--time night`.

import { scenario } from '@/scenario';

export default scenario({
  name: 'L55.watchman',
  seed: 55,
  time: 'night',
  about: 'A town of fourteen houses round a square, no garrison: the watchman’s beat.',
  terrain(t) {
    t.flat(1);
  },
  build(b) {
    b.plaza(20, 20, 24, 24);
    b.path(8, 22, 19, 22).path(25, 22, 36, 22).path(22, 8, 22, 19).path(22, 25, 22, 36);
    for (let i = 0; i < 4; i++) {
      b.house(9 + i * 3, 19, { floors: 1, w: 2, d: 2, color: i });
      b.house(26 + i * 3, 23, { floors: 1, w: 2, d: 2, color: i + 4 });
    }
    for (let i = 0; i < 3; i++) {
      b.house(23, 9 + i * 3, { floors: 1, w: 2, d: 2, color: i });
      b.house(19, 26 + i * 3, { floors: 1, w: 2, d: 2, color: i + 2 });
    }
  },
  cameras: [{ name: 'town', yaw: 45, pitch: 40, zoom: 2.2, target: [22, 1, 22], time: 'night' }],
  expect(_plan, dressing, check) {
    const beats = dressing.sockets.filter((s) => s.type === 'errand' && (s.name ?? '').startsWith('watch|beat|'));
    check.ok(beats.length >= 3, `a beat of several posts (${beats.length})`);
    for (const s of beats) check.ok(dressing.nav.nodeAt.has(s.cell), `${s.name} on the graph`);
    check.equal(new Set(beats.map((s) => s.name)).size, beats.length, 'each post once, in order');
  },
});
