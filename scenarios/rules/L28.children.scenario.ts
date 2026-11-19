// L28 · Children. A big square, a hill to look out from, pigeons (from a
// rule of this scenario's own: L12 is the Animation owner's) and enough
// houses that some of the residents are children.

import { key } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { scenario } from '@/scenario';

const PIGEONS: readonly [number, number][] = [[13, 15], [16, 17], [18, 14]];

const pigeons = defineRule({
  id: 'X-L28.pigeons',
  part: 'life',
  tier: 1,
  priority: 900,
  about: 'Fixture only: three pigeons on the square.',
  find: () => PIGEONS.map(([x, z]) => ({ anchor: key(x, 1, z) })),
  apply(c, out) {
    out.actor({ type: 'pigeon', at: { cell: c.anchor, pos: 'c' }, params: { index: 0 } });
  },
});

export default scenario({
  name: 'L28.children',
  seed: 48,
  about: 'A square and a viewpoint to fly kites from, pigeons to chase, and a town with children in it.',
  rules: [pigeons],
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
    check.equal(play.filter((s) => s.name === 'pigeons').length, 3, 'pigeons to chase');
    for (const [x, z] of PIGEONS) check.hasSocket({ type: 'haunt-play', at: [x, 1, z] });
    // About 15% are children, never the first of a household.
    const residents = dressing.actors.filter((a) => a.type === 'resident');
    const children = residents.filter((a) => a.variant === 'child');
    check.equal(residents.length, 30, 'residents');
    check.ok(children.length >= 2 && children.length <= 9, `some children (${children.length})`);
    check.ok(children.every((a) => (a.params as { index: number }).index > 0), 'the first of a household is grown up');
  },
});
