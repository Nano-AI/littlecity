// Fixture for D37 (market cross).
//   a square with a plinth and three stalls round it      a market cross on the plinth, not a statue
//   a square with a plinth, two stalls and a fountain      a statue (D19): the fountain is the centre

import { scenario } from '@/scenario';

export default scenario({
  name: 'D37.market-cross',
  seed: 3737,
  about: 'A plinth among two or more market stalls, with no fountain beside it, carries a market cross instead of a statue.',
  build(b) {
    b.plaza(10, 10, 15, 15);
    b.put('marble', 12, 12, { color: 3 });
    b.put('stall', 10, 12).put('stall', 14, 13).put('stall', 12, 15);
    b.plaza(24, 10, 29, 15);
    b.put('marble', 26, 12, { color: 3 });
    b.put('stall', 24, 12).put('stall', 28, 13);
    b.put('fountain', 27, 12);
  },
  cameras: [
    { name: 'market', yaw: 30, pitch: 32, zoom: 6, target: [12.5, 1.5, 12.5] },
    { name: 'all', yaw: 30, pitch: 40, zoom: 2.6, target: [20, 1, 13] },
  ],
  expect(_plan, dressing, check) {
    const crosses = check.props({ type: 'market-cross', rule: 'D37.market-cross' });
    check.equal(crosses.length, 1, 'one market cross');
    check.ok(dressing.sockets.some((s) => s.owner === crosses[0]!.id && s.type === 'activity' && s.name === 'vend'), 'a vendor’s place');
    check.equal(check.props({ type: 'statue', rule: 'D19.statue' }).length, 1, 'the fountain square keeps its statue');
  },
});
