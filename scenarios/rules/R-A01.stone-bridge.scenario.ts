// R-A01 and S1: stone bridges over a channel. A low one-cell bridge, a low
// bridge of three (one arch), a high bridge of five between cliffs (two
// arches and a centre pier down to the seabed), a high bridge of six, and a
// bridge two cells wide.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-A01.stone-bridge',
  seed: 51,
  about: 'Stone bridges: spans of 1, 3, 4, 5 and 6, low over the water and high between cliffs, and one two cells wide.',
  terrain(t) {
    t.flat(1);
    t.rect(4, 22, 43, 25, 3); // high banks either side of the wide channel
    t.rect(4, 32, 43, 35, 3);
    t.water(4, 16, 43, 18); // a channel three wide
    t.water(4, 26, 43, 31); // and one six wide, between the high banks
    t.water(25, 8, 25, 12); // a ditch one cell wide
  },
  build(b) {
    b.path(8, 13, 8, 15).path(8, 19, 8, 21);
    for (let z = 16; z <= 18; z++) b.block('arch', 8, 0, z); // three long, low: one arch
    for (let z = 16; z <= 18; z++) b.block('arch', 13, 0, z).block('arch', 14, 0, z); // two wide
    b.path(22, 10, 24, 10).path(26, 10, 28, 10).block('arch', 25, 0, 10); // a one-cell bridge
    for (let z = 26; z <= 31; z++) b.block('arch', 10, 2, z); // six long, high: two arches of three
    for (let y = 0; y <= 2; y++) b.block('marble', 16, y, 26).block('marble', 22, y, 26).block('marble', 22, y, 31); // abutments
    for (let z = 27; z <= 31; z++) b.block('arch', 16, 2, z); // five long: a pier under the middle cell
    for (let z = 27; z <= 30; z++) b.block('arch', 22, 2, z); // four long: a pier on the middle boundary
  },
  cameras: [
    { name: 'low', yaw: 45, pitch: 30, zoom: 3.6, target: [14, 1, 17] },
    { name: 'low-back', yaw: 225, pitch: 32, zoom: 3.6, target: [14, 1, 17] },
    { name: 'high', yaw: 60, pitch: 26, zoom: 3.2, target: [16, 2, 28.5] },
    { name: 'high-back', yaw: 300, pitch: 30, zoom: 3.2, target: [16, 2, 28.5] },
    { name: 'far', yaw: 45, pitch: 36, zoom: 1.7, target: [16, 1, 24] },
  ],
  expect(plan, _dressing, check) {
    check.role(8, 0, 17, 'stone-bridge');
    check.hasTag(8, 0, 17, 'deck:humped');
    check.sameStructure([8, 0, 16], [8, 0, 18]);
    // One arch over three cells: every cell has the same opening, seen from its own place.
    const mid = check.hasFeature({ type: 'arch-opening', at: [8, 0, 17] })[0]!;
    check.equal(mid.dir, 1, 'the bridge runs along z, so the passage is along x');
    check.equal((mid.params as { lo: number }).lo, -1, 'the opening starts one cell before the middle cell');
    check.equal((mid.params as { hi: number }).hi, 2, 'and ends one cell after it');
    check.noFeature({ type: 'pier', on: [8, 0, 17] });
    check.hasSocket({ type: 'arch-crown', at: [8, 0, 17] });
    check.equal(check.features({ type: 'bridge-end', on: [8, 0, 17] }).length, 2, 'a bridge end at each end');
    check.hasSocket({ type: 'bridge-end', at: [8, 0, 16] });
    // Six long: a centre pier on the boundary between the third and fourth cells, down to the seabed.
    const pier6 = check.hasFeature({ type: 'pier', on: [10, 2, 28] })[0]!;
    check.equal(check.features({ type: 'pier', on: [10, 2, 28] }).length, 1, 'one pier under the six');
    check.equal((pier6.params as { depth: number }).depth, 2, 'two cells down to the sea');
    check.equal((pier6.params as { water: number }).water, 1, 'standing in the sea');
    check.equal((pier6.params as { side?: number }).side, 2, 'on the south side of the third cell');
    // Five long: the pier stands under the middle cell.
    const pier5 = check.hasFeature({ type: 'pier', at: [16, 2, 29] })[0]!;
    check.equal((pier5.params as { side?: number }).side, undefined, 'under the middle of the cell');
    // Four long: a pier on the middle boundary.
    check.hasFeature({ type: 'pier', at: [22, 2, 28] });
  },
});
