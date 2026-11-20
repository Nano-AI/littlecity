// Fixture for U22 (ford and stepping stones).
//   a path running into a stream 2 wide and out the other side, in line    stepping stones across both
//                                                                          water cells, 'ford' sockets at
//                                                                          each end
//   the same beside a bridge (an arch within 2)                            none
//   a path that runs into the stream with nothing across                   none

import { scenario } from '@/scenario';

export default scenario({
  name: 'U22.ford',
  seed: 2222,
  about: 'Two path ends facing each other across one or two cells of a stream get stepping stones across it; not beside a bridge, and not where nothing comes back on the far bank.',
  terrain(t) {
    t.flat(1);
    t.water(4, 20, 43, 21);
  },
  build(b) {
    b.house(8, 12, { color: 2 }).house(30, 28, { color: 5 });
    b.path(12, 14, 12, 19).path(12, 22, 12, 27);
    // Beside a bridge.
    b.path(24, 14, 24, 19).path(24, 22, 24, 27);
    b.block('arch', 25, 0, 20).block('arch', 25, 0, 21);
    // Into the stream alone.
    b.path(34, 14, 34, 19);
  },
  cameras: [
    { name: 'ford', yaw: 30, pitch: 30, zoom: 7, target: [12, 0.8, 20.5] },
    { name: 'all', yaw: 30, pitch: 40, zoom: 2.4, target: [22, 1, 20] },
  ],
  expect(_plan, dressing, check) {
    const stones = check.props({ type: 'stepping-stones', rule: 'U22.ford' });
    check.equal(stones.length, 2, 'stones across both water cells');
    check.ok(stones.every((p) => 'cell' in p.at && (p.at.cell & 63) === 12), 'only at the ford');
    check.equal(dressing.sockets.filter((s) => s.type === 'activity' && (s.name === 'ford' || s.name === 'ford-far')).length, 2, 'a socket at each end');
  },
});
