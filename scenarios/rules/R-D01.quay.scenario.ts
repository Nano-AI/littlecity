// R-D01 Quay: 4+ dock cells in a row along the shoreline. From the west:
//   four along a beach          a quay: iron bollards, goods, sills onto the sand
//   two rows of five            a quay two cells deep, with its crane (10 cells)
//   three along the beach       not enough: a jetty

import { keyZ } from '@/core/grid';
import { scenario } from '@/scenario';

export default scenario({
  name: 'R-D01.quay',
  seed: 101,
  about: 'Quays along a beach: a short one, a deep one with a crane, and a three-cell row that stays a jetty.',
  terrain(t) {
    t.flat(1);
    t.water(4, 30, 43, 43);
  },
  build(b) {
    for (let x = 10; x <= 13; x++) b.block('dock', x, 0, 30);
    for (let x = 17; x <= 21; x++) b.block('dock', x, 0, 30).block('dock', x, 0, 31);
    for (let x = 25; x <= 27; x++) b.block('dock', x, 0, 30);
    b.path(10, 29, 27, 29);
    b.house(12, 27, { w: 2, color: 2 }).house(19, 27, { w: 2, floors: 2, color: 4 });
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 34, zoom: 3.4, target: [18.5, 1, 30] },
    { name: 'back', yaw: 225, pitch: 34, zoom: 3.4, target: [18.5, 1, 30] },
    { name: 'close', yaw: 60, pitch: 30, zoom: 6.5, target: [19, 1, 30.8] },
  ],
  expect(_plan, _dressing, check) {
    check.role(10, 0, 30, 'quay');
    check.role(19, 0, 31, 'quay');
    check.role(26, 0, 30, 'jetty');
    check.equal(check.applied('R-D01.quay'), 2, 'two quays');
    // The short quay has goods and bollards but no crane; the deep one has its crane on the outer row.
    check.hasFeature({ type: 'dock-goods', on: [10, 0, 30] });
    check.hasFeature({ type: 'bollard', variant: 'iron', on: [10, 0, 30] }, 2);
    check.noFeature({ type: 'dock-crane', on: [10, 0, 30] });
    const crane = check.hasFeature({ type: 'dock-crane', on: [19, 0, 30] })[0]!;
    check.equal(keyZ(crane.cell!), 31, 'the crane stands on the outer row');
    check.equal(crane.dir, 2, 'the crane reaches south, over the water');
    check.hasSocket({ type: 'perch', rule: 'J23.dock-body' });
    check.noFeature({ type: 'bollard', variant: 'post', on: [19, 0, 30] });
    // A quay lies along the beach on sills: no ramps.
    check.noFeature({ type: 'ramp', on: [10, 0, 30] });
  },
});
