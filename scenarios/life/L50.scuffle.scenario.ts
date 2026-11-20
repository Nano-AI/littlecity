// L50 · The street scuffle. A busy high street two cells wide, lined with
// houses on both sides, running into a square with an inn on it, so that
// walkers meet head on all day. The scuffle itself is a run-time reaction
// (no rule): src/life/people/scuffle.test.ts forces one here, and
//   node src/life/testing/sequence.mjs L50.scuffle --aim '(c => { const s = c.scuffles.provoke(); return s ? [s.x, s.y, s.z] : [20, 1, 20]; })(window.__lcPeople)' --zoom 9 --frames 16 --every 600
// watches it.

import { scenario } from '@/scenario';

export default scenario({
  name: 'L50.scuffle',
  seed: 50,
  about: 'A busy two-wide high street into a square with an inn: walkers bump into each other here.',
  terrain(t) {
    t.flat(1);
  },
  build(b) {
    b.path(8, 20, 30, 21);
    for (let i = 0; i < 7; i++) {
      b.house(8 + i * 3, 18, { floors: 2, w: 2, d: 1, color: i });
      b.house(8 + i * 3, 23, { floors: 2, w: 2, d: 1, color: (i + 3) % 8 });
      b.path(10 + i * 3, 18, 10 + i * 3, 19).path(10 + i * 3, 22, 10 + i * 3, 23);
    }
    // The square at the end, with its inn (a big house on a square) and a fountain.
    b.plaza(31, 17, 36, 24);
    b.put('fountain', 34, 20);
    b.house(37, 19, { floors: 2, w: 2, d: 3, color: 2 });
  },
  cameras: [
    { name: 'street', yaw: 45, pitch: 34, zoom: 3.2, target: [22, 1, 21] },
    { name: 'close', yaw: 30, pitch: 30, zoom: 7, target: [20, 1, 21] },
  ],
  expect(_plan, dressing, check) {
    // The street is walkable both ways, two wide, and there are people to walk it.
    check.hasActor({ type: 'resident' }, 20);
    check.ok(dressing.nav.nodes.filter((n) => n.surface === 'path').length >= 40, 'a long two-wide street');
  },
});
