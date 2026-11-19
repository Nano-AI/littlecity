// L42: an island with a lighthouse and no port. Now and then a tall ship
// crosses far out along the most open edge of the map, without calling.
//
//   node src/life/testing/sequence.mjs L42.passing-sails --warm 30000 --frames 12 --every 6000 --name pass --zoom 1.2 --target 24,0,24

import { scenario } from '@/scenario';

export default scenario({
  name: 'L42.passing-sails',
  seed: 4201,
  about: 'A lighthouse: a tall ship crosses the horizon far out, never calling (L42).',
  terrain(t) {
    t.flat(0);
    t.rect(16, 16, 30, 28, 1);
  },
  build(b) {
    b.put('lighthouse', 29, 27);
    b.house(20, 20, { floors: 2, w: 2, color: 1 });
  },
  cameras: [{ name: 'island', yaw: 45, pitch: 40, zoom: 1.2, target: [24, 0, 24] }],
  expect(_plan, _dressing, check) {
    const calls = check.actors({ type: 'ship-call', rule: 'L42.passing-sails' });
    check.equal(calls.length, 1, 'one tall ship goes by now and then');
    check.equal(check.actors({ type: 'ship-call', rule: 'L40.galley' }).length, 0, 'no galley: there is no berth');
  },
});
