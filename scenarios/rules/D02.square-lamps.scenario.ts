// Fixture for D02 (square lamps), with D13's flagpole and D07, D09 on the
// houses round the squares. West to east:
//   a 5 × 5 square, nothing on it      a lamp at each corner, the four-arm lamp in the middle,
//                                      the flagpole in the middle of its north side
//   a 4 × 4 square                     corner lamps, the flagpole at its centre (no big lamp)
//   a 5 × 5 square with a fountain     corner lamps only
//   a 2 × 4 strip of plaza             not a square: nothing

import { scenario } from '@/scenario';

export default scenario({
  name: 'D02.square-lamps',
  seed: 2202,
  about: 'Corner lamps on every square; the four-arm lamp at the centre of a 5 × 5 with no fountain; a flagpole on a square of 4 × 4 or more with no fountain.',
  build(b) {
    b.plaza(6, 10, 10, 14);
    b.plaza(14, 10, 17, 13);
    b.plaza(21, 10, 25, 14);
    b.put('fountain', 23, 12);
    b.plaza(29, 10, 32, 11);
    b.path(11, 12, 13, 12).path(18, 12, 20, 12).path(26, 12, 28, 12).path(28, 11);
    b.house(6, 8, { w: 3, floors: 2, color: 2 });
    b.house(14, 8, { w: 2, floors: 2, color: 4 });
    b.house(21, 8, { floors: 3, color: 0 });
    b.house(24, 8, { w: 2, color: 6 });
  },
  cameras: [
    { name: 'squares', yaw: 45, pitch: 36, zoom: 2.6, target: [18, 1, 12] },
    { name: 'squares-back', yaw: 225, pitch: 36, zoom: 2.6, target: [18, 1, 12] },
    { name: 'big', yaw: 45, pitch: 30, zoom: 6.5, target: [8.5, 1.3, 12.5] },
    { name: 'four', yaw: 135, pitch: 30, zoom: 6.5, target: [16, 1.3, 12] },
    { name: 'night', yaw: 45, pitch: 34, zoom: 3.4, target: [13, 1, 12], time: 'night' },
    { name: 'dusk', yaw: 45, pitch: 30, zoom: 6.5, target: [8.5, 1.3, 12.5], time: 'dusk' },
  ],
  expect(_plan, dressing, check) {
    const lamps = dressing.props.filter((p) => p.rule === 'D02.square-lamps');
    const big = lamps.filter((p) => p.variant === 'four-arm');
    check.equal(big.length, 1, 'one four-arm lamp');
    check.hasProp({ type: 'lamp', variant: 'four-arm', at: [8, 1, 12] });
    // Four corner lamps on each square.
    const corners = (x0: number, z0: number, x1: number, z1: number): number =>
      lamps.filter((p) => p.variant === 'post' && 'cell' in p.at && [x0, x1].includes(p.at.cell & 63) && [z0, z1].includes((p.at.cell >> 6) & 63) && p.at.pos.length === 2).length;
    check.equal(corners(6, 10, 10, 14), 4, 'corner lamps of the 5 × 5');
    check.equal(corners(14, 10, 17, 13), 4, 'corner lamps of the 4 × 4');
    check.equal(corners(21, 10, 25, 14), 4, 'corner lamps of the fountain square');
    // The strip is not a square.
    for (let x = 29; x <= 32; x++) for (let z = 10; z <= 11; z++) check.noProp({ type: 'lamp', at: [x, 1, z], rule: 'D02.square-lamps' });
    // Flagpoles: one on each square without a fountain; never where the big lamp stands.
    const poles = check.hasProp({ type: 'flag', variant: 'pole' }, 2);
    check.equal(poles.length, 2, 'flagpoles');
    check.hasProp({ type: 'flag', variant: 'pole', at: [8, 1, 10] }); // the big lamp has the centre
    check.hasProp({ type: 'flag', variant: 'pole', at: [15, 1, 11] }); // the centre of the 4 × 4
    check.equal(new Set(poles.map((p) => (p.params as { color: number }).color)).size, 1, 'one town colour');
    for (const lamp of lamps) check.ok(dressing.sockets.some((s) => s.owner === lamp.id && s.type === 'lamp-head'), 'each lamp owns its light');
  },
});
