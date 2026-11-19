// L39: a quay of six docks along a beach: a cog calls (six dock cells, a
// berth of six). Fewer than twelve docks, so no galleon. The narrow cove to
// the east is open water but too narrow for a ship. Ports that get nothing
// (too short, too narrow, no way in) are in src/rules/life/berths.test.ts.

import { scenario } from '@/scenario';

export default scenario({
  name: 'L39.cog',
  seed: 3901,
  about: 'A cog calls at a six-dock quay; a four-dock quay and a quay in a narrow cove get no ship (L39).',
  terrain(t) {
    t.flat(1);
    t.water(4, 24, 43, 43);
    // A narrow cove cut into the land at the east end.
    t.water(36, 16, 37, 23);
  },
  build(b) {
    for (let x = 8; x <= 13; x++) b.block('dock', x, 0, 24);
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
    check.equal((calls[0]!.params as { cells: number }).cells, 6, 'at the six-cell quay');
    check.equal(check.actors({ type: 'ship-call', rule: 'L38.galleon' }).length, 0, 'no galleon at a port of six docks');
  },
});
