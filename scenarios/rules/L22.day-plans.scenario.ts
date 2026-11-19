// L22 · Day plans. Destinations among what the town actually has: every
// kind of haunt in one small town, each on a cell of the walking graph.

import { scenario } from '@/scenario';

export default scenario({
  name: 'L22.day-plans',
  seed: 42,
  about: 'A square with a fountain and a stall, a garden, a pier, houses and a hill: one of every kind of place a resident goes.',
  terrain(t) {
    t.flat(1);
    t.water(4, 30, 43, 43);
    t.rect(26, 8, 34, 14, 4); // a hill with a cliff
  },
  build(b) {
    b.plaza(12, 14, 17, 18);
    b.put('fountain', 14, 16);
    b.put('stall', 17, 18);
    b.garden(20, 14, 22, 16);
    b.path(8, 20, 24, 20).path(14, 19, 14, 19).path(14, 21, 14, 29);
    for (let z = 30; z <= 33; z++) b.block('dock', 14, 0, z);
    b.house(9, 21, { floors: 2, w: 2, color: 1 });
    b.house(17, 21, { floors: 2, w: 2, color: 4 });
    b.house(21, 21, { floors: 1, w: 2, color: 6 });
    b.put('tree', 12, 14);
  },
  cameras: [
    { name: 'town', yaw: 45, pitch: 34, zoom: 2.6, target: [17, 1, 20] },
    { name: 'square', yaw: 30, pitch: 30, zoom: 5, target: [15, 1, 17] },
  ],
  expect(plan, dressing, check) {
    const nav = dressing.nav;
    const haunts = dressing.sockets.filter((s) => s.type.startsWith('haunt-'));
    check.ok(haunts.every((s) => nav.nodeAt.has(s.cell)), 'every haunt is a cell people can walk to');
    for (const type of ['haunt-square', 'haunt-garden', 'haunt-fountain', 'haunt-pier', 'haunt-visit', 'haunt-viewpoint'] as const) {
      check.hasSocket({ type });
    }
    // Beside the fountain, facing it; never in its cell, nor in the tree's.
    for (const s of check.sockets({ type: 'haunt-fountain' })) check.ok(s.structure === check.structure(14, 1, 16).id, 'belongs to the fountain');
    check.equal(check.sockets({ type: 'haunt-square', at: [14, 1, 16] }).length, 0, 'not in the fountain');
    check.equal(check.sockets({ type: 'haunt-square', at: [12, 1, 14] }).length, 0, 'not in the tree');
    // The stall's customer stands at its counter.
    check.ok(check.sockets({ type: 'haunt-shop' }).some((s) => s.structure === check.structure(17, 1, 18).id), 'a customer at the stall');
    // The end of the pier, looking out to sea.
    check.hasSocket({ type: 'haunt-pier', at: [14, 1, 33], dir: 2 });
    // One house to visit per house with a door.
    check.equal(check.sockets({ type: 'haunt-visit' }).length, 3, 'three houses to call at');
    // The viewpoint is on the hill, at its edge.
    check.ok(check.sockets({ type: 'haunt-viewpoint' }).every((s) => s.cell >> 12 === 4), 'viewpoints are on the hill top');
    check.ok(plan.world.floors.size > 30, 'the town was built');
  },
});
