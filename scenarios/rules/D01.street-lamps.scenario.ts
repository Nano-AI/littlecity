// Fixture for D01 (street lamps). A street long enough to be lit: a lamp at
// the T junction, one at each dead end, and one every fourth cell between,
// on alternating sides and never in front of a door. To the south, a street
// of three cells: too short, no lamps. To the east, a bend.

import { scenario } from '@/scenario';

export default scenario({
  name: 'D01.street-lamps',
  seed: 4101,
  about: 'Lamps at junctions and dead ends, then every fourth cell on alternating sides; none on a street shorter than four cells; none in front of a door.',
  build(b) {
    b.path(8, 14, 27, 14); // the main street
    b.path(16, 15, 16, 20); // a side street off a T junction
    b.path([27, 13], [27, 9], [33, 9]); // a bend, then another
    b.path(10, 24, 12, 24); // three cells: unlit
    // Houses along the main street, doors onto it.
    b.house(10, 13, { color: 0 });
    b.house(12, 13, { floors: 2, color: 4 });
    b.house(13, 15, { color: 2 });
    b.house(20, 13, { w: 2, floors: 2, color: 3 });
    b.house(23, 15, { color: 6 });
    b.house(24, 13, { color: 1 });
    b.put('tree', 18, 16).put('tree', 30, 11);
  },
  cameras: [
    { name: 'street', yaw: 45, pitch: 34, zoom: 2.7, target: [20, 1, 15] },
    { name: 'street-back', yaw: 225, pitch: 34, zoom: 2.7, target: [20, 1, 15] },
    { name: 'close', yaw: 35, pitch: 28, zoom: 8, target: [15.5, 1.3, 14.5] },
    { name: 'dusk', yaw: 45, pitch: 30, zoom: 5, target: [17, 1.2, 15], time: 'dusk' },
    { name: 'night', yaw: 135, pitch: 30, zoom: 5, target: [22, 1.2, 13], time: 'night' },
  ],
  expect(_plan, dressing, check) {
    const lamps = check.hasProp({ type: 'lamp', rule: 'D01.street-lamps' }, 6);
    // The junction and the three dead ends are lit.
    check.hasProp({ type: 'lamp', at: [16, 1, 14] });
    check.hasProp({ type: 'lamp', at: [8, 1, 14] });
    check.hasProp({ type: 'lamp', at: [16, 1, 20] });
    check.hasProp({ type: 'lamp', at: [33, 1, 9] });
    // The short street is not.
    for (let x = 10; x <= 12; x++) check.noProp({ type: 'lamp', at: [x, 1, 24] });
    // Every lamp is a post lamp on a path cell, off its walking line, and owns its light.
    for (const lamp of lamps) {
      check.equal(lamp.variant, 'post', 'street lamps are post lamps');
      check.ok('cell' in lamp.at && lamp.at.pos !== 'c', 'a lamp never stands in the middle of the path');
      check.ok(dressing.sockets.some((s) => s.owner === lamp.id && s.type === 'lamp-head'), 'each lamp owns a lamp-head socket');
    }
    // No two lamps in one cell, none in neighbouring cells.
    const cells = lamps.map((l) => ('cell' in l.at ? l.at.cell : -1));
    check.equal(new Set(cells).size, cells.length, 'one lamp per cell');
    for (const a of cells) for (const c of cells) check.ok(a === c || Math.abs((a & 63) - (c & 63)) + Math.abs(((a >> 6) & 63) - ((c >> 6) & 63)) >= 2, 'lamps keep their distance');
  },
});
