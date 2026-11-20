// R-M11 (RC-14) and R-M12 (RC-13): small and long temples by their place.
// A 2 × 2 slab on four pillars on a big plaza is a bandstand (a tented
// roof); a 2 × 7 slab on pillars along the side of a square is a stoa (one
// roof sloping away from the square, goods in its back bays); a 2 × 2 on a
// podium and a 3 × 3 temple stay temples.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-M11.bandstand',
  seed: 4211,
  about: 'A bandstand on a plaza; a stoa on the side of the same square; a small temple on a podium; a 3 × 3 temple on grass.',
  build(b) {
    b.plaza(8, 8, 18, 16);
    for (const x of [12, 13]) for (const z of [11, 12]) b.stack('pillar', x, z, { floors: 2 });
    for (const x of [12, 13]) for (const z of [11, 12]) b.block('marble', x, 3, z, { color: 2 });
    // The stoa along the east side of the square, a cell off it.
    for (let z = 8; z <= 14; z++) b.stack('pillar', 20, z, { floors: 2 }).block('marble', 20, 3, z, { color: 1 }).block('marble', 21, 3, z, { color: 1 });
    // On a podium: a temple.
    b.fill('marble', 26, 8, 29, 11, { floors: 2 });
    for (const x of [27, 28]) for (const z of [9, 10]) b.stack('pillar', x, z, { floors: 2 });
    for (const x of [27, 28]) for (const z of [9, 10]) b.block('marble', x, 5, z, { color: 2 });
    // A 3 × 3 on grass: a temple.
    for (const x of [26, 28]) for (const z of [16, 18]) b.stack('pillar', x, z, { floors: 2 });
    for (let x = 26; x <= 28; x++) for (let z = 16; z <= 18; z++) b.block('marble', x, 3, z, { color: 3 });
  },
  cameras: [
    { name: 'square', yaw: 35, pitch: 30, zoom: 3.2, target: [15, 1.5, 11.5] },
    { name: 'dusk', yaw: 215, pitch: 30, zoom: 3.2, target: [15, 1.5, 11.5], time: 'dusk' },
    { name: 'all', yaw: 40, pitch: 36, zoom: 2.2, target: [19, 1.5, 13] },
  ],
  expect(_plan, _dressing, check) {
    check.role(12, 3, 11, 'bandstand');
    check.hasFeature({ type: 'stylobate', on: [12, 3, 11] }, 4);
    check.noFeature({ type: 'pediment', on: [12, 3, 11] });
    check.role(20, 3, 8, 'stoa');
    check.hasTag(20, 3, 8, 'stoa:w');
    check.noFeature({ type: 'pediment', on: [20, 3, 8] });
    check.hasProp({ type: 'structure-prop', variant: 'crates', rule: 'R-H98.structure-props' });
    check.role(27, 5, 9, 'temple');
    check.role(26, 3, 16, 'temple');
  },
});
