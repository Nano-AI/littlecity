// L29 and the L03 cap: a square with a tiered fountain and a clock tower, a
// campanile with its bell, a small basin on the grass, a row of shops with
// hanging signs, and a windmill whose cap turns to the wind. Watch them:
//
//   node src/life/testing/sequence.mjs L29.mechanisms --frames 12 --every 250 --name jets --zoom 9 --target 13,1,13
//   node src/life/testing/sequence.mjs L29.mechanisms --time 0.6 --run --frames 12 --every 500 --name bells

import { scenario } from '@/scenario';

export default scenario({
  name: 'L29.mechanisms',
  seed: 29,
  about: 'Fountain jets playing, clock hands at game time, a bell that swings at dusk, shop signs in gusts, a mill cap facing the wind.',
  build(b) {
    b.plaza(11, 11, 15, 15);
    b.put('fountain', 13, 13);
    b.tower(16, 13, { floors: 5, color: 6 }); // a clock tower: beside a square, 4+ tall
    b.tower(21, 12, { floors: 7, color: 4 }); // the campanile: the tallest tower, an open belfry
    b.put('fountain', 19, 17); // a small basin on the grass
    for (let i = 0; i < 4; i++) b.house(11 + i, 9, { floors: 2, color: i });
    b.path(10, 10, 16, 10);
    b.put('windmill', 25, 15);
  },
  cameras: [
    { name: 'square', yaw: 45, pitch: 30, zoom: 4.5, target: [15, 2, 13] },
    { name: 'fountain', yaw: 45, pitch: 30, zoom: 10, target: [13.5, 1.4, 13.5] },
    { name: 'dusk', yaw: 45, pitch: 30, zoom: 4.5, target: [15, 2, 13], time: 'dusk' },
  ],
  expect(plan, dressing, check) {
    check.equal(check.actors({ type: 'water-jet', rule: 'L29.fountain-jets' }).length, check.sockets({ type: 'water-jet' }).length, 'a jet at every water-jet socket');
    check.ok(dressing.actors.some((a) => a.type === 'water-jet' && a.variant === 'up'), 'the tiered fountain has a jet on its finial');
    check.equal(check.actors({ type: 'clock-hands' }).length, check.sockets({ type: 'clock-hands' }).length, 'hands on every clock face');
    check.ok(check.sockets({ type: 'clock-hands' }).length >= 2, 'the clock tower has faces');
    check.equal(check.actors({ type: 'bell', rule: 'L29.bells' }).length, check.sockets({ type: 'bell' }).length, 'a bell in every belfry');
    check.ok(check.sockets({ type: 'bell' }).length >= 1, 'the campanile has a belfry');
    check.equal(check.actors({ type: 'mill-cap', rule: 'L03.mill-cap' }).length, 1, 'one cap on the mill');
    void plan;
  },
});
