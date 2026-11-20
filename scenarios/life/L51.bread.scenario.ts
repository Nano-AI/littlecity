// L51 · Bread. A windmill at the west end of a street of cottages, a square
// at the east end with shops facing it (one of them the bakery), market
// stalls and an inn.
// The miller carries sacks from the mill to the bakery door, the baker trays
// of loaves to the stalls and the inn, residents walk home with a loaf.

import { scenario } from '@/scenario';

export default scenario({
  name: 'L51.bread',
  seed: 50,
  about: 'Mill, bakery, stalls and an inn on one street: the bread chain from end to end.',
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
    // The square, with shops along its north side facing it, two stalls, a well and the inn.
    b.plaza(31, 17, 36, 24);
    b.house(31, 15, { floors: 2, w: 2, d: 2, color: 1 }).house(34, 15, { floors: 2, w: 2, d: 2, color: 4 });
    b.put('stall', 33, 18).put('stall', 33, 23);
    b.put('fountain', 35, 21);
    b.house(37, 19, { floors: 2, w: 2, d: 3, color: 2 });
    // The mill at the west end of the street.
    b.path(5, 20, 7, 21);
    b.put('windmill', 4, 20).put('windmill', 4, 20);
  },
  cameras: [
    { name: 'street', yaw: 45, pitch: 34, zoom: 2.6, target: [20, 1, 21] },
    { name: 'square', yaw: 30, pitch: 32, zoom: 6, target: [33, 1, 20] },
  ],
  expect(_plan, dressing, check) {
    const posts = dressing.sockets.filter((s) => s.type === 'errand' && (s.name ?? '').startsWith('bread|'));
    const role = (r: string) => posts.filter((s) => s.name!.split('|')[1] === r);
    check.equal(role('bakery').length, 1, 'one bakery');
    check.equal(role('mill').length, 1, 'the mill');
    check.ok(role('sell').length >= 2, 'somewhere to sell the loaves');
    // Every post stands on the walking graph.
    for (const s of posts) check.ok(dressing.nav.nodeAt.has(s.cell), `${s.name} on the graph`);
    check.ok(role('sell').some((s) => s.name!.endsWith('|stall')), 'a stall sells them');
  },
});
