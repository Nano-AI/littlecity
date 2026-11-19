// L28 · Children. A big square with its pigeons (L12), a hill to look out
// from, and enough houses that some of the residents are children.

import { scenario } from '@/scenario';

export default scenario({
  name: 'L28.children',
  seed: 48,
  about: 'A square and a viewpoint to fly kites from, pigeons to chase, and a town with children in it.',
  terrain(t) {
    t.flat(1);
    t.rect(26, 8, 32, 14, 3);
  },
  build(b) {
    b.plaza(12, 13, 19, 18);
    b.path(8, 20, 30, 20).path(15, 19, 15, 19);
    for (let i = 0; i < 6; i++) b.house(8 + i * 4, 21, { floors: 3, w: 3, color: i }); // 9 cells: 5 residents each
    b.path(25, 12, 25, 19).path(25, 11, 25, 11); // up to the hill by carved steps
    b.path(26, 11, 28, 11);
  },
  cameras: [
    { name: 'square', yaw: 45, pitch: 30, zoom: 3.4, target: [16, 1.5, 17] },
    { name: 'town', yaw: 45, pitch: 34, zoom: 2.2, target: [19, 1, 18] },
  ],
  expect(_plan, dressing, check) {
    const nav = dressing.nav;
    const play = check.sockets({ type: 'haunt-play' });
    check.ok(play.every((s) => nav.nodeAt.has(s.cell)), 'every place to play is on the walking graph');
    const kites = play.filter((s) => s.name === 'kite');
    check.equal(kites.filter((s) => s.cell >> 12 === 1).length, 1, 'kite spots on the square');
    check.ok(kites.some((s) => s.cell >> 12 === 3), 'a kite spot at the viewpoint');
    // Wherever a pigeon stands on a cell people can walk to, there is something to chase, and nowhere else.
    const birds = new Set(dressing.actors.filter((a) => a.type === 'pigeon' && a.at !== null && 'cell' in a.at && nav.nodeAt.has(a.at.cell)).map((a) => (a.at as { cell: number }).cell));
    const chase = play.filter((s) => s.name === 'pigeons').map((s) => s.cell);
    check.ok(birds.size > 0, 'the square has pigeons');
    check.equal(chase.filter((c) => !birds.has(c)).length, 0, 'chasing spots with no pigeon');
    check.ok([...birds].every((c) => chase.includes(c) || play.some((s) => s.cell === c)), 'every pigeon cell is somewhere to play');
    // About 15% are children, never the first of a household.
    const residents = dressing.actors.filter((a) => a.type === 'resident');
    const children = residents.filter((a) => a.variant === 'child');
    check.equal(residents.length, 30, 'residents');
    check.ok(children.length >= 2 && children.length <= 9, `some children (${children.length})`);
    check.ok(children.every((a) => (a.params as { index: number }).index > 0), 'the first of a household is grown up');
  },
});
