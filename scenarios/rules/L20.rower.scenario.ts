// Fixture for L20 (the rower: any two docks joined by water, nearest pairs
// first). Three piers out into the bay, from the west:
//   at x 24 and x 30   the nearest pair (6 apart): a rower between them
//   at x 10            left over: both others are taken

import { scenario } from '@/scenario';

export default scenario({
  name: 'L20.rower',
  seed: 220,
  about: 'The two nearest piers share a rower that crosses between them through open water; the third, left over, gets none.',
  terrain(t) {
    t.flat(1);
    t.water(4, 30, 43, 43);
  },
  build(b) {
    for (const x of [10, 24, 30]) for (let z = 30; z <= 33; z++) b.block('dock', x, 0, z);
    b.path(8, 28, 32, 28).path(10, 29).path(24, 29).path(30, 29);
    b.house(14, 25, { w: 2, d: 2, color: 3 });
    b.house(26, 25, { w: 2, d: 2, color: 5 });
  },
  cameras: [
    { name: 'bay', yaw: 30, pitch: 36, zoom: 2.6, target: [19, 0.5, 33] },
    { name: 'close', yaw: 20, pitch: 30, zoom: 5, target: [11, 0.5, 34] },
  ],
  expect(_plan, dressing, check) {
    const rowers = dressing.actors.filter((a) => a.type === 'rower');
    check.equal(rowers.length, 1, 'one rower, between the piers at x 24 and x 30');
    const p = rowers[0]?.params as { ax: number; az: number; bx: number; bz: number } | undefined;
    check.ok(p !== undefined && Math.floor(p.ax) === 24 && Math.floor(p.bx) === 30, `it waits off the ends of the piers at x 24 and x 30 (got ${JSON.stringify(p)})`);
    check.ok(p !== undefined && p.az > 33 && p.bz > 33, 'its waiting places are out beyond the pier ends');
  },
});
