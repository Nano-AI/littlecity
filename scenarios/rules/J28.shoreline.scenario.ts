// J28 Shoreline: a short plank ramp where a dock steps onto a beach, and
// mooring piles standing off a dock.
//   a pier onto the beach             a ramp at its land end
//   a pier onto a path on the beach   the ramp lies over the path's end
//   a row along the beach             no ramps: it lies on sills
//   a dock at the foot of a bank      no ramp: there is nothing to step onto
//   a dock whose beach cell is built on   no ramp into the house's wall

import { scenario } from '@/scenario';

export default scenario({
  name: 'J28.shoreline',
  seed: 128,
  about: 'Ramps where docks meet a beach, the cases that get none, and mooring piles off the docks.',
  terrain(t) {
    t.flat(1);
    t.water(4, 30, 43, 43);
    t.rect(28, 26, 31, 29, 2); // a bank
  },
  build(b) {
    for (let z = 30; z <= 32; z++) b.block('dock', 10, 0, z);
    for (let z = 30; z <= 33; z++) b.block('dock', 14, 0, z);
    b.path(14, 26, 14, 29);
    for (let x = 18; x <= 22; x++) b.block('dock', x, 0, 30);
    for (let z = 30; z <= 31; z++) b.block('dock', 29, 0, z);
    b.house(35, 29, { color: 6 });
    for (let z = 30; z <= 31; z++) b.block('dock', 35, 0, z);
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 34, zoom: 3, target: [22, 1, 30] },
    { name: 'back', yaw: 225, pitch: 34, zoom: 3, target: [22, 1, 30] },
    { name: 'ramp', yaw: 45, pitch: 32, zoom: 8, target: [12, 1, 30] },
    { name: 'ramp-back', yaw: 215, pitch: 32, zoom: 8, target: [12, 1, 30] },
  ],
  expect(_plan, _dressing, check) {
    check.hasFeature({ type: 'ramp', at: [10, 0, 30], dir: 0 });
    check.hasFeature({ type: 'ramp', at: [14, 0, 30], dir: 0 });
    check.noFeature({ type: 'ramp', on: [18, 0, 30] });
    check.noFeature({ type: 'ramp', on: [29, 0, 30] });
    check.noFeature({ type: 'ramp', on: [35, 0, 30] });
    check.equal(check.features({ type: 'ramp' }).length, 2, 'ramps');
    // Mooring piles stand off some docks, each with a perch for a gull, in water that is free all round.
    const piles = check.hasFeature({ type: 'dock-pile' });
    check.equal(check.sockets({ type: 'perch', rule: 'J28.shoreline' }).length, piles.length, 'one perch per pair of piles');
    for (const p of piles) check.noFeature({ type: 'bollard', at: [p.cell! & 63, 0, (p.cell! >> 6) & 63], dir: p.dir });
  },
});
