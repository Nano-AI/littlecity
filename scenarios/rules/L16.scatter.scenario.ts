// L16 Scatter: any bird within 3 cells of a landing block takes off.
// This is the stage for it: a quayside square with its pigeons, gulls with
// perches on the piles and the crane, and a tower for the swifts, with free
// ground between them to build on. The scatter itself only exists in motion:
//
//   node src/life/testing/sequence.mjs L16.scatter --edit 'place:house@21,1,22' --frames 16 --every 400 --name scatter --zoom 5 --target 22,1,23
//
// The pigeons within three cells burst up at once, the rest of the flock a
// beat later; they wheel over the square and are down again in five seconds.
// A gull sitting within three cells goes up too. Stepped and measured in
// src/life/birds/birds.test.ts.

import { key, keyX, keyZ } from '@/core/grid';
import { scenario } from '@/scenario';

export default scenario({
  name: 'L16.scatter',
  seed: 1607,
  about: 'A quayside square: pigeons, gulls and swifts with room to drop a block among them.',
  terrain(t) {
    t.flat(1);
    t.water(4, 27, 43, 43);
  },
  build(b) {
    b.plaza(20, 21, 25, 25);
    b.put('fountain', 24, 24);
    for (let x = 19; x <= 27; x++) b.block('dock', x, 0, 27); // the quay
    for (let z = 28; z <= 31; z++) b.block('dock', 23, 0, z); // a pier off it
    b.path(14, 26, 30, 26);
    b.tower(27, 22, { floors: 5 });
    b.house(17, 22, { floors: 2, w: 2, color: 4 });
    b.house(22, 19, { floors: 1, w: 2, color: 0 });
  },
  cameras: [
    { name: 'square', yaw: 45, pitch: 34, zoom: 4.2, target: [23, 1, 25] },
    { name: 'from-sea', yaw: 205, pitch: 30, zoom: 4.2, target: [23, 1, 25] },
  ],
  expect(plan, _dressing, check) {
    check.equal(check.actors({ type: 'pigeon' }).length, 10, 'pigeons: 30 plaza cells ÷ 3');
    check.equal(check.actors({ type: 'gull' }).length, 4, 'gulls: 1 + 13 waterfront dock cells ÷ 4');
    check.equal(check.actors({ type: 'swift' }).length, 3, 'swifts: a tower of 5, and 17 cells of street');
    // Room to build among them: (21, 22) is empty plaza with pigeons within three cells.
    check.ok(!plan.kinds.has(key(21, 1, 22)) && plan.world.floors.get(key(21, 1, 22)) === 'plaza', 'free plaza to drop a block on');
    const near = check.actors({ type: 'pigeon' }).filter((p) => {
      const c = (p.at as { cell: number }).cell;
      return Math.hypot(keyX(c) - 21, keyZ(c) - 22) <= 3;
    });
    check.ok(near.length >= 3, `pigeons within three cells of (21, 22): ${near.length}`);
  },
});
