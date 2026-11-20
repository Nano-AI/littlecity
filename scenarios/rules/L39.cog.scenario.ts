// L39: a quay of four docks along a beach: a cog fits alongside it and calls;
// nothing bigger fits. The narrow cove to the east is open water but too
// narrow for a ship. Ports that get nothing (too short, too narrow, no way
// in) are in src/rules/life/berths.test.ts.

import { scenario } from '@/scenario';

export default scenario({
  name: 'L39.cog',
  seed: 3901,
  about: 'A cog calls at a quay of four docks, the size of its hull; nothing bigger fits (L39).',
  terrain(t) {
    t.flat(1);
    t.water(4, 24, 43, 43);
    // A narrow cove cut into the land at the east end.
    t.water(36, 16, 37, 23);
  },
  build(b) {
    for (let x = 8; x <= 11; x++) b.block('dock', x, 0, 24);
    b.path(8, 23, 13, 23);
    b.house(9, 20, { w: 2, floors: 2, color: 3 });
  },
  cameras: [
    { name: 'port', yaw: 40, pitch: 30, zoom: 3.5, target: [11, 1, 25.5] },
    { name: 'shore', yaw: 45, pitch: 36, zoom: 1.6, target: [24, 0, 26] },
  ],
  expect(_plan, _dressing, check) {
    const calls = check.actors({ type: 'ship-call', rule: 'L39.cog' });
    check.equal(calls.length, 1, 'one cog calls');
    check.equal((calls[0]!.params as { cells: number }).cells, 4, 'at the four-cell quay');
    check.equal(check.actors({ type: 'ship-call', rule: 'L38.galleon' }).length, 0, 'no galleon: it does not fit');
    check.equal(check.actors({ type: 'ship-call', rule: 'L40.galley' }).length, 0, 'no galley either');
  },
});
