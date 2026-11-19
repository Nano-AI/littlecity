// Gallery: every kind of dock, built as a player would build them, so the
// real rules (R-D01–R-D04, J23, J28) and the real generator are what is shown.
//
// Along a beach, west to east:
//   a lone dock block and a two-block stub     jetties
//   a free-standing 2 × 3 platform             a jetty, no land in reach
//   a five-cell run out from the beach         a pier: ramp, seat, lamp place, ladder
//   an L and a T                               jetties: planks turn with each arm
//   a row of nine under a grass bank           a quay with bollards, goods and a crane
//   a walk across the mouth of a cove          a boardwalk with ramps at both ends

import { scenario } from '@/scenario';

export default scenario({
  name: 'ground-docks',
  seed: 41,
  about: 'Every dock: jetties, a platform, a pier, L and T shapes, a quay under a bank with its crane, and a boardwalk across a cove.',
  terrain(t) {
    t.flat(1);
    t.water(4, 30, 43, 43); // the sea to the south: row 29 is beach
    t.rect(28, 24, 37, 29, 2); // a grass bank standing in the water
    t.water(40, 26, 42, 29); // a cove
  },
  build(b) {
    const dock = (...at: (readonly [number, number])[]): void => at.forEach(([x, z]) => b.block('dock', x, 0, z));
    // Jetties.
    dock([7, 30]);
    dock([10, 30], [10, 31]);
    // A platform out in the water.
    for (let x = 6; x <= 7; x++) for (let z = 34; z <= 36; z++) dock([x, z]);
    // The pier.
    for (let z = 30; z <= 34; z++) dock([14, z]);
    // An L.
    for (let z = 30; z <= 32; z++) dock([18, z]);
    dock([19, 32], [20, 32]);
    // A T.
    for (let z = 30; z <= 33; z++) dock([24, z]);
    dock([23, 33], [25, 33]);
    // The quay under the bank.
    for (let x = 28; x <= 36; x++) dock([x, 30]);
    // The boardwalk across the cove.
    for (let x = 40; x <= 42; x++) dock([x, 28]);
    // Something to walk from.
    b.path(14, 26, 14, 29);
    b.put('tree', 12, 27).put('tree', 21, 27).put('tree', 31, 26).put('tree', 34, 27);
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 35, zoom: 2.3, target: [24, 1, 31] },
    { name: 'back', yaw: 225, pitch: 35, zoom: 2.3, target: [24, 1, 31] },
    { name: 'west', yaw: 135, pitch: 35, zoom: 2.3, target: [24, 1, 31] },
    { name: 'east', yaw: 315, pitch: 35, zoom: 2.3, target: [24, 1, 31] },
    { name: 'pier', yaw: 45, pitch: 32, zoom: 6.5, target: [14, 1, 32.5] },
    { name: 'pier-back', yaw: 215, pitch: 30, zoom: 6.5, target: [14, 1, 32.5] },
    { name: 'jetties', yaw: 60, pitch: 34, zoom: 6, target: [8.5, 1, 32.5] },
    { name: 'shapes', yaw: 30, pitch: 36, zoom: 5, target: [21.5, 1, 31.5] },
    { name: 'quay', yaw: 45, pitch: 33, zoom: 4.6, target: [32, 1, 30.5] },
    { name: 'quay-west', yaw: 150, pitch: 30, zoom: 5.5, target: [32, 1, 30.5] },
    { name: 'boardwalk', yaw: 30, pitch: 36, zoom: 7, target: [41.5, 1, 28] },
  ],
  expect(_plan, _dressing, check) {
    check.role(7, 0, 30, 'jetty');
    check.role(10, 0, 31, 'jetty');
    check.role(6, 0, 35, 'jetty');
    check.role(14, 0, 32, 'pier');
    check.role(19, 0, 32, 'jetty');
    check.role(24, 0, 31, 'jetty');
    check.role(32, 0, 30, 'quay');
    check.role(41, 0, 28, 'boardwalk');
    check.hasFeature({ type: 'pier-head', at: [14, 0, 34] });
    check.hasFeature({ type: 'ramp', at: [14, 0, 30] });
    check.hasFeature({ type: 'dock-crane', on: [32, 0, 30] });
    check.equal(check.structure(24, 0, 31).cells.length, 6, 'the T is one dock');
  },
});
