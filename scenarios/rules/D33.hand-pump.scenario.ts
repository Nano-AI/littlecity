// Fixture for D33 (hand pump). A village with no fountain: a long street
// with a tee and a crossroads on it.
//   the crossroads (four branches)    the pump, on a corner of it
//   the tee (three branches)          nothing: there is only one pump
// (A town with a fountain has no pump: the fountain fixtures, R-F01, show none.)

import { scenario } from '@/scenario';

export default scenario({
  name: 'D33.hand-pump',
  seed: 3333,
  about: 'A town without a fountain, with eight or more street cells, has one hand pump at its busiest junction.',
  build(b) {
    b.path(6, 12, 30, 12);
    b.path(12, 13, 12, 16);
    b.path(22, 8, 22, 11).path(22, 13, 22, 16);
    b.house(10, 11, { color: 1 }).house(14, 13, { color: 4 }).house(24, 11, { color: 6 });
  },
  cameras: [
    { name: 'village', yaw: 30, pitch: 36, zoom: 3.2, target: [18, 1, 12] },
    { name: 'pump', yaw: 30, pitch: 24, zoom: 9, target: [22, 1.2, 12] },
  ],
  expect(_plan, dressing, check) {
    const pumps = dressing.props.filter((p) => p.type === 'pump');
    check.equal(pumps.length, 1, 'one pump in the town');
    const at = pumps[0]?.at;
    check.ok(!!at && 'cell' in at && (at.cell & 63) === 22 && ((at.cell >> 6) & 63) === 12, 'at the crossroads');
    check.ok(!!at && 'cell' in at && at.pos.length === 2, 'on a corner, off the walking line');
  },
});
